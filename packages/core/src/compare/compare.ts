/**
 * Comparação.
 *
 * A pergunta que o produto precisa responder não é "qual tem mais teraflops", é
 * "qual é melhor PARA MIM". Por isso toda comparação aceita um `UsageProfile` e o
 * vencedor pode mudar conforme o perfil — um 9800X3D ganha de um 285K para quem joga
 * e perde para quem renderiza, e as duas respostas estão certas.
 */

import type { CatalogComponent } from '../catalog/types.ts';
import { asCpu, asGpu } from '../catalog/types.ts';
import type { Rig } from '../rig/types.ts';
import { resolveParts } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { gamingShare, primaryWorkload } from '../profile/types.ts';
import { estimateFps } from '../engine/performance.ts';
import { computeSetupScore } from '../score/setupScore.ts';
import { diagnose } from '../engine/diagnosis.ts';
import { pricingFor, valuateRig } from '../value/valuation.ts';

export interface ComparisonRow {
  label: string;
  /** Valor formatado de cada lado. */
  left: string;
  right: string;
  /** Quem leva esta linha. `null` quando empatam ou não é comparável. */
  winner: 'left' | 'right' | null;
  /** Linhas marcadas como técnicas ficam escondidas até o usuário pedir. */
  technical: boolean;
}

export interface ComponentComparison {
  left: CatalogComponent;
  right: CatalogComponent;
  rows: ComparisonRow[];
  /** Recomendação contextualizada. */
  verdict: {
    winner: 'left' | 'right' | 'tie';
    headline: string;
    reasoning: string;
  };
}

function row(
  label: string,
  left: string,
  right: string,
  winner: ComparisonRow['winner'],
  technical = false,
): ComparisonRow {
  return { label, left, right, winner, technical };
}

function better(a: number, b: number): ComparisonRow['winner'] {
  if (Math.abs(a - b) < 0.001) return null;
  return a > b ? 'left' : 'right';
}

/** Menor é melhor (consumo, preço, latência). */
function lower(a: number, b: number): ComparisonRow['winner'] {
  if (Math.abs(a - b) < 0.001) return null;
  return a < b ? 'left' : 'right';
}

function money(usd: number | null, region: string): string {
  if (usd === null) return '—';
  const p = pricingFor(region);
  const value = Math.round(usd * p.fxRate * p.retailMultiplier);
  return `${p.currency === 'BRL' ? 'R$' : p.currency} ${value.toLocaleString('pt-BR')}`;
}

