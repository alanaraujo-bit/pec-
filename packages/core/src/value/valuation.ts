/**
 * Valor estimado do PC.
 *
 * Toda saída daqui é uma ESTIMATIVA e a interface é obrigada a dizer isso. Depreciação de
 * hardware varia com câmbio, disponibilidade e hype — apresentar um número exato seria
 * mentir com precisão falsa. Por isso devolvemos sempre uma faixa, e não um valor único.
 *
 * A arquitetura é regional desde o começo: `RegionalPricing` isola tudo que muda por país.
 * O MVP calibra o Brasil, mas nada aqui é específico dele.
 */

import type { CatalogComponent } from '../catalog/types.ts';
import { isPeripheral } from '../catalog/types.ts';
import type { ComponentCondition, Rig, RigComponent } from '../rig/types.ts';

export interface RegionalPricing {
  region: string;
  currency: string;
  /**
   * Multiplicador sobre o preço em dólar até o preço praticado na região, já incluindo
   * impostos, frete e margem. No Brasil o hardware custa bem mais que a conversão direta.
   */
  retailMultiplier: number;
  /** Cotação da moeda local por dólar. */
  fxRate: number;
  /** Quanto o mercado usado local cobra em relação ao novo equivalente. */
  usedMarketRatio: number;
}

export const REGIONAL_PRICING: Record<string, RegionalPricing> = {
  BR: { region: 'BR', currency: 'BRL', retailMultiplier: 1.55, fxRate: 5.4, usedMarketRatio: 0.72 },
  US: { region: 'US', currency: 'USD', retailMultiplier: 1.0, fxRate: 1.0, usedMarketRatio: 0.68 },
  PT: { region: 'PT', currency: 'EUR', retailMultiplier: 1.22, fxRate: 0.92, usedMarketRatio: 0.7 },
};

export function pricingFor(region: string): RegionalPricing {
  return REGIONAL_PRICING[region] ?? REGIONAL_PRICING.BR!;
}

/**
 * Curva de depreciação por idade.
 *
 * Hardware não deprecia linearmente: cai rápido nos dois primeiros anos (quando a geração
 * seguinte chega) e depois estabiliza num piso. Peças muito antigas param de cair porque
 * viram peça de reposição — o valor nunca vai a zero enquanto funcionar.
 */
function depreciationFactor(ageYears: number): number {
  if (ageYears <= 0) return 1.0;
  if (ageYears <= 1) return 0.82;
  if (ageYears <= 2) return 0.66;
  if (ageYears <= 3) return 0.52;
  if (ageYears <= 4) return 0.41;
  if (ageYears <= 5) return 0.32;
  if (ageYears <= 7) return 0.22;
  if (ageYears <= 10) return 0.14;
  return 0.09;
}

const CONDITION_FACTOR: Record<ComponentCondition, number> = {
  new: 1.0,
  'like-new': 0.92,
  used: 0.8,
  worn: 0.62,
};

/**
 * Peças com desgaste mecânico ou eletroquímico perdem mais valor com o tempo do que
 * peças de estado sólido. Tratar tudo igual erraria feio em fonte e HD.
 */
const CATEGORY_WEAR: Partial<Record<string, number>> = {
  PSU: 0.88,
  STORAGE: 0.9,
  FAN: 0.85,
  COOLER: 0.92,
};

export interface ComponentValue {
  componentId: string;
  name: string;
  category: string;
  quantity: number;
  /** Valor unitário estimado na moeda da região. */
  unitValue: number;
  totalValue: number;
  /** Faixa de negociação realista. */
  rangeLow: number;
  rangeHigh: number;
  confidence: 'high' | 'medium' | 'low';
  /** Quando não há MSRP no catálogo, não inventamos preço. */
  estimated: boolean;
}

export interface RigValuation {
  currency: string;
  region: string;
  /** Soma das estimativas. */
  total: number;
  rangeLow: number;
  rangeHigh: number;
  components: ComponentValue[];
  /** Quanto o dono declarou ter pago, quando informou. Permite comparar com o valor atual. */
  declaredSpend: number | null;
  /** Peças sem preço de referência — o produto precisa admitir a lacuna. */
  unpricedCount: number;
  /** Valor só das peças internas, sem periféricos. É o que interessa para ranking. */
  coreTotal: number;
}

