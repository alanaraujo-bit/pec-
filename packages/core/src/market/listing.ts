/**
 * Marketplace — regras de anúncio de peça.
 *
 * Este módulo existe para que o marketplace nasça dentro do domínio, e não dentro de uma
 * rota. É a garantia estrutural do princípio do produto: o anúncio é uma **consequência**
 * da valuation, nunca uma influência sobre ela. Nada aqui é importado por `diagnosis`,
 * `setupScore` ou `scenarios` — a dependência é de mão única, e `listing.test.ts` trava isso
 * comparando o diagnóstico antes e depois de anunciar todas as peças da máquina.
 *
 * Duas decisões que carregam o resto:
 *
 * 1. **O engine avalia o preço, não o autoriza.** `assessAskingPrice` devolve uma leitura
 *    honesta ("está acima da faixa, tende a demorar"), nunca um bloqueio. Quem decide o
 *    preço é o dono da peça; o produto só se recusa a fingir que sabe mais do que sabe.
 *
 * 2. **Sem preço de referência não existe anúncio assistido.** Quando a peça não tem MSRP
 *    no catálogo, `buildListingDraft` devolve `null` em vez de R$ 0. A lacuna é declarada,
 *    do mesmo jeito que `RigValuation.unpricedCount` faz na valuation.
 */

import { CONDITION_LABEL, type RigComponent } from '../rig/types.ts';
import { suggestSellingPrice, type SellingGuidance } from '../value/valuation.ts';

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export type ListingStatus = 'active' | 'reserved' | 'sold' | 'withdrawn';

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  active: 'Anunciada',
  reserved: 'Reservada',
  sold: 'Vendida',
  withdrawn: 'Retirada',
};

/**
 * Transições permitidas.
 *
 * `sold` é terminal de propósito: a venda mexe na máquina (a peça sai da análise e entra
 * no histórico) e virar atrás disso deixaria o PC Evolution contando uma história falsa.
 * Reabrir um anúncio vendido é criar outro anúncio, não desfazer o passado.
 */
const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  active: ['reserved', 'sold', 'withdrawn'],
  reserved: ['active', 'sold', 'withdrawn'],
  withdrawn: ['active'],
  sold: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

/** Mensagem para o usuário quando a transição é inválida. `null` quando é válida. */
export function transitionError(from: ListingStatus, to: ListingStatus): string | null {
  if (canTransition(from, to)) return null;
  if (from === 'sold') {
    return 'Esta peça já foi vendida. O histórico da máquina registrou a saída — para anunciar de novo, crie um novo anúncio.';
  }
  return `Não dá para ir de "${LISTING_STATUS_LABEL[from]}" para "${LISTING_STATUS_LABEL[to]}".`;
}

/** Anúncio ainda visível para quem procura peça. */
export function isOpen(status: ListingStatus): boolean {
  return status === 'active' || status === 'reserved';
}

// ---------------------------------------------------------------------------
// Leitura do preço pedido
// ---------------------------------------------------------------------------

export type PriceFairness = 'below-range' | 'in-range' | 'above-range' | 'far-above-range';

export interface PriceAssessment {
  fairness: PriceFairness;
  /** Frase curta e sem julgamento moral, para mostrar ao vendedor e ao comprador. */
  note: string;
  /** Distância percentual até o meio da faixa estimada. Negativo é abaixo. */
  deltaPercent: number;
  suggestedLow: number;
  suggestedHigh: number;
  quickSale: number;
  currency: string;
}

/** Acima disso o preço deixou de ser "otimista" e virou irreal para o mercado usado. */
const FAR_ABOVE_MULTIPLIER = 1.2;

/** Uma frase por faixa. Fica no escopo do módulo para que as faixas e a avaliação nunca divirjam. */
const NOTE: Record<PriceFairness, string> = {
  'below-range':
    'Abaixo da faixa estimada. Tende a sair rápido — só confira se você não está deixando dinheiro na mesa.',
  'in-range': 'Dentro da faixa estimada para esta peça na sua região.',
  'above-range':
    'Um pouco acima da faixa estimada. É uma escolha legítima, mas costuma demorar mais para sair.',
  'far-above-range':
    'Bem acima da faixa estimada. Quem compra usado compara preço, e anúncios nessa distância raramente fecham.',
};

