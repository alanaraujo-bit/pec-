/**
 * Sistema visual do Pecê.
 *
 * Direção: fundo quase preto, uma cor de marca só, e cor semântica usada exclusivamente
 * para severidade. A hierarquia vem de tipografia e espaço, não de caixas coloridas —
 * é o que separa uma interface pensada de um painel cheio de cartões.
 *
 * Tipografia usa a fonte do sistema (Roboto no Android, SF no iOS) de propósito: carrega
 * instantaneamente, respeita o comportamento nativo de cada plataforma e evita o salto de
 * layout de fonte remota. Performance acima de efeito.
 */

import { Platform } from 'react-native';

export const color = {
  /** Fundo da aplicação. Preto puro cansa a vista e achata profundidade. */
  bg: '#0A0B0D',
  /** Superfície elevada — listas, blocos de conteúdo. */
  surface: '#111316',
  /** Segundo nível de elevação, usado com parcimônia. */
  raised: '#181A1E',
  /** Borda visível. */
  border: '#23262B',
  /** Borda de separação sutil, quase imperceptível. */
  borderSoft: '#1A1D21',

  text: '#F4F5F7',
  textDim: '#A0A6AE',
  textFaint: '#656B74',

  /** Cor da marca. Aparece em ação primária e em foco — nunca como decoração. */
  accent: '#4C8DFF',
  accentDim: '#2A4A85',

  /**
   * Severidade. Verde é reservado exclusivamente para "está tudo bem" — é o que faz o
   * veredito de PC saudável parecer uma conquista, e não uma tela vazia.
   */
  critical: '#FF5F56',
  high: '#FF9448',
  medium: '#F0C044',
  low: '#6E9FFF',
  good: '#3FDD87',

  /** Fundos tênues para os estados de severidade. */
  criticalSoft: 'rgba(255, 95, 86, 0.10)',
  highSoft: 'rgba(255, 148, 72, 0.10)',
  mediumSoft: 'rgba(240, 192, 68, 0.10)',
  goodSoft: 'rgba(63, 221, 135, 0.10)',
  accentSoft: 'rgba(76, 141, 255, 0.10)',

  /** Reações. */
  love: '#FF4D6D',
  like: '#4C8DFF',
  dislike: '#7A828C',
} as const;

/** Escala de espaço em múltiplos de 4. Consistência aqui é metade do acabamento. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/**
 * Tipografia.
 *
 * `letterSpacing` negativo nos tamanhos grandes é o detalhe que faz texto grande parecer
 * desenhado em vez de apenas aumentado.
 */
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '650' as const, letterSpacing: -0.3 },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.1 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  /** Etiqueta em caixa alta. Usada para rótulos de seção, nunca para texto corrido. */
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.8 },
  /** Números que precisam alinhar em coluna (score, FPS, preço). */
  mono: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

/** Sombra discreta. Em fundo escuro, elevação vem mais de borda do que de sombra. */
export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 8 },
  default: {},
});

// ---------------------------------------------------------------------------
// Mapeamentos de domínio para o visual
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export const severityColor: Record<Severity, string> = {
  critical: color.critical,
  high: color.high,
  medium: color.medium,
  low: color.low,
  none: color.good,
};

export const severitySoft: Record<Severity, string> = {
  critical: color.criticalSoft,
  high: color.highSoft,
  medium: color.mediumSoft,
  low: color.accentSoft,
  none: color.goodSoft,
};

export const severityLabel: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alta prioridade',
  medium: 'Média prioridade',
  low: 'Baixa prioridade',
  none: 'Tudo certo',
};

export type Verdict = 'healthy' | 'minor-improvements' | 'attention-needed' | 'critical';

export const verdictColor: Record<Verdict, string> = {
  healthy: color.good,
  'minor-improvements': color.medium,
  'attention-needed': color.high,
  critical: color.critical,
};

/** Rótulos curtos das categorias. Aparecem em espaço apertado. */
export const categoryLabel: Record<string, string> = {
  CPU: 'Processador',
  GPU: 'Placa de vídeo',
  MOTHERBOARD: 'Placa-mãe',
  RAM: 'Memória',
  STORAGE: 'Armazenamento',
  PSU: 'Fonte',
  COOLER: 'Cooler',
  CASE: 'Gabinete',
  FAN: 'Ventoinhas',
  MONITOR: 'Monitor',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Headset',
  MICROPHONE: 'Microfone',
  WEBCAM: 'Webcam',
  MOUSEPAD: 'Mousepad',
  CONTROLLER: 'Controle',
};

export const categoryIcon: Record<string, string> = {
  CPU: '◳',
  GPU: '▤',
  MOTHERBOARD: '⊞',
  RAM: '▥',
  STORAGE: '⬒',
  PSU: '⏻',
  COOLER: '❄',
  CASE: '▢',
  FAN: '◎',
  MONITOR: '▭',
  KEYBOARD: '⌨',
  MOUSE: '⬭',
  HEADSET: '⌾',
  MICROPHONE: '⏺',
  WEBCAM: '◉',
  MOUSEPAD: '▬',
  CONTROLLER: '⎈',
};

/** Formata moeda no padrão brasileiro sem depender de Intl completo no Hermes. */
export function money(value: number, currency = 'BRL'): string {
  const symbol = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : currency;
  const rounded = Math.round(value);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${symbol} ${formatted}`;
}

/** "há 3 dias", "agora". Datas absolutas em feed social envelhecem mal. */
export function timeAgo(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  return `${Math.floor(days / 365)}a`;
}
