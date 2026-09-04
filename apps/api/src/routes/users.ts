/**
 * Perfil público, onboarding e rankings.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  computeSetupScore,
  diagnose,
  oneLineStatus,
  RESOLUTIONS,
  valuateRig,
  WORKLOADS,
} from '@pece/core';
import { Visibility } from '@prisma/client';
import { prisma } from '../db.ts';
import { optionalAuth, requireAuth, verifyPassword } from '../auth.ts';
import { toRig, toUsageProfile, type DbRigWithComponents } from '../mappers.ts';
import { EVENT_INCLUDE, serializeEvent } from './social.ts';

const profileBody = z.object({
  workloads: z
    .array(z.object({ kind: z.enum(WORKLOADS), weight: z.union([z.literal(1), z.literal(2), z.literal(3)]) }))
    .min(1, 'Escolha pelo menos um tipo de uso.'),
  resolution: z.enum(RESOLUTIONS),
  targetFps: z.number().int().min(24).max(1000).nullable().default(null),
  budgetTier: z.enum(['none', 'tight', 'moderate', 'comfortable', 'unlimited']).default('moderate'),
  budgetAmount: z.number().nonnegative().nullable().default(null),
  currency: z.string().length(3).default('BRL'),
  priorities: z
    .array(z.enum(['max-fps', 'visual-quality', 'silence', 'value-for-money', 'longevity', 'efficiency']))
    .default([]),
  expertise: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
});

export async function userRoutes(app: FastifyInstance) {
  /** Onboarding: salva (ou atualiza) o perfil de uso. */
  app.put('/me/profile', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = profileBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }

    const data = {
      workloads: parsed.data.workloads,
      resolution: parsed.data.resolution,
      targetFps: parsed.data.targetFps,
      budgetTier: parsed.data.budgetTier,
      budgetAmount: parsed.data.budgetAmount,
      currency: parsed.data.currency,
      priorities: parsed.data.priorities,
      expertise: parsed.data.expertise,
    };

    const saved = await prisma.profile.upsert({
      where: { userId: request.user!.id },
      create: { userId: request.user!.id, ...data },
      update: data,
    });

    const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { region: true } });
    return { profile: toUsageProfile(saved, user?.region ?? 'BR') };
  });

  app.patch('/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(280).nullable().optional(),
        avatarUrl: z.string().url().nullable().optional(),
        region: z.string().length(2).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });

    const user = await prisma.user.update({ where: { id: request.user!.id }, data: parsed.data });
    return {
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        region: user.region,
      },
    };
  });

  /**
   * Apagar a conta.
   *
   * Existe por dois motivos, e o primeiro é o que manda: quem entrega os dados do próprio
   * PC para um produto precisa poder tirá-los de lá. Um app que só sabe cadastrar não
   * merece o cadastro.
   *
   * O segundo é operacional: com esta rota, os testes ponta a ponta limpam o que sujam
   * pelo mesmo caminho que qualquer pessoa usaria, em vez de uma porta dos fundos que
   * ninguém exercita. As contas de teste antes ficavam no banco de produção para sempre e
   * apareciam no feed de descoberta de gente real.
   *
   * Exige a senha: apagar tudo é irreversível, e um token vazado não pode bastar.
   */
  app.delete('/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'validation', message: 'Confirme sua senha para apagar a conta.' });
    }

    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) return reply.code(404).send({ error: 'not_found' });

    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Senha incorreta.' });
    }

    // Máquinas, peças, retratos, eventos, reações e comentários caem por cascata no schema.
    await prisma.user.delete({ where: { id: user.id } });
    return reply.code(204).send();
  });

  /** Perfil público. */
  app.get('/users/:handle', { preHandler: optionalAuth }, async (request, reply) => {
    const { handle } = request.params as { handle: string };
    const viewerId = request.user?.id;

    const user = await prisma.user.findUnique({
      where: { handle },
      include: {
        profile: true,
        _count: { select: { followers: true, following: true, events: true } },
        rigs: {
          include: {
            components: { where: { removedAt: null }, include: { component: true } },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!user) return reply.code(404).send({ error: 'not_found' });

    const isSelf = user.id === viewerId;
    const isFollower = viewerId
      ? (await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
        })) !== null
      : false;

    const profile = toUsageProfile(user.profile, user.region);

    const visibleRigs = user.rigs.filter((r) => {
      if (isSelf) return true;
      if (r.visibility === 'PUBLIC') return true;
      if (r.visibility === 'FOLLOWERS') return isFollower;
      return false;
    });

    const rigs = visibleRigs.map((row) => {
      const rig = toRig({ ...row, owner: user } as unknown as DbRigWithComponents);
      const diagnosis = diagnose(rig, profile);
      const score = computeSetupScore(rig, profile, diagnosis);
      const value = valuateRig(rig, profile.region);

      return {
        id: row.id,
        name: row.name,
        kind: row.kind,
        isPrimary: row.isPrimary,
        componentCount: rig.components.length,
        setupScore: score.total,
        tier: score.tier,
        verdict: diagnosis.verdict,
        status: oneLineStatus(diagnosis),
        estimatedFps: diagnosis.performance.fps?.fps ?? null,
        // O valor respeita a escolha do dono, sempre.
        value: isSelf || row.showValue ? { total: value.total, currency: value.currency } : null,
        highlights: {
          cpu: rig.components.find((c) => c.component.category === 'CPU')?.component.model ?? null,
          gpu: rig.components.find((c) => c.component.category === 'GPU')?.component.model ?? null,
        },
      };
    });

    const events = await prisma.event.findMany({
      where: {
        authorId: user.id,
        ...(isSelf
          ? {}
          : {
              visibility: isFollower
                ? { in: [Visibility.PUBLIC, Visibility.FOLLOWERS] }
                : Visibility.PUBLIC,
            }),
      },
      include: EVENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        region: user.region,
        createdAt: user.createdAt,
      },
      counts: user._count,
      isSelf,
      isFollowing: isFollower,
      rigs,
      events: events.map((e) => serializeEvent(e, viewerId)),
    };
  });

  /**
   * Rankings.
   *
   * Ordenados por Setup Score, nunca por valor gasto. Isso é uma escolha de produto:
   * um ranking por preço premiaria quem tem mais dinheiro, e não quem monta melhor.
   */
  app.get('/rankings', { preHandler: optionalAuth }, async (request) => {
    const query = request.query as { scope?: string; limit?: string };
    const limit = Math.min(Number(query.limit) || 25, 100);
    const scope = query.scope ?? 'global';
    const viewerId = request.user?.id;

    let ownerFilter: { in: string[] } | undefined;
    if (scope === 'following' && viewerId) {
      const following = await prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      });
      ownerFilter = { in: [...following.map((f) => f.followingId), viewerId] };
    }

    const rows = await prisma.rig.findMany({
      where: {
        visibility: 'PUBLIC',
        ...(ownerFilter ? { ownerId: ownerFilter } : {}),
        components: { some: { removedAt: null } },
      },
      include: {
        components: { where: { removedAt: null }, include: { component: true } },
        owner: { include: { profile: true } },
      },
      take: 300,
    });

    const scored = rows
      .map((row) => {
        const rig = toRig(row as unknown as DbRigWithComponents);
        const profile = toUsageProfile(row.owner.profile, row.owner.region);
        const diagnosis = diagnose(rig, profile);
        const score = computeSetupScore(rig, profile, diagnosis);
        const value = valuateRig(rig, profile.region);

        return {
          rigId: row.id,
          rigName: row.name,
          owner: { handle: row.owner.handle, displayName: row.owner.displayName, avatarUrl: row.owner.avatarUrl },
          setupScore: score.total,
          tier: score.tier,
          dimensions: score.dimensions.map((d) => ({ dimension: d.dimension, score: d.score })),
          // Custo aparece como contexto, não como critério.
          estimatedValue: row.showValue ? value.coreTotal : null,
          currency: value.currency,
          cpu: rig.components.find((c) => c.component.category === 'CPU')?.component.model ?? null,
          gpu: rig.components.find((c) => c.component.category === 'GPU')?.component.model ?? null,
        };
      })
      .filter((r) => r.setupScore > 0);

    const key = ((): 'setupScore' | 'balance' | 'efficiency' => {
      if (scope === 'balance') return 'balance';
      if (scope === 'efficiency') return 'efficiency';
      return 'setupScore';
    })();

    const ranked = scored
      .sort((a, b) => {
        if (key === 'setupScore') return b.setupScore - a.setupScore;
        const aDim = a.dimensions.find((d) => d.dimension === key)?.score ?? 0;
        const bDim = b.dimensions.find((d) => d.dimension === key)?.score ?? 0;
        return bDim - aDim;
      })
      .slice(0, limit)
      .map((entry, index) => ({ position: index + 1, ...entry }));

    return { scope, criterion: key, entries: ranked };
  });
}
