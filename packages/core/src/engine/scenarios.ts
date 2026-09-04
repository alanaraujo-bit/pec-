/**
 * Cenários de upgrade: Econômico, Equilibrado e Entusiasta.
 *
 * Cada cenário é uma peça REAL do catálogo que passou pela checagem de compatibilidade,
 * com ganho projetado pelo mesmo modelo de FPS usado no diagnóstico. Nada aqui é texto
 * genérico: se a peça não encaixa na placa-mãe do usuário ou estoura a fonte dele, ela
 * não vira recomendação.
 *
 * O gerador também pode devolver lista vazia — e isso é uma resposta válida. Quando não
 * existe upgrade que valha a pena, o produto precisa poder dizer que não existe.
 */

import type { CatalogComponent, HardwareCategory } from '../catalog/types.ts';
import { asCpu, asGpu } from '../catalog/types.ts';
import { componentsByCategory } from '../catalog/seed/index.ts';
import type { Rig, RigParts } from '../rig/types.ts';
import { resolveParts } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { primaryWorkload } from '../profile/types.ts';
import { checkUpgradeFit, type CompatibilityReport } from './compatibility.ts';
import { estimateFps } from './performance.ts';
import { pricingFor } from '../value/valuation.ts';

export type ScenarioTier = 'economic' | 'balanced' | 'enthusiast';

export const SCENARIO_LABEL: Record<ScenarioTier, string> = {
  economic: 'Econômico',
  balanced: 'Equilibrado',
  enthusiast: 'Entusiasta',
};

export const SCENARIO_DESCRIPTION: Record<ScenarioTier, string> = {
  economic: 'O menor investimento que resolve o problema.',
  balanced: 'O melhor equilíbrio entre o que você gasta e o que ganha.',
  enthusiast: 'O máximo de desempenho dentro do que faz sentido para a sua máquina.',
};

export interface UpgradeScenario {
  tier: ScenarioTier;
  category: HardwareCategory;
  component: CatalogComponent;
  /** Custo estimado na moeda da região. */
  estimatedCost: number;
  currency: string;
  /** FPS antes e depois, no uso principal. */
  fpsBefore: number;
  fpsAfter: number;
  gainPercent: number;
  /** Ganho de FPS por unidade de moeda. É o que separa "caro" de "mau negócio". */
  valuePerCurrency: number;
  compatibility: CompatibilityReport;
  advantages: string[];
  disadvantages: string[];
  /** Por que esta peça e não outra. */
  rationale: string;
}

/** Preço local estimado de uma peça nova. */
function localPrice(component: CatalogComponent, region: string): number | null {
  if (component.msrpUsd === null) return null;
  const pricing = pricingFor(region);
  return Math.round(component.msrpUsd * pricing.fxRate * pricing.retailMultiplier);
}

/**
 * Simula a troca de uma peça e devolve o FPS resultante. Reusa exatamente o mesmo modelo
 * do diagnóstico — projeção e diagnóstico não podem divergir, ou o produto se contradiz.
 */
function projectFps(
  parts: RigParts,
  profile: UsageProfile,
  candidate: CatalogComponent,
): number | null {
  const workload = primaryWorkload(profile);
  const newCpu = asCpu(candidate);
  const newGpu = asGpu(candidate);

  const cpuSpec = newCpu?.spec ?? parts.cpu?.spec ?? null;
  const gpuSpec = newGpu?.spec ?? parts.gpu?.spec ?? null;
  if (!cpuSpec || !gpuSpec) return null;

  return estimateFps(cpuSpec, gpuSpec, profile.resolution, workload)?.fps ?? null;
}

function describeTradeoffs(
  candidate: CatalogComponent,
  parts: RigParts,
  gainPercent: number,
): { advantages: string[]; disadvantages: string[] } {
  const advantages: string[] = [];
  const disadvantages: string[] = [];

  if (gainPercent >= 30) advantages.push(`Ganho grande de desempenho: cerca de +${gainPercent}%`);
  else if (gainPercent >= 12) advantages.push(`Ganho perceptível: cerca de +${gainPercent}%`);
  else advantages.push(`Ganho modesto: cerca de +${gainPercent}%`);

  const gpu = asGpu(candidate);
  if (gpu) {
    const current = parts.gpu?.spec;
    if (current && gpu.spec.vramGb > current.vramGb) {
      advantages.push(`Mais VRAM: ${gpu.spec.vramGb}GB contra ${current.vramGb}GB de agora`);
    }
    if (current && gpu.spec.peakPowerWatts > current.peakPowerWatts + 60) {
      disadvantages.push(
        `Consome ${gpu.spec.peakPowerWatts - current.peakPowerWatts}W a mais que a sua placa atual`,
      );
    }
    if (gpu.spec.performance.rayTracing !== null && current?.performance.rayTracing === null) {
      advantages.push('Adiciona suporte a ray tracing por hardware');
    }
  }

  const cpu = asCpu(candidate);
  if (cpu) {
    const current = parts.cpu?.spec;
    if (current && cpu.spec.cores > current.cores) {
      advantages.push(`${cpu.spec.cores} núcleos contra ${current.cores} de agora`);
    }
    if (current && cpu.spec.peakPowerWatts > current.peakPowerWatts + 40) {
      disadvantages.push('Esquenta mais — pode exigir um cooler melhor');
    }
  }

  if (candidate.discontinued) {
    disadvantages.push('Fora de linha — pode ser difícil de achar novo, e a garantia costuma ser menor');
  }

  return { advantages, disadvantages };
}

