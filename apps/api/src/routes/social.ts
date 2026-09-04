/**
 * Feed, eventos, reações e comentários.
 *
 * O feed não maximiza tempo de tela. Ele ordena por relevância para o usuário e para o
 * PC dele: primeiro o que a máquina do próprio usuário precisa saber, depois o que
 * aconteceu com as pessoas que ele segue, e por último descoberta.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { computeSetupScore, diagnose, oneLineStatus } from '@pece/core';
import { Prisma, Visibility } from '@prisma/client';
import { prisma } from '../db.ts';
import { optionalAuth, requireAuth } from '../auth.ts';
import { toRig, toUsageProfile, type DbRigWithComponents } from '../mappers.ts';

const EVENT_KINDS = [
  'UPGRADE',
  'BUILD',
  'BENCHMARK',
  'MAINTENANCE',
  'PURCHASE',
  'SALE',
  'SETUP',
  'ACHIEVEMENT',
  'MILESTONE',
  'DISCUSSION',
] as const;

const createEventBody = z.object({
  kind: z.enum(EVENT_KINDS),
  title: z.string().min(1).max(140),
  body: z.string().max(2000).nullable().default(null),
  rigId: z.string().nullable().default(null),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
});

/** Formato único de evento para o feed — o app renderiza um só componente. */
function serializeEvent(
  event: {
    id: string;
    kind: string;
    title: string;
    body: string | null;
    payload: unknown;
    createdAt: Date;
    automatic: boolean;
    author: { id: string; handle: string; displayName: string; avatarUrl: string | null };
    rig: { id: string; name: string } | null;
    reactions: Array<{ kind: string; userId: string }>;
    _count: { comments: number };
  },
  viewerId: string | undefined,
) {
  const counts = { LOVE: 0, LIKE: 0, DISLIKE: 0 };
  let viewerReaction: string | null = null;

  for (const r of event.reactions) {
    counts[r.kind as keyof typeof counts] += 1;
    if (r.userId === viewerId) viewerReaction = r.kind;
  }

  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    body: event.body,
    payload: event.payload,
    createdAt: event.createdAt,
    automatic: event.automatic,
    author: event.author,
    rig: event.rig,
    reactions: counts,
    viewerReaction,
    commentCount: event._count.comments,
  };
}

const EVENT_INCLUDE = {
  author: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
  rig: { select: { id: true, name: true } },
  reactions: { select: { kind: true, userId: true } },
  _count: { select: { comments: true } },
};