export function compareComponents(
  left: CatalogComponent,
  right: CatalogComponent,
  profile: UsageProfile,
): ComponentComparison {
  const rows: ComparisonRow[] = [];

  const leftCpu = asCpu(left);
  const rightCpu = asCpu(right);
  const leftGpu = asGpu(left);
  const rightGpu = asGpu(right);

  let winner: 'left' | 'right' | 'tie' = 'tie';
  let headline = '';
  let reasoning = '';

  if (leftCpu && rightCpu) {
    const l = leftCpu.spec;
    const r = rightCpu.spec;
    const gaming = gamingShare(profile);

    rows.push(row('Desempenho em jogos', `${l.performance.gaming}`, `${r.performance.gaming}`, better(l.performance.gaming, r.performance.gaming)));
    rows.push(row('Desempenho em produção', `${l.performance.multiThread}`, `${r.performance.multiThread}`, better(l.performance.multiThread, r.performance.multiThread)));
    rows.push(row('Núcleos / threads', `${l.cores}/${l.threads}`, `${r.cores}/${r.threads}`, better(l.cores, r.cores)));
    rows.push(row('Frequência máxima', `${l.boostClockGhz} GHz`, `${r.boostClockGhz} GHz`, better(l.boostClockGhz, r.boostClockGhz), true));
    rows.push(row('Cache L3', `${l.l3CacheMb} MB`, `${r.l3CacheMb} MB`, better(l.l3CacheMb, r.l3CacheMb), true));
    rows.push(row('Consumo sob carga', `${l.peakPowerWatts} W`, `${r.peakPowerWatts} W`, lower(l.peakPowerWatts, r.peakPowerWatts)));
    rows.push(row('Soquete', l.socket, r.socket, null, true));
    rows.push(row('Preço de lançamento', money(left.msrpUsd, profile.region), money(right.msrpUsd, profile.region), null));

    // O peso muda com o perfil — é exatamente isso que torna a comparação útil.
    const leftScore = l.performance.gaming * gaming + l.performance.multiThread * (1 - gaming);
    const rightScore = r.performance.gaming * gaming + r.performance.multiThread * (1 - gaming);
    winner = Math.abs(leftScore - rightScore) < 2 ? 'tie' : leftScore > rightScore ? 'left' : 'right';

    const win = winner === 'left' ? left : right;
    const lose = winner === 'left' ? right : left;
    const winSpec = winner === 'left' ? l : r;
    const loseSpec = winner === 'left' ? r : l;

    if (winner === 'tie') {
      headline = 'Para o seu uso, os dois se equivalem.';
      reasoning = 'A diferença de desempenho no seu perfil é pequena demais para justificar a escolha por ela. Decida por preço, disponibilidade ou plataforma.';
    } else if (gaming > 0.6) {
      headline = `Para você, o ${win.model}.`;
      reasoning = `Como o seu uso é principalmente jogo, o que pesa é o índice de jogos — e nele o ${win.model} leva (${winSpec.performance.gaming} contra ${loseSpec.performance.gaming}). Vale notar que em tarefas de produção pesada o ${lose.model} pode ser o mais forte dos dois.`;
    } else {
      headline = `Para você, o ${win.model}.`;
      reasoning = `O seu perfil tem bastante carga de produção, onde o que manda é o desempenho multi-thread — e nele o ${win.model} leva (${winSpec.performance.multiThread} contra ${loseSpec.performance.multiThread}).`;
    }
  } else if (leftGpu && rightGpu) {
    const l = leftGpu.spec;
    const r = rightGpu.spec;
    const workload = primaryWorkload(profile);

    const lFps = estimateFps(
      { ...defaultCpuForGpuComparison() },
      l,
      profile.resolution,
      workload,
    );
    const rFps = estimateFps({ ...defaultCpuForGpuComparison() }, r, profile.resolution, workload);

    rows.push(row('Desempenho (rasterização)', `${l.performance.raster}`, `${r.performance.raster}`, better(l.performance.raster, r.performance.raster)));
    if (lFps && rFps) {
      rows.push(row(`FPS estimado em ${profile.resolution}`, `${lFps.gpuBoundFps}`, `${rFps.gpuBoundFps}`, better(lFps.gpuBoundFps, rFps.gpuBoundFps)));
    }
    rows.push(row('Ray tracing', l.performance.rayTracing === null ? 'Não tem' : `${l.performance.rayTracing}`, r.performance.rayTracing === null ? 'Não tem' : `${r.performance.rayTracing}`, better(l.performance.rayTracing ?? 0, r.performance.rayTracing ?? 0)));
    rows.push(row('VRAM', `${l.vramGb} GB ${l.vramType}`, `${r.vramGb} GB ${r.vramType}`, better(l.vramGb, r.vramGb)));
    rows.push(row('Consumo sob carga', `${l.peakPowerWatts} W`, `${r.peakPowerWatts} W`, lower(l.peakPowerWatts, r.peakPowerWatts)));
    rows.push(row('Fonte recomendada', l.recommendedPsuWatts ? `${l.recommendedPsuWatts} W` : '—', r.recommendedPsuWatts ? `${r.recommendedPsuWatts} W` : '—', null));
    rows.push(row('Barramento de memória', `${l.memoryBusBits} bits`, `${r.memoryBusBits} bits`, better(l.memoryBusBits, r.memoryBusBits), true));
    rows.push(row('Comprimento', `${l.lengthMm} mm`, `${r.lengthMm} mm`, null, true));
    rows.push(row('Preço de lançamento', money(left.msrpUsd, profile.region), money(right.msrpUsd, profile.region), null));

    const diff = l.performance.raster - r.performance.raster;
    winner = Math.abs(diff) < 2 ? 'tie' : diff > 0 ? 'left' : 'right';

    const win = winner === 'left' ? left : right;
    const winSpec = winner === 'left' ? l : r;
    const loseSpec = winner === 'left' ? r : l;

    if (winner === 'tie') {
      headline = 'As duas entregam praticamente o mesmo.';
      reasoning = 'A diferença de desempenho é pequena. Decida por VRAM, consumo ou preço.';
    } else {
      const pct = Math.round((Math.abs(diff) / Math.min(l.performance.raster, r.performance.raster)) * 100);
      headline = `A ${win.model} é mais forte.`;
      reasoning = `Ela entrega cerca de ${pct}% mais desempenho em rasterização. ${
        winSpec.vramGb < loseSpec.vramGb
          ? `Atenção: ela tem menos VRAM (${winSpec.vramGb}GB contra ${loseSpec.vramGb}GB), o que pode pesar em ${profile.resolution} com texturas no máximo.`
          : `Também tem mais VRAM, o que ajuda em resoluções altas.`
      }`;
    }
  } else {
    rows.push(row('Ano de lançamento', `${left.releaseYear}`, `${right.releaseYear}`, better(left.releaseYear, right.releaseYear)));
    rows.push(row('Preço de lançamento', money(left.msrpUsd, profile.region), money(right.msrpUsd, profile.region), null));
    headline = 'Comparação direta indisponível.';
    reasoning = 'Estas peças não são do mesmo tipo, então não faz sentido apontar um vencedor.';
  }

  return { left, right, rows, verdict: { winner, headline, reasoning } };
}

/**
 * CPU de referência para comparar GPUs isoladamente. Usamos o topo do catálogo de
 * propósito: comparar duas placas com um processador fraco no meio mediria o
 * processador, não as placas.
 */
