/**
 * Perfil de uso — o contexto sem o qual nenhuma recomendação faz sentido.
 *
 * "Esse PC é bom?" não tem resposta. "Esse PC é bom para jogar competitivo a 1080p
 * mirando 240fps com R$2.000 de orçamento no Brasil?" tem. Todo o engine parte daqui.
 */

export type Resolution = '1080p' | '1440p' | '4K' | 'ultrawide-1440p';

export const RESOLUTIONS: Resolution[] = ['1080p', '1440p', 'ultrawide-1440p', '4K'];

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  '1080p': 'Full HD (1920×1080)',
  '1440p': 'Quad HD (2560×1440)',
  'ultrawide-1440p': 'Ultrawide (3440×1440)',
  '4K': '4K (3840×2160)',
};

/**
 * Perfis de carga. Cada um responde de forma diferente a CPU e GPU — é exatamente
 * por isso que recomendar hardware sem saber o uso produz conselho genérico e errado.
 */
export type WorkloadKind =
  | 'competitive-gaming'
  | 'aaa-gaming'
  | 'casual-gaming'
  | 'streaming'
  | 'video-editing'
  | 'game-development'
  | 'programming'
  | '3d-rendering'
  | 'productivity';

export const WORKLOADS: WorkloadKind[] = [
  'competitive-gaming',
  'aaa-gaming',
  'casual-gaming',
  'streaming',
  'video-editing',
  'game-development',
  'programming',
  '3d-rendering',
  'productivity',
];

export interface WorkloadLabel {
  title: string;
  description: string;
}

export const WORKLOAD_LABEL: Record<WorkloadKind, WorkloadLabel> = {
  'competitive-gaming': {
    title: 'Jogos competitivos',
    description: 'CS2, Valorant, LoL, Fortnite. FPS alto importa mais que gráfico.',
  },
  'aaa-gaming': {
    title: 'Jogos pesados',
    description: 'Cyberpunk, Baldur’s Gate 3, Alan Wake 2. Gráfico no máximo.',
  },
  'casual-gaming': {
    title: 'Jogos leves',
    description: 'Minecraft, The Sims, indies, jogos mais antigos.',
  },
  streaming: {
    title: 'Live e gravação',
    description: 'Transmitir ou gravar enquanto joga.',
  },
  'video-editing': {
    title: 'Edição de vídeo',
    description: 'Premiere, DaVinci, After Effects.',
  },
  'game-development': {
    title: 'Desenvolvimento de jogos',
    description: 'Unity, Unreal, Godot.',
  },
  programming: {
    title: 'Programação',
    description: 'IDEs, containers, compilação.',
  },
  '3d-rendering': {
    title: 'Render 3D',
    description: 'Blender, Maya, modelagem e render.',
  },
  productivity: {
    title: 'Uso geral',
    description: 'Navegador, Office, estudo, trabalho do dia a dia.',
  },
};

/**
 * Um item de carga com o peso que ele tem para o usuário. A soma dos pesos é
 * normalizada pelo engine — o usuário não precisa fazer contas.
 */
export interface WorkloadWeight {
  kind: WorkloadKind;
  /** 1 = faço às vezes, 2 = faço bastante, 3 = é o meu uso principal. */
  weight: 1 | 2 | 3;
}

export type BudgetTier = 'none' | 'tight' | 'moderate' | 'comfortable' | 'unlimited';

export interface Budget {
  tier: BudgetTier;
  /** Valor explícito na moeda da região, quando o usuário quis informar. */
  amount: number | null;
  currency: string;
}

/** O que o usuário quer priorizar quando dois caminhos competem. */
export type Priority =
  | 'max-fps'
  | 'visual-quality'
  | 'silence'
  | 'value-for-money'
  | 'longevity'
  | 'efficiency';

export const PRIORITY_LABEL: Record<Priority, string> = {
  'max-fps': 'FPS mais alto possível',
  'visual-quality': 'Qualidade visual',
  silence: 'Silêncio',
  'value-for-money': 'Custo-benefício',
  longevity: 'Durar bastante tempo',
  efficiency: 'Consumo e eficiência',
};

export interface UsageProfile {
  workloads: WorkloadWeight[];
  resolution: Resolution;
  /** FPS alvo. `null` quando o usuário não sabe ou não se importa. */
  targetFps: number | null;
  budget: Budget;
  priorities: Priority[];
  /** Código ISO do país. Define moeda, preços e disponibilidade. */
  region: string;
  /** Quanto o usuário quer de profundidade técnica. Controla o progressive disclosure. */
  expertise: 'beginner' | 'intermediate' | 'advanced';
}

export const DEFAULT_PROFILE: UsageProfile = {
  workloads: [{ kind: 'aaa-gaming', weight: 3 }],
  resolution: '1080p',
  targetFps: 60,
  budget: { tier: 'moderate', amount: null, currency: 'BRL' },
  priorities: ['value-for-money'],
  region: 'BR',
  expertise: 'beginner',
};

/** Normaliza os pesos das cargas para somarem 1. */
export function normalizedWorkloads(profile: UsageProfile): Array<{ kind: WorkloadKind; share: number }> {
  const items = profile.workloads.length > 0 ? profile.workloads : DEFAULT_PROFILE.workloads;
  const total = items.reduce((sum, w) => sum + w.weight, 0);
  if (total === 0) return items.map((w) => ({ kind: w.kind, share: 1 / items.length }));
  return items.map((w) => ({ kind: w.kind, share: w.weight / total }));
}

/** A carga de maior peso. Usada nos textos ("no seu uso principal..."). */
export function primaryWorkload(profile: UsageProfile): WorkloadKind {
  const items = normalizedWorkloads(profile);
  return items.reduce((best, cur) => (cur.share > best.share ? cur : best), items[0]!).kind;
}

const GAMING_WORKLOADS: WorkloadKind[] = [
  'competitive-gaming',
  'aaa-gaming',
  'casual-gaming',
  'streaming',
];

/** Fração do uso que é jogo. Decide se o engine deve falar em FPS. */
export function gamingShare(profile: UsageProfile): number {
  return normalizedWorkloads(profile)
    .filter((w) => GAMING_WORKLOADS.includes(w.kind))
    .reduce((sum, w) => sum + w.share, 0);
}
