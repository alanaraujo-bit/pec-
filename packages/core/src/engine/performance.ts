/**
 * Modelo de performance.
 *
 * Estima FPS a partir dos índices normalizados do catálogo. É um MODELO, não uma medição:
 * toda saída carrega um nível de confiança e o produto é obrigado a apresentá-la como
 * estimativa. Preferimos dizer "não temos dados suficientes" a inventar um número bonito.
 *
 * Calibração
 * ----------
 * Os coeficientes abaixo foram ajustados contra pares CPU/GPU conhecidos, com a escala
 * ancorada em `raster = 100` (RTX 5090) e `gaming = 100` (Ryzen 7 9800X3D). Os testes em
 * `performance.test.ts` travam esses pontos de calibração: se alguém mexer num coeficiente
 * e quebrar a realidade, o teste acusa.
 *
 * Propriedade importante que o modelo precisa preservar: um gargalo de CPU **diminui**
 * conforme a resolução sobe, porque o custo de CPU por frame não depende de resolução.
 * É o detalhe que separa uma recomendação correta de um chute.
 */

import type { GpuSpec, CpuSpec } from '../catalog/types.ts';
import type { Resolution, UsageProfile, WorkloadKind } from '../profile/types.ts';
import { normalizedWorkloads } from '../profile/types.ts';

/** Multiplicador de pixels, relativo a 1440p. */
const RESOLUTION_COEF: Record<Resolution, number> = {
  '1080p': 1.55,
  '1440p': 1.0,
  'ultrawide-1440p': 0.78,
  '4K': 0.62,
};

interface WorkloadCoef {
  /** FPS por ponto de índice de raster, a 1440p. */
  gpu: number;
  /** FPS por ponto de índice de jogo do CPU. Independente de resolução, de propósito. */
  cpu: number;
}

/** Apenas as cargas que produzem FPS. As demais são avaliadas por capacidade, não por frames. */
const GAMING_COEF: Partial<Record<WorkloadKind, WorkloadCoef>> = {
  'competitive-gaming': { gpu: 6.0, cpu: 7.5 },
  'aaa-gaming': { gpu: 1.95, cpu: 1.9 },
  'casual-gaming': { gpu: 4.0, cpu: 5.0 },
  // Live consome CPU/GPU do jogo; tratamos como AAA com folga menor.
  streaming: { gpu: 1.8, cpu: 1.55 },
};

/** VRAM mínima confortável por resolução, em jogos pesados. */
const VRAM_COMFORT: Record<Resolution, number> = {
  '1080p': 8,
  '1440p': 10,
  'ultrawide-1440p': 12,
  '4K': 12,
};

export type Confidence = 'high' | 'medium' | 'low';

