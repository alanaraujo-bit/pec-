/**
 * PC Health — a condição da máquina, separada do desempenho dela.
 *
 * A especificação pede Performance ≠ Health ≠ Intelligence como eixos distintos, e a
 * distinção só vale a pena se responder a perguntas diferentes:
 *
 *   Performance → "esta máquina é rápida o bastante para o que eu faço?"
 *   Health      → "esta máquina está bem cuidada e vai continuar funcionando?"
 *
 * O que separa os dois na prática, e o que torna Health um eixo com identidade própria:
 * **quase tudo que aparece aqui se resolve sem comprar nada.** Tirar poeira, trocar a pasta
 * térmica, reposicionar uma ventoinha, liberar espaço em disco. Por isso todo check carrega
 * `costsMoney`, e por isso `freeActions` existe: quando a resposta é grátis, o produto tem
 * a obrigação de dizer isso antes de qualquer coisa que custe.
 *
 * Isso é a mesma promessa do "seu PC está bom, não faça upgrade" aplicada a um eixo novo.
 * Um app que respondesse a "seu cooler está sujo" com "compre uma GPU melhor" teria virado
 * um funil — `health.test.ts` trava exatamente isso.
 *
 * **Por que os checks térmicos, de energia e de compatibilidade não são reescritos aqui.**
 * Eles vêm de `analyzeThermals`, `analyzePower` e `analyzeCompatibility`, os mesmos que
 * alimentam o diagnóstico. Reimplementá-los daria dois julgamentos sobre o mesmo fato e,
 * mais cedo ou mais tarde, a aba Saúde diria uma coisa e o diagnóstico outra. O que Health
 * acrescenta por conta própria é o eixo do tempo: desgaste e manutenção, que não aparecem
 * em nenhum FPS e por isso ninguém percebe até parar de funcionar.
 */

import { isPeripheral } from '../catalog/types.ts';
import type { Rig, RigComponent } from '../rig/types.ts';
import { resolveParts } from '../rig/types.ts';
import type { Finding, Severity } from '../engine/findings.ts';
import { analyzeCompatibility } from '../engine/compatibility.ts';
import { analyzePower, analyzeThermals } from '../engine/subsystems.ts';

export type HealthStatus = 'good' | 'watch' | 'at-risk' | 'critical';

export type HealthArea = 'thermal' | 'power' | 'wear' | 'storage' | 'compatibility' | 'maintenance';

export const HEALTH_AREA_LABEL: Record<HealthArea, string> = {
  thermal: 'Refrigeração',
  power: 'Energia',
  wear: 'Desgaste',
  storage: 'Armazenamento',
  compatibility: 'Montagem',
  maintenance: 'Manutenção',
};

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  good: 'Em ordem',
  watch: 'De olho',
  'at-risk': 'Atenção',
  critical: 'Crítico',
};

export interface HealthCheck {
  id: string;
  area: HealthArea;
  status: HealthStatus;
  what: string;
  why: string;
  how: string | null;
  technical: string[];
  /**
   * Se resolver exige comprar alguma coisa.
   *
   * É o campo mais importante deste tipo. A tela mostra primeiro o que é grátis, porque
   * é honesto e porque é o que a pessoa pode fazer hoje à noite.
   */
  costsMoney: boolean;
  /** Idade da peça em anos, quando o check é sobre tempo. */
  ageYears: number | null;
}

