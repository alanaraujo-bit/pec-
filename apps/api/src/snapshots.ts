/**
 * Retratos da máquina.
 *
 * Vive fora de `routes/rigs.ts` porque mais de uma rota provoca uma mudança relevante no
 * PC: adicionar peça, trocar peça, remover peça e — desde o marketplace — vender peça.
 * Se cada rota gravasse seu próprio retrato, uma delas acabaria gravando diferente, e o
 * histórico passaria a discordar da tela. Um lugar só, uma verdade só.
 */

import { computeSetupScore, diagnose, valuateRig } from '@pece/core';

import { prisma } from './db.ts';
import { toRig, toUsageProfile, type DbRigWithComponents } from './mappers.ts';

export const INCLUDE_COMPONENTS = {
  components: { include: { component: true }, orderBy: { addedAt: 'asc' as const } },
};

/** Carrega a máquina e o perfil de uso do dono — o par que o engine sempre precisa. */
export async function loadRigContext(rigId: string) {
  const row = await prisma.rig.findUnique({
    where: { id: rigId },
    include: { ...INCLUDE_COMPONENTS, owner: { include: { profile: true } } },
  });
  if (!row) return null;

  const rig = toRig(row as unknown as DbRigWithComponents);
  const profile = toUsageProfile(row.owner.profile, row.owner.region);
  return { row, rig, profile };
}

/**
 * Grava um retrato do estado da máquina. É o que transforma o app em memória viva do PC:
 * cada mudança relevante fica registrada com o diagnóstico daquele momento.
 */
export async function recordSnapshot(rigId: string, trigger: string) {
  const ctx = await loadRigContext(rigId);
  if (!ctx) return null;

  const diagnosis = diagnose(ctx.rig, ctx.profile);
  const score = computeSetupScore(ctx.rig, ctx.profile, diagnosis);
  const value = valuateRig(ctx.rig, ctx.profile.region);

  return prisma.snapshot.create({
    data: {
      rigId,
      setupScore: score.total,
      verdict: diagnosis.verdict,
      estimatedFps: diagnosis.performance.fps?.fps ?? null,
      valueTotal: value.total,
      currency: value.currency,
      trigger,
      summary: {
        headline: diagnosis.headline,
        findingCount: diagnosis.findings.length,
        topFinding: diagnosis.findings[0]
          ? {
              id: diagnosis.findings[0].id,
              what: diagnosis.findings[0].what,
              severity: diagnosis.findings[0].severity,
            }
          : null,
        dimensions: score.dimensions.map((d) => ({ dimension: d.dimension, score: d.score })),
      },
    },
  });
}
