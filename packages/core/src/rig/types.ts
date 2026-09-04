/**
 * Um "rig" é uma máquina cadastrada. Um usuário pode ter vários — principal, notebook,
 * PC de trabalho, PC antigo — e cada um tem identidade, saúde, score e histórico próprios.
 */

import type { CatalogComponent, HardwareCategory } from '../catalog/types.ts';
import {
  asCase,
  asCooler,
  asCpu,
  asGpu,
  asMonitor,
  asMotherboard,
  asPsu,
  asRam,
  asStorage,
} from '../catalog/types.ts';

export type RigKind = 'desktop' | 'laptop' | 'console-pc' | 'server';

export type ComponentCondition = 'new' | 'like-new' | 'used' | 'worn';

export const CONDITION_LABEL: Record<ComponentCondition, string> = {
  new: 'Novo',
  'like-new': 'Seminovo',
  used: 'Usado',
  worn: 'Bem usado',
};

/**
 * Um componente instalado numa máquina.
 *
 * `quantity` existe porque 2×16GB não é a mesma coisa que 1×32GB — a diferença é
 * dual-channel, que vale performance real. O mesmo vale para SSDs, fans e monitores.
 */
export interface RigComponent {
  id: string;
  component: CatalogComponent;
  quantity: number;
  condition: ComponentCondition;
  /** Quando entrou nesta máquina. Base do histórico de evolução e da depreciação. */
  acquiredAt: Date | null;
  /** O que o usuário pagou, na moeda dele. Alimenta o custo real do setup. */
  paidAmount: number | null;
  paidCurrency: string | null;
  notes: string | null;
}

export interface Rig {
  id: string;
  ownerId: string;
  name: string;
  kind: RigKind;
  /** A máquina que representa o usuário nos rankings e no perfil. */
  isPrimary: boolean;
  components: RigComponent[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Leitura da composição
// ---------------------------------------------------------------------------

export function componentsOf(rig: Rig, category: HardwareCategory): RigComponent[] {
  return rig.components.filter((c) => c.component.category === category);
}

export function firstOf(rig: Rig, category: HardwareCategory): RigComponent | null {
  return componentsOf(rig, category)[0] ?? null;
}

/**
 * Resolve os componentes centrais uma única vez. Todo módulo do engine recebe isso
 * em vez de vasculhar o array de novo — mantém o custo linear e o código legível.
 */
export interface RigParts {
  cpu: ReturnType<typeof asCpu>;
  gpu: ReturnType<typeof asGpu>;
  motherboard: ReturnType<typeof asMotherboard>;
  psu: ReturnType<typeof asPsu>;
  cooler: ReturnType<typeof asCooler>;
  pcCase: ReturnType<typeof asCase>;
  monitors: Array<{ item: RigComponent; spec: NonNullable<ReturnType<typeof asMonitor>> }>;
  ramModules: Array<{ item: RigComponent; spec: NonNullable<ReturnType<typeof asRam>> }>;
  drives: Array<{ item: RigComponent; spec: NonNullable<ReturnType<typeof asStorage>> }>;
  fanCount: number;
  /** Quantidade total de módulos de RAM instalados (respeitando `quantity`). */
  ramStickCount: number;
  totalRamGb: number;
  totalStorageGb: number;
}

export function resolveParts(rig: Rig): RigParts {
  const pick = <T>(category: HardwareCategory, narrow: (c: CatalogComponent) => T | null): T | null => {
    const item = firstOf(rig, category);
    return item ? narrow(item.component) : null;
  };

  const ramModules = componentsOf(rig, 'RAM')
    .map((item) => {
      const spec = asRam(item.component);
      return spec ? { item, spec } : null;
    })
    .filter((x): x is { item: RigComponent; spec: NonNullable<ReturnType<typeof asRam>> } => x !== null);

  const drives = componentsOf(rig, 'STORAGE')
    .map((item) => {
      const spec = asStorage(item.component);
      return spec ? { item, spec } : null;
    })
    .filter(
      (x): x is { item: RigComponent; spec: NonNullable<ReturnType<typeof asStorage>> } => x !== null,
    );

  const monitors = componentsOf(rig, 'MONITOR')
    .map((item) => {
      const spec = asMonitor(item.component);
      return spec ? { item, spec } : null;
    })
    .filter(
      (x): x is { item: RigComponent; spec: NonNullable<ReturnType<typeof asMonitor>> } => x !== null,
    );

  const ramStickCount = ramModules.reduce((sum, m) => sum + m.item.quantity, 0);
  const totalRamGb = ramModules.reduce(
    (sum, m) => sum + m.spec.spec.capacityGb * m.item.quantity,
    0,
  );
  const totalStorageGb = drives.reduce(
    (sum, d) => sum + d.spec.spec.capacityGb * d.item.quantity,
    0,
  );

  return {
    cpu: pick('CPU', asCpu),
    gpu: pick('GPU', asGpu),
    motherboard: pick('MOTHERBOARD', asMotherboard),
    psu: pick('PSU', asPsu),
    cooler: pick('COOLER', asCooler),
    pcCase: pick('CASE', asCase),
    monitors,
    ramModules,
    drives,
    fanCount: componentsOf(rig, 'FAN').reduce((sum, f) => sum + f.quantity, 0),
    ramStickCount,
    totalRamGb,
    totalStorageGb,
  };
}

/**
 * O quanto o cadastro está completo. O engine precisa disso para saber quando calar a
 * boca: sem CPU e GPU não existe análise honesta, e fingir que existe é o oposto do produto.
 */
export interface Completeness {
  ratio: number;
  missing: HardwareCategory[];
  /** Mínimo para qualquer análise de performance. */
  canAnalyzePerformance: boolean;
  /** Mínimo para checar fonte e térmica. */
  canAnalyzePower: boolean;
}

export function completenessOf(rig: Rig): Completeness {
  const essential: HardwareCategory[] = ['CPU', 'GPU', 'RAM', 'STORAGE', 'MOTHERBOARD', 'PSU', 'COOLER'];
  const missing = essential.filter((cat) => componentsOf(rig, cat).length === 0);
  const parts = resolveParts(rig);

  return {
    ratio: (essential.length - missing.length) / essential.length,
    missing,
    canAnalyzePerformance: parts.cpu !== null && parts.gpu !== null,
    canAnalyzePower: parts.cpu !== null && parts.gpu !== null && parts.psu !== null,
  };
}

/** Idade em anos do componente mais novo — proxy de quão atual é a máquina. */
export function rigAgeYears(rig: Rig, now: Date = new Date()): number | null {
  const years = rig.components
    .map((c) => c.component.releaseYear)
    .filter((y) => y > 1990);
  if (years.length === 0) return null;
  const newest = Math.max(...years);
  return Math.max(0, now.getFullYear() - newest);
}
