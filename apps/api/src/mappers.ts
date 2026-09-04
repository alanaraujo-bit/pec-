/**
 * Tradução entre as linhas do Prisma e os tipos de domínio do `@pece/core`.
 *
 * Esta camada existe para que o engine nunca saiba que existe um banco. É o que garante
 * que a mesma inteligência rode no servidor hoje e possa rodar no dispositivo amanhã,
 * sem reescrever regra nenhuma.
 */

import type {
  CatalogComponent,
  ComponentSpec,
  HardwareCategory,
  Rig,
  RigComponent,
  UsageProfile,
  WorkloadWeight,
  Priority,
  Resolution,
} from '@pece/core';
import { DEFAULT_PROFILE } from '@pece/core';
import type { Component, Profile, Rig as DbRig, RigComponent as DbRigComponent } from '@prisma/client';

export function toCatalogComponent(row: Component): CatalogComponent {
  return {
    id: row.id,
    category: row.category as HardwareCategory,
    brand: row.brand,
    family: row.family,
    model: row.model,
    fullName: row.fullName,
    releaseYear: row.releaseYear,
    releaseQuarter: row.releaseQuarter,
    spec: row.spec as unknown as ComponentSpec,
    msrpUsd: row.msrpUsd,
    discontinued: row.discontinued,
    imageUrl: row.imageUrl,
  };
}

export function toRigComponent(row: DbRigComponent & { component: Component }): RigComponent {
  return {
    id: row.id,
    component: toCatalogComponent(row.component),
    quantity: row.quantity,
    condition: row.condition as RigComponent['condition'],
    acquiredAt: row.acquiredAt,
    paidAmount: row.paidAmount,
    paidCurrency: row.paidCurrency,
    notes: row.notes,
  };
}

export type DbRigWithComponents = DbRig & {
  components: Array<DbRigComponent & { component: Component }>;
};

export function toRig(row: DbRigWithComponents): Rig {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    kind: row.kind as Rig['kind'],
    isPrimary: row.isPrimary,
    // Peças removidas continuam no banco para o histórico, mas não entram na análise.
    components: row.components.filter((c) => c.removedAt === null).map(toRigComponent),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toUsageProfile(row: Profile | null, region: string): UsageProfile {
  if (!row) return { ...DEFAULT_PROFILE, region };

  return {
    workloads: (row.workloads as unknown as WorkloadWeight[]) ?? DEFAULT_PROFILE.workloads,
    resolution: row.resolution as Resolution,
    targetFps: row.targetFps,
    budget: {
      tier: row.budgetTier as UsageProfile['budget']['tier'],
      amount: row.budgetAmount,
      currency: row.currency,
    },
    priorities: (row.priorities as unknown as Priority[]) ?? [],
    region,
    expertise: row.expertise as UsageProfile['expertise'],
  };
}
