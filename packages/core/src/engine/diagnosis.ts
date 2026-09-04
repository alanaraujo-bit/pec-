/**
 * Orquestrador da inteligência: junta todos os módulos de análise e produz o diagnóstico.
 *
 * Regra inegociável do produto, implementada aqui: quando não há nada relevante a fazer,
 * a saída correta é dizer isso. `verdict: 'healthy'` não é um caso de borda nem um estado
 * vazio — é um resultado de primeira classe, com texto próprio. Um sistema que sempre
 * encontra algo para vender não é um sistema de recomendação, é um funil.
 */

import type { Rig, RigParts } from '../rig/types.ts';
import { completenessOf, resolveParts } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { normalizedWorkloads, primaryWorkload, WORKLOAD_LABEL } from '../profile/types.ts';
import { finding, sortFindings, type Finding, type Severity } from './findings.ts';
import { estimateProfileFps, rateProductionWorkload, type FpsEstimate } from './performance.ts';
import { analyzeCompatibility } from './compatibility.ts';
import {
  analyzeDisplay,
  analyzeMemory,
  analyzePower,
  analyzeStorage,
  analyzeThermals,
  computePowerBudget,
  type PowerBudget,
} from './subsystems.ts';

export type Verdict = 'healthy' | 'minor-improvements' | 'attention-needed' | 'critical';

export interface Diagnosis {
  verdict: Verdict;
  /** Frase única de abertura. É o que o usuário lê primeiro. */
  headline: string;
  /** Contexto de uma ou duas frases abaixo da headline. */
  summary: string;

  findings: Finding[];
  /** Componentes explicitamente aprovados. Dizer "sua GPU está ótima" tem valor. */
  approved: Array<{ category: string; label: string; reason: string }>;

  performance: {
    fps: FpsEstimate | null;
    workloadLabel: string | null;
    /** Se o alvo de FPS do perfil está sendo atingido. `null` se não há alvo. */
    meetsTarget: boolean | null;
    production: NonNullable<ReturnType<typeof rateProductionWorkload>>[];
  };
  power: PowerBudget;

  /** O que impede uma análise completa. Vazio quando o cadastro está suficiente. */
  limitations: string[];
}

/** Achado nº 1 do produto: o gargalo entre CPU e GPU no uso real da pessoa. */
function analyzeBottleneck(
  parts: RigParts,
  profile: UsageProfile,
  fps: FpsEstimate | null,
): Finding[] {
  if (!fps || !parts.cpu || !parts.gpu) return [];
  if (fps.limitedBy === 'balanced') return [];

  const workload = WORKLOAD_LABEL[primaryWorkload(profile)].title.toLowerCase();
  const isCpu = fps.limitedBy === 'cpu';
  const other = isCpu ? parts.gpu : parts.cpu;
  const severityPct = Math.round(fps.bottleneckSeverity * 100);

  /**
   * A assimetria que impede o produto de inventar problema.
   *
   * Limitado por CPU é sempre um achado: existe GPU comprada e ociosa.
   * Limitado por GPU só é um achado quando a pessoa NÃO está atingindo o que queria —
   * caso contrário, é simplesmente um PC funcionando como deveria. Sem essa distinção,
   * todo PC de jogo do mundo seria acusado de ter um gargalo de placa de vídeo.
   */
  let severity: Severity;
  if (isCpu) {
    if (fps.bottleneckSeverity >= 0.35) severity = 'high';
    else if (fps.bottleneckSeverity >= 0.2) severity = 'medium';
    else severity = 'low';
  } else {
    if (profile.targetFps === null || fps.fps >= profile.targetFps) return [];
    const shortfall = 1 - fps.fps / profile.targetFps;
    if (shortfall >= 0.35) severity = 'high';
    else if (shortfall >= 0.15) severity = 'medium';
    else severity = 'low';
  }

  const potentialFps = isCpu ? fps.gpuBoundFps : fps.cpuBoundFps;
  const gain = Math.round(((potentialFps - fps.fps) / Math.max(fps.fps, 1)) * 100);

  return [
    finding({
      id: isCpu ? 'bottleneck-cpu' : 'bottleneck-gpu',
      kind: 'bottleneck',
      category: isCpu ? 'CPU' : 'GPU',
      severity,
      what: isCpu ? 'Trocar o processador.' : 'Trocar a placa de vídeo.',
      why: isCpu
        ? `Em ${workload}, o seu processador entrega no máximo cerca de ${fps.cpuBoundFps} quadros por segundo, enquanto a sua ${other.model} conseguiria chegar a ${fps.gpuBoundFps}. Sua placa de vídeo passa parte do tempo esperando o processador — você já pagou por um desempenho que não está conseguindo usar.`
        : `Em ${workload}, a sua placa de vídeo entrega cerca de ${fps.gpuBoundFps} quadros por segundo, enquanto o seu ${other.model} daria conta de ${fps.cpuBoundFps}. Aqui a placa de vídeo é quem segura o conjunto.`,
      how: isCpu
        ? `Um processador mais forte no mesmo soquete ${parts.cpu.spec.socket}, se existir, é o caminho mais barato. Vale conferir também se a memória está em canal duplo antes de trocar.`
        : `Uma placa de vídeo mais forte destravaria o restante da máquina. Como o resto do PC já dá conta, o ganho aqui vem inteiro.`,
      technical: [
        `Teto de CPU: ${fps.cpuBoundFps} FPS`,
        `Teto de GPU: ${fps.gpuBoundFps} FPS`,
        `Desequilíbrio: ${severityPct}%`,
        `Resolução considerada: ${profile.resolution}`,
        isCpu
          ? 'Gargalos de processador diminuem em resoluções maiores, porque o custo por quadro do processador não muda com a resolução.'
          : 'Gargalos de placa de vídeo aumentam em resoluções maiores.',
      ],
      confidence: fps.confidence,
      expectedGain: gain > 5 ? `Até +${gain}% de FPS` : null,
      impactScore: 40 + severityPct * 0.6,
    }),
  ];
}

