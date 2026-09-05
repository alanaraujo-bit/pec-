/**
 * Máquinas do usuário e a inteligência sobre elas.
 *
 * Toda análise roda no servidor a partir do `@pece/core`, com os mesmos dados que o app
 * mostra. O app não recalcula nada por conta própria — o que evita a situação em que a
 * tela diz uma coisa e o histórico registra outra.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  assessHealth,
  buildScenarios,
  compareRigs,
  computeSetupScore,
  diagnose,
  HARDWARE_CATEGORIES,
  oneLineStatus,
  suggestSellingPrice,
  valuateRig,
} from '@pece/core';
import { prisma } from '../db.ts';
import { optionalAuth, requireAuth } from '../auth.ts';
import { toRig, toUsageProfile, type DbRigWithComponents } from '../mappers.ts';
import { INCLUDE_COMPONENTS, loadRigContext, recordSnapshot } from '../snapshots.ts';

/** Quem pode ver esta máquina, respeitando a configuração de privacidade do dono. */
async function canView(
  row: { ownerId: string; visibility: string },
  viewerId: string | undefined,
): Promise<boolean> {
  if (row.visibility === 'PUBLIC') return true;
  if (!viewerId) return false;
  if (row.ownerId === viewerId) return true;
  if (row.visibility === 'PRIVATE') return false;

  const follows = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: row.ownerId } },
  });
  return follows !== null;
}

const createRigBody = z.object({
  name: z.string().min(1).max(40),
  kind: z.enum(['desktop', 'laptop', 'console-pc', 'server']).default('desktop'),
  isPrimary: z.boolean().default(false),
});

const addComponentBody = z.object({
  componentId: z.string(),
  quantity: z.number().int().min(1).max(16).default(1),
  condition: z.enum(['new', 'like-new', 'used', 'worn']).default('new'),
  acquiredAt: z.iso.datetime().nullable().default(null),
  paidAmount: z.number().nonnegative().nullable().default(null),
  paidCurrency: z.string().length(3).nullable().default(null),
  notes: z.string().max(280).nullable().default(null),
  /// Quando informado, marca a peça antiga como substituída e gera a linha de evolução.
  replacesRigComponentId: z.string().nullable().default(null),
});