export interface FpsEstimate {
  /** FPS médio estimado. */
  fps: number;
  /** Teto imposto pela GPU isoladamente. */
  gpuBoundFps: number;
  /** Teto imposto pelo CPU isoladamente. */
  cpuBoundFps: number;
  limitedBy: 'cpu' | 'gpu' | 'balanced';
  /**
   * 0 = perfeitamente equilibrado. 1 = o componente limitante está segurando
   * completamente o outro. É a métrica de gargalo do produto.
   */
  bottleneckSeverity: number;
  /** Penalidade aplicada por VRAM insuficiente (0 = nenhuma). */
  vramPenalty: number;
  confidence: Confidence;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Penalidade de VRAM. Faltar VRAM não reduz FPS de forma linear — ela colapsa o
 * frametime quando estoura. Modelamos como degradação acelerada abaixo do confortável.
 */
function vramPenaltyFor(gpu: GpuSpec, resolution: Resolution, workload: WorkloadKind): number {
  if (workload === 'competitive-gaming' || workload === 'casual-gaming') return 0;
  const comfort = VRAM_COMFORT[resolution];
  if (gpu.vramGb >= comfort) return 0;
  const deficit = (comfort - gpu.vramGb) / comfort;
  return clamp(deficit * 1.4, 0, 0.55);
}

/**
 * Combina os dois tetos. Não usamos `min` puro: na prática nenhum dos dois é um teto
 * perfeito, e o frametime real fica levemente abaixo do menor deles quando os dois
 * estão próximos. A mistura suave evita o degrau artificial que um `min` produziria.
 */
function blendCeilings(gpuFps: number, cpuFps: number): number {
  const lower = Math.min(gpuFps, cpuFps);
  const higher = Math.max(gpuFps, cpuFps);
  if (higher === 0) return 0;
  const closeness = lower / higher;
  // Quando os dois estão a menos de ~15% de distância, há custo de sobreposição.
  const overlapCost = 1 - 0.06 * closeness;
  return lower * overlapCost;
}

export function estimateFps(
  cpu: CpuSpec,
  gpu: GpuSpec,
  resolution: Resolution,
  workload: WorkloadKind,
): FpsEstimate | null {
  const coef = GAMING_COEF[workload];
  if (!coef) return null;

  const penalty = vramPenaltyFor(gpu, resolution, workload);
  const gpuBoundFps = gpu.performance.raster * coef.gpu * RESOLUTION_COEF[resolution] * (1 - penalty);
  const cpuBoundFps = cpu.performance.gaming * coef.cpu;

  const fps = blendCeilings(gpuBoundFps, cpuBoundFps);
  const lower = Math.min(gpuBoundFps, cpuBoundFps);
  const higher = Math.max(gpuBoundFps, cpuBoundFps);
  const severity = higher > 0 ? clamp(1 - lower / higher, 0, 1) : 0;

  // Abaixo de 8% de diferença, chamar de "gargalo" seria exagero — e o produto não
  // pode inventar urgência para gerar movimento.
  const limitedBy: FpsEstimate['limitedBy'] =
    severity < 0.08 ? 'balanced' : gpuBoundFps < cpuBoundFps ? 'gpu' : 'cpu';

  return {
    fps: Math.round(fps),
    gpuBoundFps: Math.round(gpuBoundFps),
    cpuBoundFps: Math.round(cpuBoundFps),
    limitedBy,
    bottleneckSeverity: severity,
    vramPenalty: penalty,
    confidence: penalty > 0.3 ? 'low' : 'medium',
  };
}

/**
 * Desequilíbrio DIRECIONAL — e a assimetria aqui é física, não uma opinião.
 *
 * Estar limitado pela GPU é o estado normal e desejável de qualquer PC de jogo: significa
 * que a placa de vídeo está sendo usada até o fim. Estar limitado pelo CPU é diferente —
 * aí existe desempenho de GPU já comprado e parado, esperando o processador.
 *
 * Tratar os dois casos com o mesmo peso faria o produto acusar de "desequilibrado" um
 * 7800X3D com uma 4070 Super, que é justamente uma das combinações mais bem casadas que
 * existem. Por isso o caso limitado por GPU pesa uma fração do outro: ele só representa
 * ter gastado um pouco a mais no processador, não desempenho perdido.
 */
export function wastedPotential(estimate: FpsEstimate): number {
  if (estimate.limitedBy === 'cpu') return estimate.bottleneckSeverity;
  if (estimate.limitedBy === 'gpu') return estimate.bottleneckSeverity * 0.35;
  return 0;
}

/** FPS ponderado pelas cargas de jogo do perfil, para uma visão única. */
export interface WeightedFps {
  byWorkload: Array<{ workload: WorkloadKind; share: number; estimate: FpsEstimate }>;
  /** FPS do uso principal de jogo. É o número que aparece na interface. */
  headline: { workload: WorkloadKind; estimate: FpsEstimate } | null;
}

export function estimateProfileFps(
  cpu: CpuSpec,
  gpu: GpuSpec,
  profile: UsageProfile,
): WeightedFps {
  const byWorkload = normalizedWorkloads(profile)
    .map((w) => {
      const estimate = estimateFps(cpu, gpu, profile.resolution, w.kind);
      return estimate ? { workload: w.kind, share: w.share, estimate } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const headline = byWorkload.reduce<WeightedFps['headline']>((best, cur) => {
    if (!best) return { workload: cur.workload, estimate: cur.estimate };
    const bestShare = byWorkload.find((w) => w.workload === best.workload)?.share ?? 0;
    return cur.share > bestShare ? { workload: cur.workload, estimate: cur.estimate } : best;
  }, null);

  return { byWorkload, headline };
}

// ---------------------------------------------------------------------------
// Cargas de produção
// ---------------------------------------------------------------------------

/**
 * Cargas não-jogo não têm FPS. Avaliamos capacidade numa escala 0–100 com o eixo certo
 * para cada tipo de trabalho — o erro clássico aqui é julgar edição de vídeo pelo
 * índice de jogo do processador.
 */
export interface CapabilityRating {
  workload: WorkloadKind;
  score: number;
  /** O componente que mais limita esta carga específica. */
  limitedBy: 'cpu' | 'gpu' | 'ram' | 'storage';
}

export function rateProductionWorkload(
  workload: WorkloadKind,
  cpu: CpuSpec,
  gpu: GpuSpec | null,
  totalRamGb: number,
  hasFastStorage: boolean,
): CapabilityRating | null {
  const gpuRaster = gpu?.performance.raster ?? 0;

  const weights: Partial<
    Record<WorkloadKind, { cpuMulti: number; cpuSingle: number; gpu: number; ramGb: number }>
  > = {
    'video-editing': { cpuMulti: 0.4, cpuSingle: 0.1, gpu: 0.3, ramGb: 32 },
    '3d-rendering': { cpuMulti: 0.45, cpuSingle: 0.05, gpu: 0.35, ramGb: 32 },
    'game-development': { cpuMulti: 0.35, cpuSingle: 0.25, gpu: 0.2, ramGb: 32 },
    programming: { cpuMulti: 0.35, cpuSingle: 0.35, gpu: 0.0, ramGb: 16 },
    productivity: { cpuMulti: 0.2, cpuSingle: 0.5, gpu: 0.0, ramGb: 16 },
  };

  const w = weights[workload];
  if (!w) return null;

  const ramScore = clamp(totalRamGb / w.ramGb, 0, 1) * 100;
  const storageScore = hasFastStorage ? 100 : 55;
  const ramWeight = 1 - (w.cpuMulti + w.cpuSingle + w.gpu);

  const score =
    cpu.performance.multiThread * w.cpuMulti +
    cpu.performance.singleThread * w.cpuSingle +
    gpuRaster * w.gpu +
    ((ramScore + storageScore) / 2) * ramWeight;

  const candidates: Array<{ key: CapabilityRating['limitedBy']; value: number }> = [
    { key: 'cpu', value: (cpu.performance.multiThread + cpu.performance.singleThread) / 2 },
    { key: 'ram', value: ramScore },
    { key: 'storage', value: storageScore },
  ];
  if (w.gpu > 0) candidates.push({ key: 'gpu', value: gpuRaster });

  const limitedBy = candidates.reduce((min, cur) => (cur.value < min.value ? cur : min)).key;

  return { workload, score: Math.round(clamp(score, 0, 100)), limitedBy };
}
