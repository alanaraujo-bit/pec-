/**
 * Setup Score.
 *
 * Requisito central do produto: o score NÃO pode simplesmente premiar quem gastou mais.
 * Um PC de R$8.000 bem casado e adequado ao objetivo do dono precisa poder vencer um de
 * R$20.000 desequilibrado.
 *
 * Conseguimos isso porque só uma das cinco dimensões (`power`) olha para desempenho bruto.
 * As outras quatro medem qualidade de decisão: se as peças conversam entre si, se a máquina
 * serve ao que a pessoa realmente faz, se o conjunto é sadio e se entrega desempenho por watt.
 * Dinheiro entra apenas indiretamente, e nunca sozinho.
 *
 * O score também precisa ser explicável: cada dimensão devolve nota, peso e um motivo em
 * português. Um número solto não constrói confiança.
 */

import type { Rig } from '../rig/types.ts';
import { resolveParts } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { gamingShare } from '../profile/types.ts';
import { diagnose, type Diagnosis } from '../engine/diagnosis.ts';
import { wastedPotential } from '../engine/performance.ts';
import { computePowerBudget } from '../engine/subsystems.ts';

export type ScoreDimension = 'power' | 'balance' | 'fitness' | 'health' | 'efficiency';

export interface DimensionScore {
  dimension: ScoreDimension;
  /** 0–100. */
  score: number;
  /** Peso na nota final. Soma 1 entre as dimensões. */
  weight: number;
  label: string;
  /** Por que essa nota. Sempre presente — score sem explicação não gera confiança. */
  reason: string;
}

export interface SetupScore {
  /** 0–100. */
  total: number;
  tier: 'entry' | 'solid' | 'strong' | 'excellent' | 'elite';
  dimensions: DimensionScore[];
  /** A dimensão que mais está puxando a nota para baixo. */
  weakest: ScoreDimension | null;
  /** Quanto a nota subiria se o achado principal fosse resolvido. */
  potentialGain: number;
}

const WEIGHTS: Record<ScoreDimension, number> = {
  power: 0.26,
  balance: 0.24,
  fitness: 0.24,
  health: 0.16,
  efficiency: 0.1,
};

