/**
 * Catálogo de processadores.
 *
 * Três índices por peça, normalizados com Ryzen 7 9800X3D = 100 em jogos e
 * Ryzen 9 9950X = 100 em multi-thread.
 *
 * `gaming` NÃO é derivado de `singleThread` e `multiThread` — é medido separadamente,
 * porque cache e latência de memória mandam mais em jogo do que frequência ou número de
 * núcleos. É por isso que um 9800X3D bate um 285K em jogo e perde feio em render, e é
 * exatamente esse tipo de nuance que um índice único de "potência" destruiria.
 */

import type { CatalogComponent, CpuSpec, MemoryType } from '../types.ts';

interface CpuSeed {
  id: string;
  brand: string;
  family: string;
  model: string;
  year: number;
  quarter?: number;
  socket: string;
  cores: number;
  threads: number;
  pCores?: number;
  eCores?: number;
  base: number;
  boost: number;
  l3: number;
  tdp: number;
  peak: number;
  igpu: string | null;
  memory: MemoryType[];
  litho: number;
  /** Índices: gaming (9800X3D=100), single-thread, multi-thread (9950X=100). */
  gaming: number;
  st: number;
  mt: number;
  msrp: number | null;
  discontinued?: boolean;
}

const CPU_SEEDS: CpuSeed[] = [
  // ---- AMD AM5 — Zen 5 ----
  { id: 'cpu-r9-9950x3d', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 9 9950X3D', year: 2025, quarter: 1, socket: 'AM5', cores: 16, threads: 32, base: 4.3, boost: 5.7, l3: 128, tdp: 170, peak: 200, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 101, st: 100, mt: 100, msrp: 699 },
  { id: 'cpu-r7-9800x3d', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 7 9800X3D', year: 2024, quarter: 4, socket: 'AM5', cores: 8, threads: 16, base: 4.7, boost: 5.2, l3: 96, tdp: 120, peak: 162, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 100, st: 92, mt: 78, msrp: 479 },
  { id: 'cpu-r9-9950x', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 9 9950X', year: 2024, quarter: 3, socket: 'AM5', cores: 16, threads: 32, base: 4.3, boost: 5.7, l3: 64, tdp: 170, peak: 200, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 88, st: 100, mt: 100, msrp: 649 },
  { id: 'cpu-r9-9900x', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 9 9900X', year: 2024, quarter: 3, socket: 'AM5', cores: 12, threads: 24, base: 4.4, boost: 5.6, l3: 64, tdp: 120, peak: 162, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 86, st: 98, mt: 82, msrp: 499 },
  { id: 'cpu-r7-9700x', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 7 9700X', year: 2024, quarter: 3, socket: 'AM5', cores: 8, threads: 16, base: 3.8, boost: 5.5, l3: 32, tdp: 65, peak: 88, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 84, st: 96, mt: 65, msrp: 359 },
  { id: 'cpu-r5-9600x', brand: 'AMD', family: 'Ryzen 9000', model: 'Ryzen 5 9600X', year: 2024, quarter: 3, socket: 'AM5', cores: 6, threads: 12, base: 3.9, boost: 5.4, l3: 32, tdp: 65, peak: 88, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 4, gaming: 80, st: 94, mt: 50, msrp: 279 },

  // ---- AMD AM5 — Zen 4 ----
  { id: 'cpu-r9-7950x3d', brand: 'AMD', family: 'Ryzen 7000', model: 'Ryzen 9 7950X3D', year: 2023, quarter: 1, socket: 'AM5', cores: 16, threads: 32, base: 4.2, boost: 5.7, l3: 128, tdp: 120, peak: 162, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 5, gaming: 95, st: 95, mt: 95, msrp: 699 },
  { id: 'cpu-r7-7800x3d', brand: 'AMD', family: 'Ryzen 7000', model: 'Ryzen 7 7800X3D', year: 2023, quarter: 2, socket: 'AM5', cores: 8, threads: 16, base: 4.2, boost: 5.0, l3: 96, tdp: 120, peak: 162, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 5, gaming: 94, st: 84, mt: 68, msrp: 449 },
  { id: 'cpu-r7-7700x', brand: 'AMD', family: 'Ryzen 7000', model: 'Ryzen 7 7700X', year: 2022, quarter: 3, socket: 'AM5', cores: 8, threads: 16, base: 4.5, boost: 5.4, l3: 32, tdp: 105, peak: 142, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 5, gaming: 78, st: 90, mt: 62, msrp: 399 },
  { id: 'cpu-r5-7600x', brand: 'AMD', family: 'Ryzen 7000', model: 'Ryzen 5 7600X', year: 2022, quarter: 3, socket: 'AM5', cores: 6, threads: 12, base: 4.7, boost: 5.3, l3: 32, tdp: 105, peak: 142, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 5, gaming: 76, st: 89, mt: 47, msrp: 299 },
  { id: 'cpu-r5-7600', brand: 'AMD', family: 'Ryzen 7000', model: 'Ryzen 5 7600', year: 2023, quarter: 1, socket: 'AM5', cores: 6, threads: 12, base: 3.8, boost: 5.1, l3: 32, tdp: 65, peak: 88, igpu: 'Radeon Graphics', memory: ['DDR5'], litho: 5, gaming: 73, st: 85, mt: 45, msrp: 229 },

  // ---- AMD AM4 — ainda enorme no mercado brasileiro ----
  { id: 'cpu-r7-5800x3d', brand: 'AMD', family: 'Ryzen 5000', model: 'Ryzen 7 5800X3D', year: 2022, quarter: 2, socket: 'AM4', cores: 8, threads: 16, base: 3.4, boost: 4.5, l3: 96, tdp: 105, peak: 142, igpu: null, memory: ['DDR4'], litho: 7, gaming: 85, st: 72, mt: 58, msrp: 449, discontinued: true },
  { id: 'cpu-r7-5700x3d', brand: 'AMD', family: 'Ryzen 5000', model: 'Ryzen 7 5700X3D', year: 2024, quarter: 1, socket: 'AM4', cores: 8, threads: 16, base: 3.0, boost: 4.1, l3: 96, tdp: 105, peak: 142, igpu: null, memory: ['DDR4'], litho: 7, gaming: 81, st: 68, mt: 54, msrp: 249 },
  { id: 'cpu-r7-5700x', brand: 'AMD', family: 'Ryzen 5000', model: 'Ryzen 7 5700X', year: 2022, quarter: 2, socket: 'AM4', cores: 8, threads: 16, base: 3.4, boost: 4.6, l3: 32, tdp: 65, peak: 88, igpu: null, memory: ['DDR4'], litho: 7, gaming: 64, st: 73, mt: 50, msrp: 299 },
  { id: 'cpu-r5-5600x', brand: 'AMD', family: 'Ryzen 5000', model: 'Ryzen 5 5600X', year: 2020, quarter: 4, socket: 'AM4', cores: 6, threads: 12, base: 3.7, boost: 4.6, l3: 32, tdp: 65, peak: 88, igpu: null, memory: ['DDR4'], litho: 7, gaming: 62, st: 74, mt: 40, msrp: 299 },
  { id: 'cpu-r5-5600', brand: 'AMD', family: 'Ryzen 5000', model: 'Ryzen 5 5600', year: 2022, quarter: 2, socket: 'AM4', cores: 6, threads: 12, base: 3.5, boost: 4.4, l3: 32, tdp: 65, peak: 88, igpu: null, memory: ['DDR4'], litho: 7, gaming: 60, st: 72, mt: 39, msrp: 199 },
  { id: 'cpu-r5-3600', brand: 'AMD', family: 'Ryzen 3000', model: 'Ryzen 5 3600', year: 2019, quarter: 3, socket: 'AM4', cores: 6, threads: 12, base: 3.6, boost: 4.2, l3: 32, tdp: 65, peak: 88, igpu: null, memory: ['DDR4'], litho: 7, gaming: 48, st: 60, mt: 33, msrp: 199, discontinued: true },
  { id: 'cpu-r5-2600', brand: 'AMD', family: 'Ryzen 2000', model: 'Ryzen 5 2600', year: 2018, quarter: 2, socket: 'AM4', cores: 6, threads: 12, base: 3.4, boost: 3.9, l3: 16, tdp: 65, peak: 88, igpu: null, memory: ['DDR4'], litho: 12, gaming: 38, st: 50, mt: 27, msrp: 199, discontinued: true },

  // ---- Intel LGA1851 — Core Ultra ----
  { id: 'cpu-ultra9-285k', brand: 'Intel', family: 'Core Ultra 200', model: 'Core Ultra 9 285K', year: 2024, quarter: 4, socket: 'LGA1851', cores: 24, threads: 24, pCores: 8, eCores: 16, base: 3.7, boost: 5.7, l3: 36, tdp: 125, peak: 250, igpu: 'Intel Graphics', memory: ['DDR5'], litho: 3, gaming: 86, st: 100, mt: 98, msrp: 589 },
  { id: 'cpu-ultra7-265k', brand: 'Intel', family: 'Core Ultra 200', model: 'Core Ultra 7 265K', year: 2024, quarter: 4, socket: 'LGA1851', cores: 20, threads: 20, pCores: 8, eCores: 12, base: 3.9, boost: 5.5, l3: 30, tdp: 125, peak: 250, igpu: 'Intel Graphics', memory: ['DDR5'], litho: 3, gaming: 84, st: 97, mt: 88, msrp: 394 },
  { id: 'cpu-ultra5-245k', brand: 'Intel', family: 'Core Ultra 200', model: 'Core Ultra 5 245K', year: 2024, quarter: 4, socket: 'LGA1851', cores: 14, threads: 14, pCores: 6, eCores: 8, base: 4.2, boost: 5.2, l3: 24, tdp: 125, peak: 159, igpu: 'Intel Graphics', memory: ['DDR5'], litho: 3, gaming: 80, st: 94, mt: 68, msrp: 309 },

  // ---- Intel LGA1700 ----
  { id: 'cpu-i9-14900k', brand: 'Intel', family: 'Core 14ª geração', model: 'Core i9-14900K', year: 2023, quarter: 4, socket: 'LGA1700', cores: 24, threads: 32, pCores: 8, eCores: 16, base: 3.2, boost: 6.0, l3: 36, tdp: 125, peak: 253, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 92, st: 100, mt: 96, msrp: 589 },
  { id: 'cpu-i7-14700k', brand: 'Intel', family: 'Core 14ª geração', model: 'Core i7-14700K', year: 2023, quarter: 4, socket: 'LGA1700', cores: 20, threads: 28, pCores: 8, eCores: 12, base: 3.4, boost: 5.6, l3: 33, tdp: 125, peak: 253, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 88, st: 97, mt: 88, msrp: 409 },
  { id: 'cpu-i5-14600k', brand: 'Intel', family: 'Core 14ª geração', model: 'Core i5-14600K', year: 2023, quarter: 4, socket: 'LGA1700', cores: 14, threads: 20, pCores: 6, eCores: 8, base: 3.5, boost: 5.3, l3: 24, tdp: 125, peak: 181, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 84, st: 94, mt: 68, msrp: 319 },
  { id: 'cpu-i9-13900k', brand: 'Intel', family: 'Core 13ª geração', model: 'Core i9-13900K', year: 2022, quarter: 4, socket: 'LGA1700', cores: 24, threads: 32, pCores: 8, eCores: 16, base: 3.0, boost: 5.8, l3: 36, tdp: 125, peak: 253, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 90, st: 98, mt: 93, msrp: 589, discontinued: true },
  { id: 'cpu-i7-13700k', brand: 'Intel', family: 'Core 13ª geração', model: 'Core i7-13700K', year: 2022, quarter: 4, socket: 'LGA1700', cores: 16, threads: 24, pCores: 8, eCores: 8, base: 3.4, boost: 5.4, l3: 30, tdp: 125, peak: 253, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 86, st: 95, mt: 82, msrp: 409, discontinued: true },
  { id: 'cpu-i5-13600k', brand: 'Intel', family: 'Core 13ª geração', model: 'Core i5-13600K', year: 2022, quarter: 4, socket: 'LGA1700', cores: 14, threads: 20, pCores: 6, eCores: 8, base: 3.5, boost: 5.1, l3: 24, tdp: 125, peak: 181, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 83, st: 93, mt: 66, msrp: 319, discontinued: true },
  // O KF é eletricamente e em desempenho igual ao K; a diferença material é não ter iGPU.
  // Mantê-lo como SKU próprio evita que o diagnóstico invente vídeo integrado no PC do usuário.
  { id: 'cpu-i5-13600kf', brand: 'Intel', family: 'Core 13ª geração', model: 'Core i5-13600KF', year: 2022, quarter: 4, socket: 'LGA1700', cores: 14, threads: 20, pCores: 6, eCores: 8, base: 3.5, boost: 5.1, l3: 24, tdp: 125, peak: 181, igpu: null, memory: ['DDR4', 'DDR5'], litho: 10, gaming: 83, st: 93, mt: 66, msrp: 294, discontinued: true },
  { id: 'cpu-i5-12600k', brand: 'Intel', family: 'Core 12ª geração', model: 'Core i5-12600K', year: 2021, quarter: 4, socket: 'LGA1700', cores: 10, threads: 16, pCores: 6, eCores: 4, base: 3.7, boost: 4.9, l3: 20, tdp: 125, peak: 150, igpu: 'UHD 770', memory: ['DDR4', 'DDR5'], litho: 10, gaming: 76, st: 88, mt: 58, msrp: 289, discontinued: true },
  { id: 'cpu-i5-12400f', brand: 'Intel', family: 'Core 12ª geração', model: 'Core i5-12400F', year: 2022, quarter: 1, socket: 'LGA1700', cores: 6, threads: 12, base: 2.5, boost: 4.4, l3: 18, tdp: 65, peak: 117, igpu: null, memory: ['DDR4', 'DDR5'], litho: 10, gaming: 65, st: 80, mt: 42, msrp: 167 },

  // ---- Intel LGA1200 ----
  { id: 'cpu-i7-10700k', brand: 'Intel', family: 'Core 10ª geração', model: 'Core i7-10700K', year: 2020, quarter: 2, socket: 'LGA1200', cores: 8, threads: 16, base: 3.8, boost: 5.1, l3: 16, tdp: 125, peak: 190, igpu: 'UHD 630', memory: ['DDR4'], litho: 14, gaming: 58, st: 70, mt: 45, msrp: 374, discontinued: true },
  { id: 'cpu-i5-11400f', brand: 'Intel', family: 'Core 11ª geração', model: 'Core i5-11400F', year: 2021, quarter: 1, socket: 'LGA1200', cores: 6, threads: 12, base: 2.6, boost: 4.4, l3: 12, tdp: 65, peak: 125, igpu: null, memory: ['DDR4'], litho: 14, gaming: 55, st: 70, mt: 36, msrp: 157, discontinued: true },
  { id: 'cpu-i5-10400f', brand: 'Intel', family: 'Core 10ª geração', model: 'Core i5-10400F', year: 2020, quarter: 2, socket: 'LGA1200', cores: 6, threads: 12, base: 2.9, boost: 4.3, l3: 12, tdp: 65, peak: 90, igpu: null, memory: ['DDR4'], litho: 14, gaming: 48, st: 62, mt: 32, msrp: 157, discontinued: true },

  // ---- Intel LGA1151 ----
  { id: 'cpu-i7-8700k', brand: 'Intel', family: 'Core 8ª geração', model: 'Core i7-8700K', year: 2017, quarter: 4, socket: 'LGA1151', cores: 6, threads: 12, base: 3.7, boost: 4.7, l3: 12, tdp: 95, peak: 130, igpu: 'UHD 630', memory: ['DDR4'], litho: 14, gaming: 46, st: 62, mt: 30, msrp: 359, discontinued: true },
  { id: 'cpu-i5-9400f', brand: 'Intel', family: 'Core 9ª geração', model: 'Core i5-9400F', year: 2019, quarter: 1, socket: 'LGA1151', cores: 6, threads: 6, base: 2.9, boost: 4.1, l3: 9, tdp: 65, peak: 85, igpu: null, memory: ['DDR4'], litho: 14, gaming: 42, st: 60, mt: 24, msrp: 157, discontinued: true },
  { id: 'cpu-i5-7400', brand: 'Intel', family: 'Core 7ª geração', model: 'Core i5-7400', year: 2017, quarter: 1, socket: 'LGA1151', cores: 4, threads: 4, base: 3.0, boost: 3.5, l3: 6, tdp: 65, peak: 75, igpu: 'HD 630', memory: ['DDR4'], litho: 14, gaming: 28, st: 48, mt: 16, msrp: 182, discontinued: true },
];

export const CPU_CATALOG: CatalogComponent[] = CPU_SEEDS.map((c) => {
  const spec: CpuSpec = {
    kind: 'CPU',
    socket: c.socket,
    cores: c.cores,
    threads: c.threads,
    ...(c.pCores !== undefined ? { performanceCores: c.pCores } : {}),
    ...(c.eCores !== undefined ? { efficiencyCores: c.eCores } : {}),
    baseClockGhz: c.base,
    boostClockGhz: c.boost,
    l3CacheMb: c.l3,
    tdpWatts: c.tdp,
    peakPowerWatts: c.peak,
    integratedGraphics: c.igpu,
    memoryTypes: c.memory,
    lithographyNm: c.litho,
    performance: { singleThread: c.st, multiThread: c.mt, gaming: c.gaming },
  };

  return {
    id: c.id,
    category: 'CPU',
    brand: c.brand,
    family: c.family,
    model: c.model,
    fullName: `${c.brand} ${c.model}`,
    releaseYear: c.year,
    releaseQuarter: c.quarter ?? null,
    spec,
    msrpUsd: c.msrp,
    discontinued: c.discontinued ?? false,
    imageUrl: null,
  };
});