export async function socialRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Feed
  // -------------------------------------------------------------------------

  app.get('/feed', { preHandler: optionalAuth }, async (request) => {
    const viewerId = request.user?.id;
    const limit = Math.min(Number((request.query as { limit?: string }).limit) || 20, 50);
    const cursor = (request.query as { cursor?: string }).cursor;

    /**
     * Presença da inteligência pessoal no topo do feed: uma linha discreta sobre a
     * própria máquina. Não é um card de anúncio — é a razão de o app parecer vivo
     * assim que abre.
     */
    let personal: {
      rigId: string;
      rigName: string;
      status: string;
      verdict: string;
      setupScore: number;
      headline: string;
      topFinding: { what: string; severity: string } | null;
    } | null = null;

    if (viewerId) {
      const primary = await prisma.rig.findFirst({
        where: { ownerId: viewerId },
        include: {
          components: { where: { removedAt: null }, include: { component: true } },
          owner: { include: { profile: true } },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });

      if (primary && primary.components.length > 0) {
        const rig = toRig(primary as unknown as DbRigWithComponents);
        const profile = toUsageProfile(primary.owner.profile, primary.owner.region);
        const diagnosis = diagnose(rig, profile);
        const score = computeSetupScore(rig, profile, diagnosis);
        const top = diagnosis.findings[0];

        personal = {
          rigId: primary.id,
          rigName: primary.name,
          status: oneLineStatus(diagnosis),
          verdict: diagnosis.verdict,
          setupScore: score.total,
          headline: diagnosis.headline,
          topFinding: top ? { what: top.what, severity: top.severity } : null,
        };
      }
    }

    // Seguidos + próprio usuário. Sem login, só conteúdo público.
    const following = viewerId
      ? (await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } })).map(
          (f) => f.followingId,
        )
      : [];

    const authorScope = viewerId ? [...following, viewerId] : [];

    const events = await prisma.event.findMany({
      where: {
        OR: [
          ...(authorScope.length > 0
            ? [{ authorId: { in: authorScope }, visibility: { in: [Visibility.PUBLIC, Visibility.FOLLOWERS] } }]
            : []),
          // Descoberta: eventos públicos de qualquer pessoa completam o feed.
          { visibility: Visibility.PUBLIC },
        ],
      },
      include: EVENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    return {
      personal,
      events: page.map((e) => serializeEvent(e, viewerId)),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  });

  // -------------------------------------------------------------------------
  // Eventos
  // -------------------------------------------------------------------------

  app.post('/events', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createEventBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }

    if (parsed.data.rigId) {
      const rig = await prisma.rig.findUnique({ where: { id: parsed.data.rigId } });
      if (!rig || rig.ownerId !== request.user!.id) {
        return reply.code(403).send({ error: 'forbidden', message: 'Essa máquina não é sua.' });
      }
    }

    const event = await prisma.event.create({
      data: {
        ...parsed.data,
        payload: (parsed.data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        authorId: request.user!.id,
        automatic: false,
      },
      include: EVENT_INCLUDE,
    });

    return reply.code(201).send({ event: serializeEvent(event, request.user!.id) });
  });

  app.get('/events/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
    if (!event) return reply.code(404).send({ error: 'not_found' });
    if (event.visibility === 'PRIVATE' && event.authorId !== request.user?.id) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    return { event: serializeEvent(event, request.user?.id) };
  });

  app.delete('/events/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.code(404).send({ error: 'not_found' });
    if (event.authorId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    await prisma.event.delete({ where: { id } });
    return reply.code(204).send();
  });

  // -------------------------------------------------------------------------
  // Reações
  // -------------------------------------------------------------------------

  app.put('/events/:id/reaction', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ kind: z.enum(['LOVE', 'LIKE', 'DISLIKE']) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });

    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) return reply.code(404).send({ error: 'not_found' });

    // Uma reação por pessoa: reagir de novo troca, não soma.
    const reaction = await prisma.reaction.upsert({
      where: { eventId_userId: { eventId: id, userId: request.user!.id } },
      create: { eventId: id, userId: request.user!.id, kind: parsed.data.kind },
      update: { kind: parsed.data.kind },
    });

    const counts = await prisma.reaction.groupBy({ by: ['kind'], where: { eventId: id }, _count: true });
    return {
      viewerReaction: reaction.kind,
      reactions: {
        LOVE: counts.find((c) => c.kind === 'LOVE')?._count ?? 0,
        LIKE: counts.find((c) => c.kind === 'LIKE')?._count ?? 0,
        DISLIKE: counts.find((c) => c.kind === 'DISLIKE')?._count ?? 0,
      },
    };
  });

  app.delete('/events/:id/reaction', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.reaction.deleteMany({ where: { eventId: id, userId: request.user!.id } });

    const counts = await prisma.reaction.groupBy({ by: ['kind'], where: { eventId: id }, _count: true });
    return reply.send({
      viewerReaction: null,
      reactions: {
        LOVE: counts.find((c) => c.kind === 'LOVE')?._count ?? 0,
        LIKE: counts.find((c) => c.kind === 'LIKE')?._count ?? 0,
        DISLIKE: counts.find((c) => c.kind === 'DISLIKE')?._count ?? 0,
      },
    });
  });

  // -------------------------------------------------------------------------
  // Comentários
  // -------------------------------------------------------------------------

  app.get('/events/:id/comments', async (request) => {
    const { id } = request.params as { id: string };
    const comments = await prisma.comment.findMany({
      where: { eventId: id, parentId: null },
      include: {
        author: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
        replies: {
          include: { author: { select: { id: true, handle: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return { comments };
  });

  app.post('/events/:id/comments', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ body: z.string().min(1).max(1000), parentId: z.string().nullable().default(null) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });

    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) return reply.code(404).send({ error: 'not_found' });

    const comment = await prisma.comment.create({
      data: { eventId: id, authorId: request.user!.id, body: parsed.data.body, parentId: parsed.data.parentId },
      include: { author: { select: { id: true, handle: true, displayName: true, avatarUrl: true } } },
    });

    return reply.code(201).send({ comment });
  });

  // -------------------------------------------------------------------------
  // Seguir
  // -------------------------------------------------------------------------

  app.put('/users/:handle/follow', { preHandler: requireAuth }, async (request, reply) => {
    const { handle } = request.params as { handle: string };
    const target = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: 'not_found' });
    if (target.id === request.user!.id) {
      return reply.code(400).send({ error: 'validation', message: 'Você não pode seguir a si mesmo.' });
    }

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: request.user!.id, followingId: target.id } },
      create: { followerId: request.user!.id, followingId: target.id },
      update: {},
    });

    return { following: true };
  });

  app.delete('/users/:handle/follow', { preHandler: requireAuth }, async (request, reply) => {
    const { handle } = request.params as { handle: string };
    const target = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: 'not_found' });

    await prisma.follow.deleteMany({ where: { followerId: request.user!.id, followingId: target.id } });
    return { following: false };
  });
}

export { EVENT_INCLUDE, serializeEvent };