const LABEL: Record<ScoreDimension, string> = {
  power: 'Desempenho',
  balance: 'Equilíbrio',
  fitness: 'Adequação ao seu uso',
  health: 'Saúde do conjunto',
  efficiency: 'Eficiência',
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Desempenho bruto, em escala comprimida.
 *
 * A compressão (raiz) é deliberada: dobrar o índice bruto não dobra a nota. Sem isso,
 * a dimensão viraria um ranking de preço disfarçado e o score inteiro perderia o sentido.
 */
function scorePower(rig: Rig): DimensionScore {
  const parts = resolveParts(rig);
  const cpu = parts.cpu?.spec.performance.gaming ?? 0;
  const gpu = parts.gpu?.spec.performance.raster ?? 0;

  if (!parts.cpu || !parts.gpu) {
    return {
      dimension: 'power',
      score: 0,
      weight: WEIGHTS.power,
      label: LABEL.power,
      reason: 'Cadastre processador e placa de vídeo para medirmos o desempenho.',
    };
  }

  const raw = (cpu + gpu) / 2;
  const score = clamp(Math.sqrt(raw / 100) * 100);

  return {
    dimension: 'power',
    score: Math.round(score),
    weight: WEIGHTS.power,
    label: LABEL.power,
    reason:
      score > 75
        ? 'Conjunto de alto desempenho.'
        : score > 50
          ? 'Bom desempenho para a maioria dos usos.'
          : 'Desempenho de entrada.',
  };
}

/**
 * Equilíbrio. É aqui que a máquina cara e mal montada perde para a barata e bem pensada.
 */
function scoreBalance(diagnosis: Diagnosis): DimensionScore {
  const fps = diagnosis.performance.fps;

  if (!fps) {
    return {
      dimension: 'balance',
      score: 50,
      weight: WEIGHTS.balance,
      label: LABEL.balance,
      reason: 'Cadastro incompleto para avaliar o equilíbrio entre as peças.',
    };
  }

  /**
   * Usa o desperdício DIRECIONAL, não o desequilíbrio bruto: estar limitado pela GPU é
   * o estado normal de um PC de jogo e não pode derrubar a nota. A mesma função alimenta
   * o diagnóstico, então score e recomendação nunca contam histórias diferentes.
   */
  let score = clamp(100 - wastedPotential(fps) * 165);

  // Canal simples de memória e falta de SSD são desequilíbrios de conjunto, não de potência.
  const structural = diagnosis.findings.filter(
    (f) => f.id === 'memory-single-channel' || f.id === 'storage-no-ssd',
  );
  score = clamp(score - structural.length * 12);

  return {
    dimension: 'balance',
    score: Math.round(score),
    weight: WEIGHTS.balance,
    label: LABEL.balance,
    reason:
      score > 85
        ? 'As peças estão bem casadas — nenhuma está segurando as outras.'
        : score > 60
          ? 'Equilíbrio razoável, com folga desperdiçada em um ponto.'
          : fps.limitedBy === 'cpu'
            ? 'O processador está segurando a placa de vídeo.'
            : 'A placa de vídeo está segurando o resto da máquina.',
  };
}

/** Adequação: a máquina serve ao que a pessoa realmente faz? */
function scoreFitness(diagnosis: Diagnosis, profile: UsageProfile): DimensionScore {
  const fps = diagnosis.performance.fps;
  const production = diagnosis.performance.production;
  const gaming = gamingShare(profile);

  let score: number;
  let reason: string;

  if (fps && profile.targetFps !== null && gaming > 0.3) {
    const ratio = fps.fps / profile.targetFps;
    // Passar do alvo é bom, mas passar muito não vale nota extra — é excesso.
    score = clamp(ratio >= 1 ? 90 + Math.min(10, (ratio - 1) * 20) : ratio * 90);
    reason =
      ratio >= 1
        ? `Entrega os ${profile.targetFps} FPS que você quer em ${profile.resolution}.`
        : `Chega a ${Math.round(ratio * 100)}% do seu alvo de ${profile.targetFps} FPS.`;
  } else if (fps && gaming > 0.3) {
    score = clamp(fps.fps > 144 ? 95 : fps.fps > 100 ? 85 : fps.fps > 60 ? 72 : fps.fps > 40 ? 50 : 28);
    reason = `Cerca de ${fps.fps} FPS em ${profile.resolution} no seu uso principal.`;
  } else if (production.length > 0) {
    score = production.reduce((sum, p) => sum + p.score, 0) / production.length;
    reason = 'Avaliado pela sua carga de trabalho, não por FPS.';
  } else {
    score = 50;
    reason = 'Complete o seu perfil de uso para avaliarmos a adequação.';
  }

  // Um alvo não atingido já pesa acima; não penalizamos duas vezes pelo mesmo motivo.
  return {
    dimension: 'fitness',
    score: Math.round(score),
    weight: WEIGHTS.fitness,
    label: LABEL.fitness,
    reason,
  };
}

/** Saúde: fonte, térmica, armazenamento e compatibilidade. */
function scoreHealth(diagnosis: Diagnosis): DimensionScore {
  const penalty: Record<string, number> = { critical: 45, high: 22, medium: 10, low: 3, none: 0 };
  const relevant = diagnosis.findings.filter((f) =>
    ['power', 'thermal', 'compatibility', 'storage'].includes(f.kind),
  );
  const score = clamp(100 - relevant.reduce((sum, f) => sum + (penalty[f.severity] ?? 0), 0));

  return {
    dimension: 'health',
    score: Math.round(score),
    weight: WEIGHTS.health,
    label: LABEL.health,
    reason:
      score > 90
        ? 'Fonte, refrigeração e armazenamento em ordem.'
        : score > 65
          ? 'Um ponto de atenção na saúde do conjunto.'
          : 'Há questões de fonte ou refrigeração para resolver.',
  };
}

/** Eficiência: desempenho por watt. Premia quem escolheu peças modernas e bem casadas. */
function scoreEfficiency(rig: Rig): DimensionScore {
  const parts = resolveParts(rig);
  const budget = computePowerBudget(parts);

  if (!parts.cpu || !parts.gpu || budget.estimatedLoadWatts === 0) {
    return {
      dimension: 'efficiency',
      score: 50,
      weight: WEIGHTS.efficiency,
      label: LABEL.efficiency,
      reason: 'Cadastro incompleto para avaliar eficiência.',
    };
  }

  const performance = (parts.cpu.spec.performance.gaming + parts.gpu.spec.performance.raster) / 2;
  const perWatt = performance / budget.estimatedLoadWatts;
  // ~0.13 pontos de índice por watt é a referência de um conjunto moderno e eficiente.
  let score = clamp((perWatt / 0.13) * 100);

  const psu = parts.psu?.spec.efficiencyRating;
  if (psu === '80+ Gold' || psu === '80+ Platinum' || psu === '80+ Titanium') score = clamp(score + 6);
  else if (psu === 'None') score = clamp(score - 8);

  return {
    dimension: 'efficiency',
    score: Math.round(score),
    weight: WEIGHTS.efficiency,
    label: LABEL.efficiency,
    reason:
      score > 80
        ? 'Entrega bastante desempenho para o consumo que tem.'
        : score > 55
          ? 'Eficiência dentro do esperado.'
          : 'Consome bastante para o desempenho que entrega.',
  };
}

export function computeSetupScore(rig: Rig, profile: UsageProfile, diagnosis?: Diagnosis): SetupScore {
  const diag = diagnosis ?? diagnose(rig, profile);

  const dimensions: DimensionScore[] = [
    scorePower(rig),
    scoreBalance(diag),
    scoreFitness(diag, profile),
    scoreHealth(diag),
    scoreEfficiency(rig),
  ];

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0));

  const weakest = dimensions.reduce((min, d) =>
    d.score * d.weight < min.score * min.weight ? d : min,
  );

  /**
   * Ganho potencial: quanto a nota subiria se o gargalo sumisse. Serve para o produto
   * mostrar "resolver isso te levaria de 68 para 81" em vez de um número abstrato.
   */
  const balanceDim = dimensions.find((d) => d.dimension === 'balance')!;
  const potentialGain = Math.round((100 - balanceDim.score) * WEIGHTS.balance);

  return {
    total,
    tier: total >= 88 ? 'elite' : total >= 75 ? 'excellent' : total >= 60 ? 'strong' : total >= 42 ? 'solid' : 'entry',
    dimensions,
    weakest: weakest.score < 70 ? weakest.dimension : null,
    potentialGain,
  };
}

export const TIER_LABEL: Record<SetupScore['tier'], string> = {
  entry: 'Entrada',
  solid: 'Sólido',
  strong: 'Forte',
  excellent: 'Excelente',
  elite: 'Elite',
};