function ageOf(component: CatalogComponent, item: RigComponent, now: Date): number {
  // Preferimos a data de aquisição declarada; o ano de lançamento é o fallback.
  if (item.acquiredAt) {
    const years = (now.getTime() - item.acquiredAt.getTime()) / (365.25 * 24 * 3600 * 1000);
    // Comprar usado não rejuvenesce a peça: nunca abaixo da idade do lançamento.
    return Math.max(years, now.getFullYear() - component.releaseYear);
  }
  return Math.max(0, now.getFullYear() - component.releaseYear);
}

export function valueComponent(
  item: RigComponent,
  pricing: RegionalPricing,
  now: Date = new Date(),
): ComponentValue {
  const c = item.component;

  if (c.msrpUsd === null) {
    return {
      componentId: c.id,
      name: c.fullName,
      category: c.category,
      quantity: item.quantity,
      unitValue: 0,
      totalValue: 0,
      rangeLow: 0,
      rangeHigh: 0,
      confidence: 'low',
      estimated: false,
    };
  }

  const age = ageOf(c, item, now);
  const localNewPrice = c.msrpUsd * pricing.fxRate * pricing.retailMultiplier;

  const unit =
    localNewPrice *
    depreciationFactor(age) *
    CONDITION_FACTOR[item.condition] *
    (CATEGORY_WEAR[c.category] ?? 1.0) *
    (item.condition === 'new' ? 1.0 : pricing.usedMarketRatio / 0.72);

  // A faixa alarga com a idade: peça antiga tem mercado menos previsível.
  const spread = age <= 1 ? 0.1 : age <= 3 ? 0.16 : 0.24;

  return {
    componentId: c.id,
    name: c.fullName,
    category: c.category,
    quantity: item.quantity,
    unitValue: Math.round(unit),
    totalValue: Math.round(unit * item.quantity),
    rangeLow: Math.round(unit * (1 - spread) * item.quantity),
    rangeHigh: Math.round(unit * (1 + spread) * item.quantity),
    confidence: age <= 2 ? 'high' : age <= 5 ? 'medium' : 'low',
    estimated: true,
  };
}

export function valuateRig(rig: Rig, region: string, now: Date = new Date()): RigValuation {
  const pricing = pricingFor(region);
  const components = rig.components.map((item) => valueComponent(item, pricing, now));

  const priced = components.filter((c) => c.estimated);
  const declared = rig.components
    .map((c) => c.paidAmount)
    .filter((v): v is number => v !== null);

  const coreTotal = components
    .filter((c) => !isPeripheral(c.category as never))
    .reduce((sum, c) => sum + c.totalValue, 0);

  return {
    currency: pricing.currency,
    region: pricing.region,
    total: Math.round(priced.reduce((sum, c) => sum + c.totalValue, 0)),
    rangeLow: Math.round(priced.reduce((sum, c) => sum + c.rangeLow, 0)),
    rangeHigh: Math.round(priced.reduce((sum, c) => sum + c.rangeHigh, 0)),
    components,
    declaredSpend: declared.length > 0 ? declared.reduce((a, b) => a + b, 0) : null,
    unpricedCount: components.length - priced.length,
    coreTotal: Math.round(coreTotal),
  };
}

/**
 * Faixa sugerida para anunciar uma peça no marketplace. Devolve a faixa, não um preço —
 * quem decide é o vendedor, e sugerir um número único seria fingir uma precisão que
 * o mercado de usados não tem.
 */
export interface SellingGuidance {
  suggestedLow: number;
  suggestedHigh: number;
  /** Ponto onde a peça costuma sair rápido. */
  quickSale: number;
  currency: string;
  note: string;
}

export function suggestSellingPrice(
  item: RigComponent,
  region: string,
  now: Date = new Date(),
): SellingGuidance | null {
  const pricing = pricingFor(region);
  const value = valueComponent(item, pricing, now);
  if (!value.estimated) return null;

  return {
    suggestedLow: value.rangeLow,
    suggestedHigh: value.rangeHigh,
    quickSale: Math.round(value.rangeLow * 0.92),
    currency: pricing.currency,
    note:
      value.confidence === 'high'
        ? 'Peça recente, mercado previsível.'
        : 'Peça mais antiga — o preço varia bastante conforme a procura.',
  };
}