export interface HealthReport {
  status: HealthStatus;
  /** 0 a 100. Condição, não desempenho — um PC lento pode ter saúde perfeita. */
  score: number;
  headline: string;
  summary: string;
  checks: HealthCheck[];
  /** O que está em ordem. Dizer "sua fonte tem folga" tem tanto valor quanto apontar erro. */
  passing: Array<{ area: HealthArea; label: string; reason: string }>;
  /** Ações que não custam nada. Sempre primeiro. */
  freeActions: string[];
  /** O que impede uma avaliação completa. */
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Tempo e desgaste
// ---------------------------------------------------------------------------

/**
 * Há quantos anos a peça está em serviço. `null` quando não dá para saber.
 *
 * **Aqui a regra é diferente da valuation, de propósito.** Lá, o ano de lançamento é piso
 * da idade: um modelo de 2018 vale menos hoje, tenha sido comprado quando for. Desgaste é
 * outra coisa — capacitor e rolamento contam tempo *ligado*, não tempo de catálogo. Uma
 * fonte modelo 2018 comprada nova em 2025 não tem oito anos de uso, e tratá-la como se
 * tivesse faria o produto assustar gente à toa.
 *
 * Sem data de aquisição declarada, a resposta honesta é não saber — e dizer isso em
 * `limitations`, do mesmo jeito que a valuation admite peça sem preço de referência.
 */
function serviceYears(item: RigComponent, now: Date): number | null {
  if (!item.acquiredAt) return null;
  return Math.max(0, (now.getTime() - item.acquiredAt.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/**
 * Limiares de desgaste por categoria, em anos.
 *
 * Espelham a intuição já embutida em `CATEGORY_WEAR` na valuation: fonte, armazenamento
 * mecânico e ventoinhas envelhecem por desgaste físico, não por obsolescência. Uma CPU de
 * dez anos é lenta; uma fonte de dez anos é um risco — e são coisas diferentes.
 */
const WEAR_THRESHOLDS: Partial<Record<string, { watch: number; atRisk: number }>> = {
  PSU: { watch: 5, atRisk: 8 },
  FAN: { watch: 5, atRisk: 8 },
  COOLER: { watch: 6, atRisk: 9 },
};

/** Depois disso, pasta térmica seca e poeira acumulada já custam temperatura de verdade. */
const MAINTENANCE_DUE_YEARS = 2;

function severityToStatus(severity: Severity): HealthStatus {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'at-risk';
    case 'medium':
    case 'low':
      return 'watch';
    default:
      return 'good';
  }
}

/** Converte um achado do diagnóstico em check de saúde, sem reescrever o julgamento. */
function checkFromFinding(f: Finding, area: HealthArea, costsMoney: boolean): HealthCheck {
  return {
    id: f.id,
    area,
    status: severityToStatus(f.severity),
    what: f.what,
    why: f.why,
    how: f.how,
    technical: f.technical,
    costsMoney,
    ageYears: null,
  };
}

// ---------------------------------------------------------------------------
// Checks próprios de Health
// ---------------------------------------------------------------------------

function wearChecks(rig: Rig, now: Date): HealthCheck[] {
  const out: HealthCheck[] = [];

  for (const item of rig.components) {
    const category = item.component.category;
    const threshold = WEAR_THRESHOLDS[category];
    const age = serviceYears(item, now);

    if (threshold && age !== null && age >= threshold.watch) {
      const atRisk = age >= threshold.atRisk;
      const years = Math.floor(age);

      if (category === 'PSU') {
        out.push({
          id: 'wear-psu-age',
          area: 'wear',
          status: atRisk ? 'at-risk' : 'watch',
          what: atRisk ? 'Planeje trocar a fonte.' : 'Fique de olho na idade da fonte.',
          why: atRisk
            ? `Sua fonte tem cerca de ${years} anos. Os capacitores de uma fonte se degradam com o tempo mesmo sem defeito aparente, e ela é a única peça que, ao falhar, pode levar outras junto. Não é urgência — é a peça que vale trocar antes de dar problema, não depois.`
            : `Sua fonte tem cerca de ${years} anos e está na faixa em que convém acompanhar. Ainda não há motivo para trocar; só não deixe para pensar nisso quando ela já estiver falhando.`,
          how: atRisk
            ? 'Uma fonte 80+ Bronze ou melhor da mesma potência resolve. É a troca com melhor relação entre custo e risco evitado.'
            : 'Nada a fazer agora. Se começar a ouvir estalos, sentir cheiro de queimado ou o PC desligar sozinho sob carga, troque na hora.',
          technical: [
            `Idade estimada: ${years} anos`,
            `Potência: ${item.component.spec.kind === 'PSU' ? `${item.component.spec.wattage}W` : '—'}`,
          ],
          costsMoney: atRisk,
          ageYears: age,
        });
      } else if (category === 'FAN' || category === 'COOLER') {
        out.push({
          id: `wear-${category.toLowerCase()}-age`,
          area: 'wear',
          status: atRisk ? 'at-risk' : 'watch',
          what:
            category === 'FAN'
              ? 'Verifique as ventoinhas.'
              : 'Reveja o cooler do processador.',
          why: `Esta peça tem cerca de ${years} anos. Rolamento de ventoinha e pasta térmica são as duas coisas que se degradam sozinhas num PC: a temperatura sobe aos poucos, o desempenho cai junto, e ninguém percebe porque foi acontecendo devagar.`,
          how: 'Limpeza e pasta térmica nova resolvem quase sempre. Só troque a peça se, depois disso, o barulho ou a temperatura continuarem altos.',
          technical: [`Idade estimada: ${years} anos`],
          // A resposta certa aqui é manutenção, não compra — e é isso que separa Health.
          costsMoney: false,
          ageYears: age,
        });
      }
    }

    if (category === 'STORAGE' && item.component.spec.kind === 'STORAGE') {
      const spec = item.component.spec;
      if (spec.storageType === 'HDD' && age !== null && age >= 5) {
        out.push({
          id: 'wear-hdd-age',
          area: 'storage',
          status: age >= 8 ? 'at-risk' : 'watch',
          what: 'Faça backup do que está no HD.',
          why: `Este HD tem cerca de ${Math.floor(age)} anos. HD é a única peça do PC com parte mecânica girando, e ele falha sem avisar — a diferença entre um susto e uma perda é ter cópia dos arquivos em outro lugar.`,
          how: 'Uma cópia num SSD externo ou na nuvem já resolve. Não precisa trocar o HD; precisa não depender só dele.',
          technical: [`Idade estimada: ${Math.floor(age)} anos`, `Capacidade: ${spec.capacityGb}GB`],
          costsMoney: false,
          ageYears: age,
        });
      }
    }
  }

  return out;
}

/**
 * Manutenção devida por tempo.
 *
 * Sem registro de manutenção, o melhor sinal disponível é há quanto tempo as peças estão
 * instaladas. É uma aproximação, e o texto assume isso em vez de afirmar que a máquina
 * está suja — o produto não tem como saber, e fingir que sabe seria o mesmo erro de
 * inventar preço para peça sem referência.
 */
function maintenanceCheck(rig: Rig, now: Date): HealthCheck | null {
  const internals = rig.components.filter((c) => !isPeripheral(c.component.category));
  if (internals.length === 0) return null;

  const ages = internals.map((c) => serviceYears(c, now)).filter((a): a is number => a !== null);
  if (ages.length === 0) return null;
  const oldest = Math.max(...ages);
  if (oldest < MAINTENANCE_DUE_YEARS) return null;

  const years = Math.floor(oldest);

  return {
    id: 'maintenance-due',
    area: 'maintenance',
    status: oldest >= 4 ? 'at-risk' : 'watch',
    what: 'Vale uma limpeza e pasta térmica nova.',
    why: `As peças mais antigas desta máquina estão instaladas há cerca de ${years} anos. Nesse tempo, poeira nos dissipadores e pasta térmica ressecada costumam custar de 5 a 15 graus — e temperatura alta vira menos desempenho sob carga, sem que nada apareça quebrado.`,
    how: 'Ar comprimido nos dissipadores e nas ventoinhas, e pasta térmica nova no processador. Uma tarde de trabalho e o preço de uma seringa de pasta.',
    technical: [
      `Peça mais antiga instalada há ~${years} anos`,
      `Intervalo recomendado: a cada ${MAINTENANCE_DUE_YEARS} anos`,
      'Estimado pelo tempo de instalação — o Pecê não mede temperatura real.',
    ],
    // O ponto do eixo: a ação que resolve não passa por comprar peça.
    costsMoney: false,
    ageYears: oldest,
  };
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const PENALTY: Record<HealthStatus, number> = { critical: 45, 'at-risk': 20, watch: 8, good: 0 };

const RANK: Record<HealthStatus, number> = { good: 0, watch: 1, 'at-risk': 2, critical: 3 };

function worst(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>((acc, s) => (RANK[s] > RANK[acc] ? s : acc), 'good');
}

/**
 * Repare que não recebe `UsageProfile`: saúde não depende do que a pessoa faz com o PC.
 * Uma fonte de nove anos é o mesmo risco para quem joga e para quem edita vídeo — e essa
 * independência é justamente o que faz de Health um eixo, e não uma vista do diagnóstico.
 */
export function assessHealth(rig: Rig, now: Date = new Date()): HealthReport {
  const parts = resolveParts(rig);

  const checks: HealthCheck[] = [
    // Refrigeração e energia: mesmo julgamento do diagnóstico, nunca um segundo.
    ...analyzeThermals(parts).map((f) =>
      // Fluxo de ar e cooler de caixa se resolvem com ventoinha e limpeza antes de compra.
      checkFromFinding(f, 'thermal', f.id === 'thermal-undersized'),
    ),
    ...analyzePower(parts).map((f) => checkFromFinding(f, 'power', true)),
    ...analyzeCompatibility(parts).map((f) => checkFromFinding(f, 'compatibility', false)),
    ...wearChecks(rig, now),
  ];

  const maintenance = maintenanceCheck(rig, now);
  if (maintenance) checks.push(maintenance);

  checks.sort((a, b) => {
    const bySeverity = RANK[b.status] - RANK[a.status];
    if (bySeverity !== 0) return bySeverity;
    // Empatado em gravidade, o que é grátis vem primeiro: é o que dá para fazer hoje.
    return Number(a.costsMoney) - Number(b.costsMoney);
  });

  const status = worst(checks.map((c) => c.status));
  const score = Math.max(
    0,
    Math.min(100, 100 - checks.reduce((sum, c) => sum + PENALTY[c.status], 0)),
  );

  const areasWithProblem = new Set(checks.map((c) => c.area));
  const passing: HealthReport['passing'] = [];

  if (parts.psu && !areasWithProblem.has('power')) {
    passing.push({
      area: 'power',
      label: HEALTH_AREA_LABEL.power,
      reason: 'A fonte tem folga para o que a máquina consome sob carga.',
    });
  }
  if (parts.cooler && !areasWithProblem.has('thermal')) {
    passing.push({
      area: 'thermal',
      label: HEALTH_AREA_LABEL.thermal,
      reason: 'O cooler dá conta do processador com margem.',
    });
  }
  if (parts.cpu && parts.motherboard && !areasWithProblem.has('compatibility')) {
    passing.push({
      area: 'compatibility',
      label: HEALTH_AREA_LABEL.compatibility,
      reason: 'As peças estão casadas entre si, sem conflito de montagem.',
    });
  }
  if (rig.components.length > 0 && !areasWithProblem.has('wear')) {
    passing.push({
      area: 'wear',
      label: HEALTH_AREA_LABEL.wear,
      reason: 'Nenhuma peça de desgaste está em idade de preocupar.',
    });
  }

  const freeActions = checks.filter((c) => !c.costsMoney && c.how !== null).map((c) => c.how!);

  const limitations: string[] = [];
  if (!parts.psu) limitations.push('Sem a fonte cadastrada não dá para avaliar energia.');
  if (!parts.cooler) limitations.push('Sem o cooler cadastrado não dá para avaliar refrigeração.');

  /**
   * Sem data de aquisição não existe desgaste a afirmar. Dizer isso é melhor do que
   * chutar pelo ano de lançamento e assustar quem comprou um modelo antigo lacrado.
   */
  const undated = rig.components.filter(
    (c) => !isPeripheral(c.component.category) && c.acquiredAt === null,
  ).length;
  if (undated > 0) {
    limitations.push(
      `${undated} peça${undated === 1 ? '' : 's'} sem data de compra: informe quando comprou para avaliarmos desgaste e manutenção.`,
    );
  }

  limitations.push('O Pecê não lê sensores: a avaliação vem das peças e do tempo, não de temperatura medida.');

  const headline =
    status === 'good'
      ? 'Sua máquina está bem cuidada.'
      : status === 'watch'
        ? 'Nada urgente, mas há o que acompanhar.'
        : status === 'at-risk'
          ? 'Sua máquina precisa de atenção.'
          : 'Há um risco sério para resolver agora.';

  const freeCount = checks.filter((c) => !c.costsMoney).length;
  const summary =
    checks.length === 0
      ? 'Refrigeração, energia e desgaste em ordem. Nada aqui pede a sua ação — e isso é o resultado bom.'
      : freeCount === checks.length
        ? `${checks.length === 1 ? 'O único ponto' : `Todos os ${checks.length} pontos`} de atenção ${checks.length === 1 ? 'se resolve' : 'se resolvem'} sem comprar nada.`
        : `${freeCount} de ${checks.length} ponto${checks.length === 1 ? '' : 's'} de atenção ${freeCount === 1 ? 'se resolve' : 'se resolvem'} sem comprar nada.`;

  return { status, score, headline, summary, checks, passing, freeActions, limitations };
}