/**
 * As faixas de preço com seus rótulos, na ordem.
 *
 * Existe para que o app possa dar retorno enquanto a pessoa digita o preço **sem
 * reimplementar a regra**: a tela compara o número com limites que vieram do engine e
 * mostra o rótulo que veio junto. Quem decide continua sendo este arquivo — o servidor
 * reavalia no momento de salvar, e a tela nunca discorda dele.
 */
export interface PriceBand {
  fairness: PriceFairness;
  label: string;
  note: string;
  /** Limite inferior, inclusivo. */
  from: number;
  /** Limite superior, inclusivo. Nulo no último, que é aberto. */
  to: number | null;
}

export function priceBands(guidance: SellingGuidance): PriceBand[] {
  const farAbove = Math.round(guidance.suggestedHigh * FAR_ABOVE_MULTIPLIER);
  return [
    { fairness: 'below-range', label: 'Abaixo da faixa', note: NOTE['below-range'], from: 0, to: guidance.suggestedLow - 1 },
    { fairness: 'in-range', label: 'Na faixa', note: NOTE['in-range'], from: guidance.suggestedLow, to: guidance.suggestedHigh },
    { fairness: 'above-range', label: 'Acima da faixa', note: NOTE['above-range'], from: guidance.suggestedHigh + 1, to: farAbove },
    { fairness: 'far-above-range', label: 'Bem acima', note: NOTE['far-above-range'], from: farAbove + 1, to: null },
  ];
}

export function assessAskingPrice(asking: number, guidance: SellingGuidance): PriceAssessment {
  const mid = (guidance.suggestedLow + guidance.suggestedHigh) / 2;
  const deltaPercent = mid > 0 ? Math.round(((asking - mid) / mid) * 100) : 0;

  // Deriva das mesmas faixas que o app recebe: um lugar só decide onde cada preço cai.
  const bands = priceBands(guidance);
  const band = bands.find((b) => b.to === null || asking <= b.to) ?? bands[bands.length - 1]!;

  return {
    fairness: band.fairness,
    note: band.note,
    deltaPercent,
    suggestedLow: guidance.suggestedLow,
    suggestedHigh: guidance.suggestedHigh,
    quickSale: guidance.quickSale,
    currency: guidance.currency,
  };
}

// ---------------------------------------------------------------------------
// Rascunho do anúncio
// ---------------------------------------------------------------------------

export interface ListingDraft {
  rigComponentId: string;
  componentId: string;
  category: string;
  /** Título pronto, montado a partir do catálogo — o vendedor pode trocar. */
  title: string;
  condition: string;
  conditionLabel: string;
  quantity: number;
  guidance: SellingGuidance;
  /**
   * Ficha técnica que acompanha o anúncio. Existe porque a diferença entre uma 3070 de
   * 8GB e uma Ti é exatamente o que o texto livre de um classificado esconde.
   */
  highlights: string[];
}

/**
 * Monta o rascunho de anúncio de uma peça da máquina.
 *
 * Devolve `null` quando não há preço de referência: sem isso o produto estaria chutando um
 * valor, e chutar preço é pior do que admitir que não sabe.
 */
export function buildListingDraft(
  item: RigComponent,
  region: string,
  now: Date = new Date(),
): ListingDraft | null {
  const guidance = suggestSellingPrice(item, region, now);
  if (!guidance) return null;

  const c = item.component;
  const conditionLabel = CONDITION_LABEL[item.condition];

  const highlights = [
    `${c.brand} ${c.family}`,
    `Lançamento ${c.releaseYear}`,
    `Estado: ${conditionLabel.toLowerCase()}`,
  ];
  if (item.acquiredAt) {
    highlights.push(`Em uso desde ${item.acquiredAt.getFullYear()}`);
  }

  return {
    rigComponentId: item.id,
    componentId: c.id,
    category: c.category,
    title: `${c.fullName} — ${conditionLabel}`,
    condition: item.condition,
    conditionLabel,
    quantity: item.quantity,
    guidance,
    highlights,
  };
}