/**
 * O PC atinge o alvo que o usuário pediu?
 *
 * Só entra quando o gargalo já não explicou o mesmo problema — repetir a mesma questão
 * em dois achados diferentes inflaria artificialmente a sensação de que há muito errado.
 */
function analyzeTarget(
  profile: UsageProfile,
  fps: FpsEstimate | null,
  bottleneckFound: boolean,
): Finding[] {
  if (!fps || profile.targetFps === null || bottleneckFound) return [];
  if (fps.fps >= profile.targetFps) return [];

  const deficit = profile.targetFps - fps.fps;
  const ratio = fps.fps / profile.targetFps;

  return [
    finding({
      id: 'target-miss',
      kind: 'target-miss',
      severity: ratio < 0.6 ? 'high' : 'medium',
      what: `Seu PC ainda não alcança os ${profile.targetFps} FPS que você quer.`,
      why: `A estimativa é de cerca de ${fps.fps} quadros por segundo em ${profile.resolution}, ou seja, ${deficit} abaixo do seu alvo. O componente que mais segura hoje é ${fps.limitedBy === 'cpu' ? 'o processador' : 'a placa de vídeo'}.`,
      how:
        ratio > 0.8
          ? 'Você está perto. Baixar uma ou duas opções gráficas pesadas provavelmente já fecha a diferença, sem gastar nada.'
          : 'Resolver o componente que está limitando é o caminho. Veja os cenários de upgrade para comparar as opções.',
      technical: [
        `FPS estimado: ${fps.fps}`,
        `FPS alvo: ${profile.targetFps}`,
        `Atingido: ${Math.round(ratio * 100)}% do alvo`,
      ],
      confidence: fps.confidence,
      impactScore: 30 + (1 - ratio) * 40,
    }),
  ];
}

/**
 * Componentes que estão bons. O produto precisa dizer isso em voz alta — é o que
 * diferencia uma análise honesta de um catálogo de vendas.
 */
function collectApproved(
  parts: RigParts,
  findings: Finding[],
  fps: FpsEstimate | null,
): Diagnosis['approved'] {
  const flagged = new Set(findings.filter((f) => f.severity !== 'none' && f.severity !== 'low').map((f) => f.category));
  const approved: Diagnosis['approved'] = [];

  if (parts.gpu && !flagged.has('GPU')) {
    approved.push({
      category: 'GPU',
      label: parts.gpu.model,
      reason:
        fps && fps.limitedBy === 'cpu'
          ? 'Está entregando mais do que o resto da máquina consegue aproveitar. Nenhuma mudança necessária.'
          : 'Adequada para o seu uso. Nenhuma mudança necessária.',
    });
  }
  if (parts.cpu && !flagged.has('CPU')) {
    approved.push({
      category: 'CPU',
      label: parts.cpu.model,
      reason:
        fps && fps.limitedBy === 'gpu'
          ? 'Sobra folga para a sua placa de vídeo atual. Nenhuma mudança necessária.'
          : 'Dá conta do seu perfil de uso. Nenhuma mudança necessária.',
    });
  }
  if (parts.ramModules.length > 0 && !flagged.has('RAM')) {
    approved.push({
      category: 'RAM',
      label: `${parts.totalRamGb} GB`,
      reason: 'Capacidade e configuração adequadas ao seu uso.',
    });
  }
  if (parts.psu && !flagged.has('PSU')) {
    approved.push({
      category: 'PSU',
      label: `${parts.psu.spec.wattage}W`,
      reason: 'Potência com folga confortável para as suas peças.',
    });
  }
  if (parts.drives.length > 0 && !flagged.has('STORAGE')) {
    approved.push({
      category: 'STORAGE',
      label: `${parts.totalStorageGb} GB`,
      reason: 'Velocidade e espaço adequados.',
    });
  }
  if (parts.cooler && !flagged.has('COOLER')) {
    approved.push({
      category: 'COOLER',
      label: parts.cooler.model,
      reason: 'Refrigeração suficiente para o seu processador.',
    });
  }

  return approved;
}

function buildVerdict(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === 'critical')) return 'critical';
  if (findings.some((f) => f.severity === 'high')) return 'attention-needed';
  if (findings.some((f) => f.severity === 'medium')) return 'minor-improvements';
  return 'healthy';
}