function defaultCpuForGpuComparison() {
  return {
    kind: 'CPU' as const,
    socket: 'AM5',
    cores: 8,
    threads: 16,
    baseClockGhz: 4.7,
    boostClockGhz: 5.2,
    l3CacheMb: 96,
    tdpWatts: 120,
    peakPowerWatts: 162,
    integratedGraphics: null,
    memoryTypes: ['DDR5' as const],
    lithographyNm: 4,
    performance: { singleThread: 92, multiThread: 78, gaming: 100 },
  };
}

// ---------------------------------------------------------------------------
// PC vs PC
// ---------------------------------------------------------------------------

export interface RigComparison {
  rows: ComparisonRow[];
  verdict: {
    winner: 'left' | 'right' | 'tie';
    headline: string;
    reasoning: string;
  };
}

export function compareRigs(
  leftRig: Rig,
  rightRig: Rig,
  profile: UsageProfile,
): RigComparison {
  const lParts = resolveParts(leftRig);
  const rParts = resolveParts(rightRig);
  const lDiag = diagnose(leftRig, profile);
  const rDiag = diagnose(rightRig, profile);
  const lScore = computeSetupScore(leftRig, profile, lDiag);
  const rScore = computeSetupScore(rightRig, profile, rDiag);
  const lValue = valuateRig(leftRig, profile.region);
  const rValue = valuateRig(rightRig, profile.region);

  const rows: ComparisonRow[] = [
    row('Setup Score', `${lScore.total}`, `${rScore.total}`, better(lScore.total, rScore.total)),
    row('Processador', lParts.cpu?.model ?? '—', rParts.cpu?.model ?? '—', better(lParts.cpu?.spec.performance.gaming ?? 0, rParts.cpu?.spec.performance.gaming ?? 0)),
    row('Placa de vídeo', lParts.gpu?.model ?? '—', rParts.gpu?.model ?? '—', better(lParts.gpu?.spec.performance.raster ?? 0, rParts.gpu?.spec.performance.raster ?? 0)),
    row('Memória', `${lParts.totalRamGb} GB`, `${rParts.totalRamGb} GB`, better(lParts.totalRamGb, rParts.totalRamGb)),
    row('Armazenamento', `${lParts.totalStorageGb} GB`, `${rParts.totalStorageGb} GB`, better(lParts.totalStorageGb, rParts.totalStorageGb)),
  ];

  if (lDiag.performance.fps && rDiag.performance.fps) {
    rows.splice(
      1,
      0,
      row(
        `FPS estimado em ${profile.resolution}`,
        `${lDiag.performance.fps.fps}`,
        `${rDiag.performance.fps.fps}`,
        better(lDiag.performance.fps.fps, rDiag.performance.fps.fps),
      ),
    );
  }

  rows.push(
    row('Equilíbrio', `${lScore.dimensions.find((d) => d.dimension === 'balance')!.score}`, `${rScore.dimensions.find((d) => d.dimension === 'balance')!.score}`, better(lScore.dimensions.find((d) => d.dimension === 'balance')!.score, rScore.dimensions.find((d) => d.dimension === 'balance')!.score)),
  );
  rows.push(
    row('Eficiência', `${lScore.dimensions.find((d) => d.dimension === 'efficiency')!.score}`, `${rScore.dimensions.find((d) => d.dimension === 'efficiency')!.score}`, better(lScore.dimensions.find((d) => d.dimension === 'efficiency')!.score, rScore.dimensions.find((d) => d.dimension === 'efficiency')!.score), true),
  );
  rows.push(
    row('Valor estimado', `R$ ${lValue.coreTotal.toLocaleString('pt-BR')}`, `R$ ${rValue.coreTotal.toLocaleString('pt-BR')}`, null),
  );

  const diff = lScore.total - rScore.total;
  const winner: RigComparison['verdict']['winner'] =
    Math.abs(diff) < 3 ? 'tie' : diff > 0 ? 'left' : 'right';

  const winValue = winner === 'left' ? lValue : rValue;
  const loseValue = winner === 'left' ? rValue : lValue;

  let reasoning: string;
  if (winner === 'tie') {
    reasoning = 'Os dois PCs chegam praticamente no mesmo lugar para este perfil de uso.';
  } else if (winValue.coreTotal < loseValue.coreTotal) {
    // O caso que prova que o score não é um ranking de preço.
    reasoning = `E é o mais barato dos dois. Vence porque as peças estão melhor casadas entre si e mais adequadas ao uso — não por custar mais.`;
  } else {
    reasoning = `Leva vantagem no conjunto, considerando desempenho, equilíbrio e adequação ao uso.`;
  }

  return {
    rows,
    verdict: {
      winner,
      headline:
        winner === 'tie'
          ? 'Tecnicamente empatados.'
          : `${winner === 'left' ? leftRig.name : rightRig.name} leva.`,
      reasoning,
    },
  };
}
