/**
 * Análises por subsistema: energia, térmica, memória, armazenamento e monitor.
 *
 * Cada função recebe as peças já resolvidas e devolve findings. Nenhuma delas conhece
 * as outras — o orquestrador é quem junta. Isso mantém cada regra auditável e testável
 * isoladamente, que é o requisito para o produto poder afirmar que a recomendação
 * tem fundamento.
 */

import type { RigParts } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { gamingShare, normalizedWorkloads } from '../profile/types.ts';
import { finding, type Finding } from './findings.ts';

// ---------------------------------------------------------------------------
// Energia
// ---------------------------------------------------------------------------

/** Consumo estimado do sistema sob carga combinada CPU+GPU. */
export interface PowerBudget {
  estimatedLoadWatts: number;
  psuWatts: number | null;
  /** Fração da capacidade da fonte usada sob carga. */
  utilization: number | null;
  /** Margem recomendada: fontes trabalham melhor e duram mais entre 50% e 80%. */
  headroomWatts: number | null;
}

const BASE_SYSTEM_DRAW = 60; // placa, RAM, ventoinhas, USB
const PER_DRIVE_DRAW = 6;
const PER_FAN_DRAW = 2.5;

export function computePowerBudget(parts: RigParts): PowerBudget {
  const cpuDraw = parts.cpu?.spec.peakPowerWatts ?? 0;
  const gpuDraw = parts.gpu?.spec.peakPowerWatts ?? 0;
  const driveDraw = parts.drives.reduce((sum, d) => sum + PER_DRIVE_DRAW * d.item.quantity, 0);
  const fanDraw = parts.fanCount * PER_FAN_DRAW;

  const estimatedLoadWatts = Math.round(
    cpuDraw + gpuDraw + driveDraw + fanDraw + BASE_SYSTEM_DRAW,
  );
  const psuWatts = parts.psu?.spec.wattage ?? null;

  return {
    estimatedLoadWatts,
    psuWatts,
    utilization: psuWatts ? estimatedLoadWatts / psuWatts : null,
    headroomWatts: psuWatts ? psuWatts - estimatedLoadWatts : null,
  };
}

export function analyzePower(parts: RigParts): Finding[] {
  const budget = computePowerBudget(parts);
  if (budget.psuWatts === null || budget.utilization === null) return [];

  const pct = Math.round(budget.utilization * 100);
  const technical = [
    `Consumo estimado sob carga: ${budget.estimatedLoadWatts}W`,
    `Fonte: ${budget.psuWatts}W (${parts.psu?.spec.efficiencyRating ?? 'sem certificação'})`,
    `Utilização estimada: ${pct}%`,
    'Estimativa por soma de picos de CPU e GPU mais consumo de base do sistema.',
  ];

  // Acima da capacidade: risco real de desligamento sob carga. Isso é segurança, não upsell.
  if (budget.utilization > 1.0) {
    return [
      finding({
        id: 'power-insufficient',
        kind: 'power',
        category: 'PSU',
        severity: 'critical',
        what: 'Trocar a fonte.',
        why: `Sob carga o seu PC pode pedir cerca de ${budget.estimatedLoadWatts}W, mas a fonte entrega ${budget.psuWatts}W. Isso pode desligar o computador do nada durante um jogo e, no limite, danificar peças.`,
        how: `Procure uma fonte de pelo menos ${recommendPsuWattage(budget.estimatedLoadWatts)}W com certificação 80+ Bronze ou melhor.`,
        technical,
        confidence: 'high',
        impactScore: 100,
      }),
    ];
  }

  if (budget.utilization > 0.88) {
    return [
      finding({
        id: 'power-tight',
        kind: 'power',
        category: 'PSU',
        severity: 'high',
        what: 'Considerar uma fonte com mais folga.',
        why: `Sua fonte está trabalhando perto do limite (cerca de ${pct}% da capacidade sob carga). Ela dá conta, mas trabalha quente, faz mais barulho e envelhece mais rápido. Picos rápidos da placa de vídeo também podem derrubar o PC.`,
        how: `Uma fonte de ${recommendPsuWattage(budget.estimatedLoadWatts)}W resolveria com folga confortável.`,
        technical,
        confidence: 'high',
        impactScore: 70,
      }),
    ];
  }

  // Fonte antiga sem certificação em máquina potente: risco silencioso.
  if (parts.psu?.spec.efficiencyRating === 'None' && budget.estimatedLoadWatts > 400) {
    return [
      finding({
        id: 'power-uncertified',
        kind: 'power',
        category: 'PSU',
        severity: 'medium',
        what: 'Avaliar a troca da fonte por uma certificada.',
        why: 'Sua fonte não tem certificação de eficiência. Em um PC deste porte, isso normalmente significa mais calor, mais consumo na tomada e menos proteção para o resto das peças.',
        how: 'Uma 80+ Bronze ou Gold da mesma potência já é um salto grande de segurança.',
        technical,
        impactScore: 40,
      }),
    ];
  }

  return [];
}