function buildNarrative(
  verdict: Verdict,
  findings: Finding[],
  parts: RigParts,
  profile: UsageProfile,
  fps: FpsEstimate | null,
): { headline: string; summary: string } {
  const top = findings[0];
  const workload = WORKLOAD_LABEL[primaryWorkload(profile)].title.toLowerCase();

  switch (verdict) {
    case 'critical':
      return {
        headline: top?.what ?? 'Seu PC precisa de atenção imediata.',
        summary: 'Encontramos algo que pode causar dano ou instabilidade. Vale resolver antes de qualquer outra coisa.',
      };

    case 'attention-needed':
      return {
        headline: top?.what ?? 'Seu PC tem espaço para melhorar.',
        summary: fps
          ? `Em ${workload}, a estimativa é de ${fps.fps} FPS em ${profile.resolution}. Existe um ponto claro segurando o conjunto.`
          : 'Existe um ponto claro segurando o conjunto.',
      };

    case 'minor-improvements':
      return {
        headline: 'Seu PC está bem. Dá para melhorar em alguns pontos.',
        summary: fps
          ? `Em ${workload}, a estimativa é de ${fps.fps} FPS em ${profile.resolution}. Nada urgente — as sugestões abaixo são ajustes, não correções.`
          : 'Nada urgente. As sugestões abaixo são ajustes, não correções.',
      };

    /**
     * O caso que o produto existe para conseguir dizer. Sem asterisco, sem
     * "mas você poderia considerar", sem oferta escondida no rodapé.
     */
    case 'healthy':
      return {
        headline: 'Seu PC está equilibrado. Você não precisa fazer upgrade agora.',
        summary: fps
          ? `Em ${workload}, a estimativa é de ${fps.fps} FPS em ${profile.resolution}. As peças estão bem casadas entre si e adequadas ao que você faz. Guarde o dinheiro.`
          : `As peças estão bem casadas entre si e adequadas ao que você faz${parts.gpu ? '' : ''}. Guarde o dinheiro.`,
      };
  }
}

export function diagnose(rig: Rig, profile: UsageProfile): Diagnosis {
  const parts = resolveParts(rig);
  const completeness = completenessOf(rig);
  const limitations: string[] = [];

  const cpuSpec = parts.cpu?.spec ?? null;
  const gpuSpec = parts.gpu?.spec ?? null;

  const weighted =
    cpuSpec && gpuSpec ? estimateProfileFps(cpuSpec, gpuSpec, profile) : { byWorkload: [], headline: null };
  const fps = weighted.headline?.estimate ?? null;

  if (!completeness.canAnalyzePerformance) {
    limitations.push(
      'Sem processador e placa de vídeo cadastrados não é possível estimar desempenho.',
    );
  }
  if (!parts.psu) limitations.push('Cadastre a fonte para verificarmos se ela tem folga suficiente.');
  if (!parts.cooler) limitations.push('Cadastre o cooler para avaliarmos a refrigeração.');
  if (!parts.motherboard) {
    limitations.push('Cadastre a placa-mãe para checarmos compatibilidade e caminhos de upgrade.');
  }

  const hasFastStorage = parts.drives.some((d) => d.spec.spec.storageType !== 'HDD');
  const production = cpuSpec
    ? normalizedWorkloads(profile)
        .map((w) => rateProductionWorkload(w.kind, cpuSpec, gpuSpec, parts.totalRamGb, hasFastStorage))
        .filter((r): r is NonNullable<typeof r> => r !== null)
    : [];

  const bottleneck = analyzeBottleneck(parts, profile, fps);

  const findings = sortFindings([
    ...analyzeCompatibility(parts),
    ...analyzePower(parts),
    ...bottleneck,
    ...analyzeMemory(parts, profile),
    ...analyzeStorage(parts, profile),
    ...analyzeThermals(parts),
    ...analyzeDisplay(parts, profile, fps?.fps ?? null),
    ...analyzeTarget(profile, fps, bottleneck.length > 0),
  ]);

  const verdict = buildVerdict(findings);
  const { headline, summary } = buildNarrative(verdict, findings, parts, profile, fps);

  return {
    verdict,
    headline,
    summary,
    findings,
    approved: collectApproved(parts, findings, fps),
    performance: {
      fps,
      workloadLabel: weighted.headline ? WORKLOAD_LABEL[weighted.headline.workload].title : null,
      meetsTarget: fps && profile.targetFps !== null ? fps.fps >= profile.targetFps : null,
      production,
    },
    power: computePowerBudget(parts),
    limitations,
  };
}

/** Usado pelo feed e pelo perfil: uma linha só sobre a situação da máquina. */
export function oneLineStatus(diagnosis: Diagnosis): string {
  switch (diagnosis.verdict) {
    case 'critical':
      return 'Precisa de atenção';
    case 'attention-needed':
      return diagnosis.findings[0]?.category
        ? `${diagnosis.findings[0].category} segurando o conjunto`
        : 'Tem um ponto de atenção';
    case 'minor-improvements':
      return 'Bom, com ajustes possíveis';
    case 'healthy':
      return 'Equilibrado';
  }
}
