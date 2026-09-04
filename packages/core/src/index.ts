/**
 * @pece/core — domínio do Pecê.
 *
 * TypeScript puro, sem dependência de banco, HTTP ou React. A API e o app consomem
 * daqui, e é isso que garante que a inteligência seja a mesma nos dois lados.
 */

export * from './catalog/types.ts';
export * from './catalog/seed/index.ts';

export * from './profile/types.ts';
export * from './rig/types.ts';

export * from './engine/findings.ts';
export * from './engine/performance.ts';
export * from './engine/subsystems.ts';
export * from './engine/compatibility.ts';
export * from './engine/diagnosis.ts';
export * from './engine/scenarios.ts';

export * from './score/setupScore.ts';
export * from './value/valuation.ts';
export * from './compare/compare.ts';
export * from './market/listing.ts';