/** Potência recomendada: consumo + ~35% de folga, arredondado para cima na escala comercial. */
export function recommendPsuWattage(loadWatts: number): number {
  const target = loadWatts * 1.35;
  const steps = [450, 500, 550, 600, 650, 750, 850, 1000, 1200, 1600];
  return steps.find((s) => s >= target) ?? 1600;
}

// ---------------------------------------------------------------------------
// Térmica
// ---------------------------------------------------------------------------

export function analyzeThermals(parts: RigParts): Finding[] {
  const out: Finding[] = [];
  const cpu = parts.cpu;
  const cooler = parts.cooler;

  if (cpu && cooler) {
    const need = cpu.spec.peakPowerWatts;
    const capacity = cooler.spec.tdpCapacityWatts;
    const ratio = capacity / need;
    const technical = [
      `Pico de consumo do processador: ${need}W`,
      `Capacidade de dissipação do cooler: ${capacity}W`,
      `Folga térmica: ${Math.round((ratio - 1) * 100)}%`,
    ];

    if (ratio < 0.8) {
      out.push(
        finding({
          id: 'thermal-undersized',
          kind: 'thermal',
          category: 'COOLER',
          severity: 'high',
          what: 'Melhorar a refrigeração do processador.',
          why: `O seu cooler dá conta de cerca de ${capacity}W e o processador pode pedir ${need}W sob carga. Quando isso acontece, o processador se protege reduzindo a velocidade — você perde desempenho justamente nos momentos mais pesados.`,
          how: 'Um cooler torre de bom porte ou um water cooler de 240mm já resolve com sobra nesse nível de processador.',
          technical,
          confidence: 'high',
          impactScore: 65,
        }),
      );
    } else if (ratio < 1.0) {
      out.push(
        finding({
          id: 'thermal-marginal',
          kind: 'thermal',
          category: 'COOLER',
          severity: 'medium',
          what: 'A refrigeração está no limite.',
          why: 'Seu cooler segura o processador na maior parte do tempo, mas em sessões longas ou dias quentes ele pode não dar conta e o desempenho cai um pouco.',
          how: 'Trocar por um cooler com mais capacidade resolve. Antes disso, vale checar o fluxo de ar do gabinete — às vezes o problema está ali.',
          technical,
          impactScore: 35,
        }),
      );
    }

    if (cooler.spec.coolerType === 'stock' && need > 105) {
      out.push(
        finding({
          id: 'thermal-stock-cooler',
          kind: 'thermal',
          category: 'COOLER',
          severity: 'medium',
          what: 'Trocar o cooler que veio na caixa.',
          why: 'O cooler original acompanha o processador para funcionar, não para extrair o melhor dele. Num processador desse porte ele costuma ser o motivo de barulho alto e de perda de desempenho sob carga.',
          how: 'Coolers torre de entrada custam pouco e resolvem quase todo o problema.',
          technical,
          impactScore: 45,
        }),
      );
    }
  }

  // Gabinete sem fluxo de ar em máquina quente: o gargalo invisível clássico.
  const pcCase = parts.pcCase;
  if (pcCase && parts.gpu) {
    const heatLoad = (parts.cpu?.spec.peakPowerWatts ?? 0) + parts.gpu.spec.peakPowerWatts;
    const poorAirflow =
      pcCase.spec.airflowQuality === 'restricted' ||
      (pcCase.spec.airflowQuality === 'moderate' && parts.fanCount <= 2);

    if (heatLoad > 400 && poorAirflow) {
      out.push(
        finding({
          id: 'thermal-case-airflow',
          kind: 'thermal',
          category: 'FAN',
          severity: 'medium',
          what: 'Melhorar o fluxo de ar do gabinete.',
          why: `Suas peças geram cerca de ${heatLoad}W de calor, e o seu gabinete está com pouca ventilação (${parts.fanCount} ventoinha${parts.fanCount === 1 ? '' : 's'}). O ar quente fica preso lá dentro e aquece tudo, inclusive a placa de vídeo.`,
          how: 'Duas ou três ventoinhas bem posicionadas — entrada na frente, saída atrás — costumam derrubar bastante a temperatura por um custo baixo.',
          technical: [
            `Carga térmica estimada: ${heatLoad}W`,
            `Ventoinhas instaladas: ${parts.fanCount} de ${pcCase.spec.fanMounts} suportes`,
            `Fluxo de ar do gabinete: ${pcCase.spec.airflowQuality}`,
          ],
          impactScore: 38,
        }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Memória
// ---------------------------------------------------------------------------

/** Necessidade de RAM por carga, em GB. */
const RAM_NEED: Record<string, number> = {
  'competitive-gaming': 16,
  'aaa-gaming': 16,
  'casual-gaming': 8,
  streaming: 32,
  'video-editing': 32,
  'game-development': 32,
  programming: 16,
  '3d-rendering': 32,
  productivity: 8,
};

export function analyzeMemory(parts: RigParts, profile: UsageProfile): Finding[] {
  const out: Finding[] = [];
  if (parts.ramModules.length === 0) return out;

  const total = parts.totalRamGb;
  const need = Math.max(
    ...normalizedWorkloads(profile).map((w) => RAM_NEED[w.kind] ?? 16),
  );

  if (total < need) {
    const severity = total < need / 2 ? 'high' : 'medium';
    out.push(
      finding({
        id: 'memory-capacity',
        kind: 'memory',
        category: 'RAM',
        severity,
        what: `Aumentar a memória RAM para ${need} GB.`,
        why: `Você tem ${total} GB e o seu tipo de uso costuma pedir ${need} GB. Quando a memória acaba, o computador passa a usar o disco como memória — é aí que aparecem os travamentos e engasgos, mesmo com processador e placa de vídeo bons.`,
        how: `Adicionar mais ${need - total} GB do mesmo tipo (${parts.ramModules[0]!.spec.spec.memoryType}) resolve. É um dos upgrades mais baratos que existem.`,
        technical: [
          `Instalado: ${total} GB em ${parts.ramStickCount} módulo(s)`,
          `Recomendado para o perfil: ${need} GB`,
        ],
        confidence: 'high',
        expectedGain: 'Menos travamentos e engasgos',
        impactScore: severity === 'high' ? 72 : 48,
      }),
    );
  }

  /**
   * Single-channel é o gargalo mais comum e mais invisível que existe. Um único pente
   * corta a banda de memória pela metade e derruba FPS de forma mensurável — e nenhum
   * usuário descobre isso sozinho.
   */
  if (parts.ramStickCount === 1 && total >= 8) {
    out.push(
      finding({
        id: 'memory-single-channel',
        kind: 'memory',
        category: 'RAM',
        severity: gamingShare(profile) > 0.4 ? 'high' : 'medium',
        what: 'Instalar um segundo pente de memória.',
        why: 'Você está com um pente só. Com dois pentes iguais a memória trabalha em canal duplo e entrega o dobro de banda. É um ganho real de desempenho que quase ninguém percebe que está perdendo — e não custa quase nada.',
        how: `Adicione um segundo módulo de ${parts.ramModules[0]!.spec.spec.capacityGb} GB, de preferência idêntico ao atual.`,
        technical: [
          'Configuração atual: canal simples (single-channel)',
          'Canal duplo dobra a largura de banda disponível para CPU e gráficos integrados',
          'Ganho típico em jogos: 10% a 25% dependendo do título',
        ],
        confidence: 'high',
        expectedGain: '+10% a +25% de FPS',
        impactScore: 68,
      }),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Armazenamento
// ---------------------------------------------------------------------------

export function analyzeStorage(parts: RigParts, profile: UsageProfile): Finding[] {
  const out: Finding[] = [];
  if (parts.drives.length === 0) return out;

  const hasSsd = parts.drives.some((d) => d.spec.spec.storageType !== 'HDD');
  const hasNvme = parts.drives.some((d) => d.spec.spec.storageType === 'NVME_SSD');

  if (!hasSsd) {
    out.push(
      finding({
        id: 'storage-no-ssd',
        kind: 'storage',
        category: 'STORAGE',
        severity: 'high',
        what: 'Instalar um SSD.',
        why: 'Seu PC roda só com HD mecânico. Essa é, de longe, a mudança que mais transforma a sensação de uso: o computador liga em segundos, os programas abrem na hora e os jogos carregam muito mais rápido. Nenhum outro upgrade nessa faixa de preço muda tanto o dia a dia.',
        how: 'Um SSD NVMe de 1 TB resolve. Instale o sistema nele e deixe o HD para arquivos.',
        technical: [
          'HD mecânico: ~120 MB/s, latência de milissegundos',
          'SSD NVMe: 3.500 a 7.000 MB/s, latência de microssegundos',
        ],
        confidence: 'high',
        expectedGain: 'Sistema e jogos carregando várias vezes mais rápido',
        impactScore: 85,
      }),
    );
  } else if (!hasNvme && parts.motherboard && parts.motherboard.spec.m2Slots > 0) {
    out.push(
      finding({
        id: 'storage-sata-only',
        kind: 'storage',
        category: 'STORAGE',
        severity: 'low',
        what: 'Um SSD NVMe traria mais velocidade.',
        why: 'Você já tem SSD, então o ganho aqui é bem menor que o salto de HD para SSD. Ainda assim, sua placa-mãe tem espaço para um NVMe, que é várias vezes mais rápido em leitura.',
        how: 'Aproveite um dos slots M.2 livres da sua placa-mãe.',
        technical: [
          `Slots M.2 disponíveis na placa: ${parts.motherboard.spec.m2Slots}`,
          'SATA satura em ~550 MB/s; NVMe Gen4 chega a ~7.000 MB/s',
        ],
        impactScore: 15,
      }),
    );
  }

  const totalGb = parts.totalStorageGb;
  const heavyStorage = normalizedWorkloads(profile).some((w) =>
    ['aaa-gaming', 'video-editing', '3d-rendering', 'game-development'].includes(w.kind),
  );
  if (heavyStorage && totalGb > 0 && totalGb < 1000) {
    out.push(
      finding({
        id: 'storage-capacity',
        kind: 'storage',
        category: 'STORAGE',
        severity: 'low',
        what: 'O espaço vai ficar apertado.',
        why: `Você tem ${totalGb} GB no total. Jogos pesados passam de 100 GB cada, e projetos de vídeo ocupam ainda mais. Disco cheio também deixa o SSD mais lento.`,
        how: 'Mais 1 TB costuma ser suficiente por bastante tempo.',
        technical: [`Capacidade total instalada: ${totalGb} GB`],
        impactScore: 18,
      }),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------

/**
 * O desencontro entre PC e monitor é frequente e caro: gente com placa de vídeo forte
 * presa num monitor de 60Hz, ou o contrário. Nos dois casos a recomendação certa não é
 * trocar a peça mais cara.
 */
export function analyzeDisplay(parts: RigParts, profile: UsageProfile, estimatedFps: number | null): Finding[] {
  const out: Finding[] = [];
  const monitor = parts.monitors[0];
  if (!monitor || estimatedFps === null || gamingShare(profile) < 0.3) return out;

  const hz = monitor.spec.spec.refreshRateHz;

  if (estimatedFps > hz * 1.5 && hz <= 75) {
    out.push(
      finding({
        id: 'display-refresh-limited',
        kind: 'display',
        category: 'MONITOR',
        severity: 'medium',
        what: 'Seu monitor é o que está limitando a experiência, não o PC.',
        why: `Seu PC consegue gerar cerca de ${estimatedFps} quadros por segundo, mas o seu monitor só mostra ${hz}. Você está pagando por desempenho que não chega aos seus olhos. Trocar o monitor aqui muda mais a sua experiência do que trocar qualquer peça interna.`,
        how: `Um monitor de 144Hz na mesma resolução (${monitor.spec.spec.resolutionWidth}×${monitor.spec.spec.resolutionHeight}) aproveitaria o que a sua máquina já entrega.`,
        technical: [
          `FPS estimado do conjunto: ${estimatedFps}`,
          `Taxa de atualização do monitor: ${hz}Hz`,
          `Quadros descartados: cerca de ${Math.round(((estimatedFps - hz) / estimatedFps) * 100)}%`,
        ],
        confidence: 'high',
        expectedGain: 'Movimento visivelmente mais fluido',
        impactScore: 55,
      }),
    );
  }

  if (monitor.spec.spec.adaptiveSync === 'none' && estimatedFps < hz * 0.8 && hz >= 120) {
    out.push(
      finding({
        id: 'display-no-adaptive-sync',
        kind: 'display',
        category: 'MONITOR',
        severity: 'low',
        what: 'Seu monitor não tem sincronização adaptativa.',
        why: 'Como o seu PC entrega menos quadros do que o monitor mostra, a imagem pode apresentar cortes horizontais em movimento. Monitores com FreeSync ou G-Sync eliminam isso.',
        how: 'Não é uma troca urgente — considere na próxima vez que for trocar de monitor.',
        technical: [`FPS estimado: ${estimatedFps} contra ${hz}Hz do monitor`],
        impactScore: 10,
      }),
    );
  }

  return out;
}
