/**
 * Catálogo completo.
 *
 * Seed curado das peças mais presentes no mercado brasileiro. Não é o catálogo definitivo
 * e não pretende ser: o caminho de ingestão é real e a expansão é aditiva — acrescentar
 * uma peça é acrescentar uma linha, sem tocar em nada do engine.
 */

import type { CatalogComponent, HardwareCategory } from '../types.ts';
import { CPU_CATALOG } from './cpus.ts';
import { GPU_CATALOG } from './gpus.ts';
import { PLATFORM_CATALOG } from './platform.ts';
import { MONITOR_CATALOG, PERIPHERAL_CATALOG } from './peripherals.ts';

export { CPU_CATALOG } from './cpus.ts';
export { GPU_CATALOG } from './gpus.ts';
export {
  CASE_CATALOG,
  COOLER_CATALOG,
  FAN_CATALOG,
  MOTHERBOARD_CATALOG,
  PLATFORM_CATALOG,
  PSU_CATALOG,
  RAM_CATALOG,
  STORAGE_CATALOG,
} from './platform.ts';
export { MONITOR_CATALOG, PERIPHERAL_CATALOG } from './peripherals.ts';

export const FULL_CATALOG: CatalogComponent[] = [
  ...CPU_CATALOG,
  ...GPU_CATALOG,
  ...PLATFORM_CATALOG,
  ...MONITOR_CATALOG,
  ...PERIPHERAL_CATALOG,
];

const BY_ID = new Map(FULL_CATALOG.map((c) => [c.id, c]));

export function componentById(id: string): CatalogComponent | undefined {
  return BY_ID.get(id);
}

export function componentsByCategory(category: HardwareCategory): CatalogComponent[] {
  return FULL_CATALOG.filter((c) => c.category === category);
}

/** Marcas de uma categoria, para o primeiro passo da navegação guiada. */
export function brandsIn(category: HardwareCategory): string[] {
  return [...new Set(componentsByCategory(category).map((c) => c.brand))].sort();
}

/** Famílias de uma marca — segundo passo. */
export function familiesIn(category: HardwareCategory, brand: string): string[] {
  return [
    ...new Set(
      componentsByCategory(category)
        .filter((c) => c.brand === brand)
        .map((c) => c.family),
    ),
  ].sort();
}

/** Modelos de uma família — terceiro e último passo. */
export function modelsIn(category: HardwareCategory, brand: string, family: string): CatalogComponent[] {
  return componentsByCategory(category)
    .filter((c) => c.brand === brand && c.family === family)
    .sort((a, b) => b.releaseYear - a.releaseYear || a.model.localeCompare(b.model));
}
