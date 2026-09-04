/**
 * Lógica pura do gesto de reação, separada do componente.
 *
 * Existe separada por um motivo concreto: nesta máquina não há emulador (ver BLOCKERS.md),
 * então não dá para *sentir* o gesto. O que dá para garantir é que o mapeamento de posição
 * do dedo para reação está correto — e isso é testável sem renderizar nada.
 *
 * O que continua exigindo aparelho: o tato do háptico e a suavidade da animação.
 */

export const REACTION_ORDER = ['LOVE', 'LIKE', 'DISLIKE'] as const;
export type ReactionKind = (typeof REACTION_ORDER)[number];

/** Distância horizontal entre os centros de dois itens da bandeja. */
export const SLOT_WIDTH = 52;

/** Abaixo desta distância vertical o gesto é cancelado — a saída de quem se arrependeu. */
export const CANCEL_THRESHOLD_Y = 90;

/** Índice inválido, representando "nenhuma reação selecionada". */
export const NO_SELECTION = -1;

/**
 * Converte o deslocamento do dedo no índice da reação sob ele.
 *
 * `translationY` acima do limite cancela, mesmo que o X aponte para um item válido:
 * arrastar para baixo é o gesto natural de desistir.
 */
export function indexFromTranslation(translationX: number, translationY: number): number {
  if (translationY > CANCEL_THRESHOLD_Y) return NO_SELECTION;

  const raw = Math.round(translationX / SLOT_WIDTH);
  return Math.max(0, Math.min(REACTION_ORDER.length - 1, raw));
}

/**
 * Qual reação aplicar ao soltar o dedo.
 *
 * Regra: soltar sobre a reação que já estava ativa remove a reação. O mesmo gesto liga e
 * desliga, o que evita precisar de um botão separado de "desfazer".
 */
export function resolveReaction(
  index: number,
  current: ReactionKind | null,
): { action: 'set'; kind: ReactionKind } | { action: 'clear' } | { action: 'none' } {
  if (index < 0 || index >= REACTION_ORDER.length) return { action: 'none' };

  const kind = REACTION_ORDER[index]!;
  if (kind === current) return { action: 'clear' };
  return { action: 'set', kind };
}