export async function rigRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  app.get('/rigs', { preHandler: requireAuth }, async (request) => {
    const rows = await prisma.rig.findMany({
      where: { ownerId: request.user!.id },
      include: { ...INCLUDE_COMPONENTS, owner: { include: { profile: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      rigs: rows.map((row) => {
        const rig = toRig(row as unknown as DbRigWithComponents);
        const profile = toUsageProfile(row.owner.profile, row.owner.region);
        const diagnosis = diagnose(rig, profile);
        const score = computeSetupScore(rig, profile, diagnosis);

        return {
          id: row.id,
          name: row.name,
          kind: row.kind,
          isPrimary: row.isPrimary,
          visibility: row.visibility,
          showValue: row.showValue,
          componentCount: rig.components.length,
          setupScore: score.total,
          tier: score.tier,
          verdict: diagnosis.verdict,
          status: oneLineStatus(diagnosis),
          estimatedFps: diagnosis.performance.fps?.fps ?? null,
        };
      }),
    };
  });

  app.post('/rigs', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createRigBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }

    const count = await prisma.rig.count({ where: { ownerId: request.user!.id } });
    // A primeira máquina é sempre a principal — não faz sentido perguntar.
    const isPrimary = count === 0 ? true : parsed.data.isPrimary;

    if (isPrimary && count > 0) {
      await prisma.rig.updateMany({
        where: { ownerId: request.user!.id },
        data: { isPrimary: false },
      });
    }

    const rig = await prisma.rig.create({
      data: { ...parsed.data, isPrimary, ownerId: request.user!.id },
    });

    return reply.code(201).send({ rig: { id: rig.id, name: rig.name, kind: rig.kind, isPrimary: rig.isPrimary } });
  });

  app.get('/rigs/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ctx = await loadRigContext(id);
    if (!ctx) return reply.code(404).send({ error: 'not_found' });
    if (!(await canView(ctx.row, request.user?.id))) {
      return reply.code(403).send({ error: 'forbidden', message: 'Essa máquina não é pública.' });
    }

    const isOwner = ctx.row.ownerId === request.user?.id;
    const diagnosis = diagnose(ctx.rig, ctx.profile);
    const score = computeSetupScore(ctx.rig, ctx.profile, diagnosis);
    const value = valuateRig(ctx.rig, ctx.profile.region);

    return {
      rig: {
        id: ctx.row.id,
        name: ctx.row.name,
        kind: ctx.row.kind,
        isPrimary: ctx.row.isPrimary,
        visibility: ctx.row.visibility,
        showValue: ctx.row.showValue,
        owner: {
          id: ctx.row.owner.id,
          handle: ctx.row.owner.handle,
          displayName: ctx.row.owner.displayName,
          avatarUrl: ctx.row.owner.avatarUrl,
        },
        components: ctx.row.components
          .filter((c) => c.removedAt === null)
          .map((c) => ({
            id: c.id,
            quantity: c.quantity,
            condition: c.condition,
            acquiredAt: c.acquiredAt,
            component: {
              id: c.component.id,
              category: c.component.category,
              brand: c.component.brand,
              model: c.component.model,
              fullName: c.component.fullName,
              spec: c.component.spec,
              releaseYear: c.component.releaseYear,
            },
          })),
      },
      score,
      diagnosis,
      // Valor só sai quando o dono liberou, ou para o próprio dono.
      value: isOwner || ctx.row.showValue ? value : null,
      isOwner,
    };
  });

  app.patch('/rigs/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(40).optional(),
        visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).optional(),
        showValue: z.boolean().optional(),
        isPrimary: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'validation' });

    const rig = await prisma.rig.findUnique({ where: { id } });
    if (!rig) return reply.code(404).send({ error: 'not_found' });
    if (rig.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    if (body.data.isPrimary) {
      await prisma.rig.updateMany({ where: { ownerId: request.user!.id }, data: { isPrimary: false } });
    }

    const updated = await prisma.rig.update({ where: { id }, data: body.data });
    return { rig: { id: updated.id, name: updated.name, visibility: updated.visibility, showValue: updated.showValue, isPrimary: updated.isPrimary } };
  });

  app.delete('/rigs/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rig = await prisma.rig.findUnique({ where: { id } });
    if (!rig) return reply.code(404).send({ error: 'not_found' });
    if (rig.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    await prisma.rig.delete({ where: { id } });
    return reply.code(204).send();
  });

  // -------------------------------------------------------------------------
  // Componentes
  // -------------------------------------------------------------------------

  app.post('/rigs/:id/components', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addComponentBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation', message: parsed.error.issues[0]?.message });
    }

    const rig = await prisma.rig.findUnique({ where: { id } });
    if (!rig) return reply.code(404).send({ error: 'not_found' });
    if (rig.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    const component = await prisma.component.findUnique({ where: { id: parsed.data.componentId } });
    if (!component) {
      return reply.code(400).send({ error: 'validation', message: 'Componente não encontrado no catálogo.' });
    }

    const { replacesRigComponentId, acquiredAt, ...rest } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const added = await tx.rigComponent.create({
        data: {
          ...rest,
          rigId: id,
          acquiredAt: acquiredAt ? new Date(acquiredAt) : null,
          replacedId: replacesRigComponentId,
        },
        include: { component: true },
      });

      // Substituição: a peça antiga sai da análise mas fica no histórico.
      if (replacesRigComponentId) {
        await tx.rigComponent.updateMany({
          where: { id: replacesRigComponentId, rigId: id, removedAt: null },
          data: { removedAt: new Date() },
        });
      }

      return added;
    });

    const snapshot = await recordSnapshot(id, replacesRigComponentId ? 'component-replaced' : 'component-added');

    return reply.code(201).send({
      rigComponent: { id: created.id, quantity: created.quantity, component: created.component },
      snapshot: snapshot ? { setupScore: snapshot.setupScore, verdict: snapshot.verdict } : null,
    });
  });

  app.delete('/rigs/:id/components/:componentId', { preHandler: requireAuth }, async (request, reply) => {
    const { id, componentId } = request.params as { id: string; componentId: string };

    const rig = await prisma.rig.findUnique({ where: { id } });
    if (!rig) return reply.code(404).send({ error: 'not_found' });
    if (rig.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    await prisma.$transaction(async (tx) => {
      await tx.rigComponent.updateMany({
        where: { id: componentId, rigId: id, removedAt: null },
        data: { removedAt: new Date() },
      });

      /**
       * Peça que saiu da máquina não pode continuar anunciada: o anúncio promete uma peça
       * específica deste PC, e sem ela a promessa deixou de existir. Retirar do ar, não
       * apagar — o vendedor ainda vê o próprio histórico.
       */
      await tx.listing.updateMany({
        where: { rigComponentId: componentId, status: { in: ['ACTIVE', 'RESERVED'] } },
        data: { status: 'WITHDRAWN' },
      });
    });

    await recordSnapshot(id, 'component-removed');
    return reply.code(204).send();
  });

  // -------------------------------------------------------------------------
  // Inteligência
  // -------------------------------------------------------------------------

  app.get('/rigs/:id/intelligence', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ctx = await loadRigContext(id);
    if (!ctx) return reply.code(404).send({ error: 'not_found' });
    if (!(await canView(ctx.row, request.user?.id))) return reply.code(403).send({ error: 'forbidden' });

    const diagnosis = diagnose(ctx.rig, ctx.profile);
    const score = computeSetupScore(ctx.rig, ctx.profile, diagnosis);

    /**
     * Cenários só para o achado principal que tenha ação de compra. Gerar cenário para
     * tudo transformaria o diagnóstico numa vitrine — e quando o veredito é saudável,
     * a resposta correta é não ter cenário nenhum.
     */
    const actionable = diagnosis.findings.find(
      (f) => f.category !== null && (f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium'),
    );

    const scenarios =
      actionable && (actionable.category === 'CPU' || actionable.category === 'GPU')
        ? buildScenarios(ctx.rig, ctx.profile, {
            category: actionable.category,
            maxBudget: ctx.profile.budget.amount,
          })
        : [];

    return { diagnosis, score, scenarios, profile: ctx.profile };
  });

  /**
   * PC Health — eixo próprio, rota própria.
   *
   * Separada de /intelligence de propósito: são perguntas diferentes, e juntá-las numa
   * resposta só faria a tela ter de escolher qual metade mostrar. Saúde também não
   * depende do perfil de uso — uma fonte velha é o mesmo risco para qualquer pessoa.
   */
  app.get('/rigs/:id/health', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ctx = await loadRigContext(id);
    if (!ctx) return reply.code(404).send({ error: 'not_found' });
    if (!(await canView(ctx.row, request.user?.id))) return reply.code(403).send({ error: 'forbidden' });

    return { health: assessHealth(ctx.rig) };
  });

  app.get('/rigs/:id/value', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ctx = await loadRigContext(id);
    if (!ctx) return reply.code(404).send({ error: 'not_found' });

    const isOwner = ctx.row.ownerId === request.user?.id;
    if (!isOwner && !(ctx.row.showValue && (await canView(ctx.row, request.user?.id)))) {
      return reply.code(403).send({ error: 'forbidden', message: 'O dono não tornou o valor público.' });
    }

    const value = valuateRig(ctx.rig, ctx.profile.region);
    const selling = isOwner
      ? ctx.rig.components
          .map((item) => {
            const guidance = suggestSellingPrice(item, ctx.profile.region);
            return guidance ? { rigComponentId: item.id, name: item.component.fullName, ...guidance } : null;
          })
          .filter((x) => x !== null)
      : [];

    return { value, selling };
  });

  /** Histórico de inteligência: a evolução da máquina ao longo do tempo. */
  app.get('/rigs/:id/history', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.rig.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    if (!(await canView(row, request.user?.id))) return reply.code(403).send({ error: 'forbidden' });

    const [snapshots, components] = await Promise.all([
      prisma.snapshot.findMany({ where: { rigId: id }, orderBy: { createdAt: 'asc' }, take: 100 }),
      prisma.rigComponent.findMany({
        where: { rigId: id },
        include: { component: true },
        orderBy: { addedAt: 'asc' },
      }),
    ]);

    /**
     * Linha do PC Evolution. Cada troca vira um passo com peça anterior e peça nova —
     * é o que a tela de perfil desenha como "RTX 3070 → RTX 3090 Ti".
     */
    const byId = new Map(components.map((c) => [c.id, c]));
    const evolution = components
      .filter((c) => c.replacedId !== null)
      .map((c) => {
        const previous = c.replacedId ? byId.get(c.replacedId) : undefined;
        return {
          at: c.addedAt,
          category: c.component.category,
          from: previous
            ? {
                name: previous.component.fullName,
                model: previous.component.model,
                usedFor: previous.removedAt
                  ? Math.round(
                      (previous.removedAt.getTime() - previous.addedAt.getTime()) / (86400 * 1000),
                    )
                  : null,
              }
            : null,
          to: { name: c.component.fullName, model: c.component.model },
          paidAmount: c.paidAmount,
          paidCurrency: c.paidCurrency,
        };
      })
      .filter((e) => e.from !== null);

    return {
      snapshots: snapshots.map((s) => ({
        id: s.id,
        at: s.createdAt,
        setupScore: s.setupScore,
        verdict: s.verdict,
        estimatedFps: s.estimatedFps,
        valueTotal: s.valueTotal,
        trigger: s.trigger,
        summary: s.summary,
      })),
      evolution,
    };
  });

  /** Comparação PC vs PC. */
  app.get('/rigs/:id/compare/:otherId', { preHandler: optionalAuth }, async (request, reply) => {
    const { id, otherId } = request.params as { id: string; otherId: string };
    const [left, right] = await Promise.all([loadRigContext(id), loadRigContext(otherId)]);
    if (!left || !right) return reply.code(404).send({ error: 'not_found' });

    if (!(await canView(left.row, request.user?.id)) || !(await canView(right.row, request.user?.id))) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    // O perfil de quem pergunta é o que define "melhor" — a comparação é contextual.
    const viewerProfile = request.user
      ? await prisma.profile.findUnique({ where: { userId: request.user.id } })
      : null;
    const profile = viewerProfile
      ? toUsageProfile(viewerProfile, left.profile.region)
      : left.profile;

    return {
      comparison: compareRigs(left.rig, right.rig, profile),
      left: { id: left.row.id, name: left.row.name, owner: left.row.ownerId },
      right: { id: right.row.id, name: right.row.name, owner: right.row.ownerId },
    };
  });

  /** Cenários sob demanda para qualquer categoria — usado pela tela de upgrade. */
  app.get('/rigs/:id/scenarios/:category', { preHandler: requireAuth }, async (request, reply) => {
    const { id, category } = request.params as { id: string; category: string };
    const parsed = z.enum(HARDWARE_CATEGORIES).safeParse(category);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });

    const ctx = await loadRigContext(id);
    if (!ctx) return reply.code(404).send({ error: 'not_found' });
    if (ctx.row.ownerId !== request.user!.id) return reply.code(403).send({ error: 'forbidden' });

    const budget = (request.query as { budget?: string }).budget;
    return {
      scenarios: buildScenarios(ctx.rig, ctx.profile, {
        category: parsed.data,
        maxBudget: budget ? Number(budget) : ctx.profile.budget.amount,
      }),
    };
  });
}

export { recordSnapshot };