export interface ScenarioOptions {
  /** Categoria a considerar. Normalmente vem do achado principal do diagnóstico. */
  category: HardwareCategory;
  /** Teto de investimento na moeda local. `null` = sem limite. */
  maxBudget?: number | null;
}

/**
 * Gera os três cenários para uma categoria.
 *
 * Filtros aplicados, em ordem: compatibilidade (elimina o que não encaixa), ganho mínimo
 * (elimina o que não muda nada na prática) e orçamento. O que sobra é ordenado por
 * ganho real.
 */
export function buildScenarios(
  rig: Rig,
  profile: UsageProfile,
  options: ScenarioOptions,
): UpgradeScenario[] {
  const parts = resolveParts(rig);
  const pricing = pricingFor(profile.region);
  const workload = primaryWorkload(profile);

  const cpuSpec = parts.cpu?.spec ?? null;
  const gpuSpec = parts.gpu?.spec ?? null;
  if (!cpuSpec || !gpuSpec) return [];

  const fpsBefore = estimateFps(cpuSpec, gpuSpec, profile.resolution, workload)?.fps ?? null;
  if (fpsBefore === null) return [];

  const currentId =
    options.category === 'CPU' ? parts.cpu?.id : options.category === 'GPU' ? parts.gpu?.id : null;

  const candidates = componentsByCategory(options.category)
    .filter((c) => c.id !== currentId)
    .map((component) => {
      const cost = localPrice(component, profile.region);
      const after = projectFps(parts, profile, component);
      if (cost === null || after === null) return null;

      const compatibility = checkUpgradeFit(parts, component);
      const gainPercent = Math.round(((after - fpsBefore) / fpsBefore) * 100);

      return { component, cost, after, compatibility, gainPercent };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    // Peça que não encaixa nunca vira recomendação.
    .filter((c) => c.compatibility.level !== 'blocked')
    // Menos de 8% de ganho não justifica gastar dinheiro. Dizer isso é o produto.
    .filter((c) => c.gainPercent >= 8)
    .filter((c) => options.maxBudget == null || c.cost <= options.maxBudget)
    .sort((a, b) => a.cost - b.cost);

  if (candidates.length === 0) return [];

  const toScenario = (
    c: (typeof candidates)[number],
    tier: ScenarioTier,
    rationale: string,
  ): UpgradeScenario => {
    const { advantages, disadvantages } = describeTradeoffs(c.component, parts, c.gainPercent);
    return {
      tier,
      category: options.category,
      component: c.component,
      estimatedCost: c.cost,
      currency: pricing.currency,
      fpsBefore,
      fpsAfter: c.after,
      gainPercent: c.gainPercent,
      valuePerCurrency: (c.after - fpsBefore) / c.cost,
      compatibility: c.compatibility,
      advantages,
      disadvantages,
      rationale,
    };
  };

  const scenarios: UpgradeScenario[] = [];

  // Econômico: a peça mais barata que ainda entrega um ganho real.
  const economic = candidates[0]!;
  scenarios.push(
    toScenario(
      economic,
      'economic',
      'É a opção mais barata que ainda muda alguma coisa de verdade no seu caso.',
    ),
  );

  // Equilibrado: melhor FPS por real. A escolha que quase sempre é a certa.
  const balanced = candidates.reduce((best, cur) =>
    (cur.after - fpsBefore) / cur.cost > (best.after - fpsBefore) / best.cost ? cur : best,
  );
  if (balanced.component.id !== economic.component.id) {
    scenarios.push(
      toScenario(
        balanced,
        'balanced',
        'É a peça que entrega mais quadros por real gasto entre todas as compatíveis com o seu PC.',
      ),
    );
  }

  /**
   * Entusiasta: o maior ganho — mas só até o ponto em que o RESTO da máquina consegue
   * acompanhar. Recomendar uma placa que o processador não conseguiria alimentar seria
   * vender desempenho que o usuário nunca veria.
   */
  const enthusiast = candidates
    .filter((c) => c.compatibility.level === 'ok')
    .reduce<(typeof candidates)[number] | null>(
      (best, cur) => (best === null || cur.after > best.after ? cur : best),
      null,
    );

  if (
    enthusiast &&
    enthusiast.component.id !== balanced.component.id &&
    enthusiast.component.id !== economic.component.id
  ) {
    scenarios.push(
      toScenario(
        enthusiast,
        'enthusiast',
        'É o maior desempenho que o restante da sua máquina ainda consegue aproveitar.',
      ),
    );
  }

  return scenarios;
}
