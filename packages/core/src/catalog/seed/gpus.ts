/**
 * Catálogo de placas de vídeo.
 *
 * Specs reais de fabricante. O campo `raster` é um índice relativo normalizado com
 * RTX 5090 = 100, derivado da posição de cada placa em rasterização a 1440p. É esse
 * índice — não o preço, não o nome — que alimenta o modelo de FPS.
 *
 * Este é um seed curado das placas mais comuns no mercado brasileiro, não o catálogo
 * completo. O caminho de ingestão é real e expansível: acrescentar uma placa aqui é
 * acrescentar uma linha, e nada no engine precisa mudar.
 */

import type { CatalogComponent, GpuSpec } from '../types.ts';

interface GpuSeed {
  id: string;
  brand: string;
  family: string;
  model: string;
  year: number;
  quarter?: number;
  /** Índice de rasterização, RTX 5090 = 100. */
  raster: number;
  /** Índice de ray tracing. `null` quando não há hardware dedicado. */
  rt: number | null;
  vram: number;
  vramType: string;
  bus: number;
  baseMhz: number;
  boostMhz: number;
  tdp: number;
  peak: number;
  psu: number | null;
  length: number;
  slots: number;
  connectors: string;
  pcie: number;
  msrp: number | null;
  discontinued?: boolean;
}

const GPU_SEEDS: GpuSeed[] = [
  // ---- NVIDIA GeForce RTX 50 (Blackwell) ----
  { id: 'gpu-rtx-5090', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5090', year: 2025, quarter: 1, raster: 100, rt: 100, vram: 32, vramType: 'GDDR7', bus: 512, baseMhz: 2017, boostMhz: 2407, tdp: 575, peak: 600, psu: 1000, length: 304, slots: 2, connectors: '1x 12V-2x6', pcie: 5, msrp: 1999 },
  { id: 'gpu-rtx-5080', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5080', year: 2025, quarter: 1, raster: 66, rt: 68, vram: 16, vramType: 'GDDR7', bus: 256, baseMhz: 2295, boostMhz: 2617, tdp: 360, peak: 400, psu: 850, length: 304, slots: 2, connectors: '1x 12V-2x6', pcie: 5, msrp: 999 },
  { id: 'gpu-rtx-5070-ti', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5070 Ti', year: 2025, quarter: 1, raster: 55, rt: 57, vram: 16, vramType: 'GDDR7', bus: 256, baseMhz: 2295, boostMhz: 2452, tdp: 300, peak: 330, psu: 750, length: 300, slots: 2, connectors: '1x 12V-2x6', pcie: 5, msrp: 749 },
  { id: 'gpu-rtx-5070', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5070', year: 2025, quarter: 1, raster: 44, rt: 46, vram: 12, vramType: 'GDDR7', bus: 192, baseMhz: 2325, boostMhz: 2512, tdp: 250, peak: 275, psu: 650, length: 285, slots: 2, connectors: '1x 12V-2x6', pcie: 5, msrp: 549 },
  { id: 'gpu-rtx-5060-ti-16', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5060 Ti 16GB', year: 2025, quarter: 2, raster: 30, rt: 32, vram: 16, vramType: 'GDDR7', bus: 128, baseMhz: 2407, boostMhz: 2572, tdp: 180, peak: 200, psu: 600, length: 245, slots: 2, connectors: '1x 8-pin', pcie: 5, msrp: 429 },
  { id: 'gpu-rtx-5060', brand: 'NVIDIA', family: 'GeForce RTX 50', model: 'RTX 5060', year: 2025, quarter: 2, raster: 24, rt: 26, vram: 8, vramType: 'GDDR7', bus: 128, baseMhz: 2280, boostMhz: 2497, tdp: 145, peak: 165, psu: 550, length: 242, slots: 2, connectors: '1x 8-pin', pcie: 5, msrp: 299 },

  // ---- NVIDIA GeForce RTX 40 (Ada Lovelace) ----
  { id: 'gpu-rtx-4090', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4090', year: 2022, quarter: 4, raster: 72, rt: 74, vram: 24, vramType: 'GDDR6X', bus: 384, baseMhz: 2235, boostMhz: 2520, tdp: 450, peak: 480, psu: 850, length: 304, slots: 3, connectors: '1x 12VHPWR', pcie: 4, msrp: 1599, discontinued: true },
  { id: 'gpu-rtx-4080-super', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4080 SUPER', year: 2024, quarter: 1, raster: 61, rt: 63, vram: 16, vramType: 'GDDR6X', bus: 256, baseMhz: 2295, boostMhz: 2550, tdp: 320, peak: 350, psu: 750, length: 304, slots: 3, connectors: '1x 12VHPWR', pcie: 4, msrp: 999, discontinued: true },
  { id: 'gpu-rtx-4070-ti-super', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4070 Ti SUPER', year: 2024, quarter: 1, raster: 52, rt: 54, vram: 16, vramType: 'GDDR6X', bus: 256, baseMhz: 2340, boostMhz: 2610, tdp: 285, peak: 310, psu: 700, length: 285, slots: 2, connectors: '1x 12VHPWR', pcie: 4, msrp: 799, discontinued: true },
  { id: 'gpu-rtx-4070-super', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4070 SUPER', year: 2024, quarter: 1, raster: 44, rt: 46, vram: 12, vramType: 'GDDR6X', bus: 192, baseMhz: 1980, boostMhz: 2475, tdp: 220, peak: 245, psu: 650, length: 244, slots: 2, connectors: '1x 12VHPWR', pcie: 4, msrp: 599, discontinued: true },
  { id: 'gpu-rtx-4070', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4070', year: 2023, quarter: 2, raster: 37, rt: 39, vram: 12, vramType: 'GDDR6X', bus: 192, baseMhz: 1920, boostMhz: 2475, tdp: 200, peak: 220, psu: 650, length: 244, slots: 2, connectors: '1x 12VHPWR', pcie: 4, msrp: 599, discontinued: true },
  { id: 'gpu-rtx-4060-ti-8', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4060 Ti 8GB', year: 2023, quarter: 2, raster: 28, rt: 30, vram: 8, vramType: 'GDDR6', bus: 128, baseMhz: 2310, boostMhz: 2535, tdp: 160, peak: 175, psu: 550, length: 240, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 399 },
  { id: 'gpu-rtx-4060', brand: 'NVIDIA', family: 'GeForce RTX 40', model: 'RTX 4060', year: 2023, quarter: 3, raster: 23, rt: 25, vram: 8, vramType: 'GDDR6', bus: 128, baseMhz: 1830, boostMhz: 2460, tdp: 115, peak: 135, psu: 550, length: 200, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 299 },

  // ---- NVIDIA GeForce RTX 30 (Ampere) ----
  { id: 'gpu-rtx-3090-ti', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3090 Ti', year: 2022, quarter: 1, raster: 45, rt: 44, vram: 24, vramType: 'GDDR6X', bus: 384, baseMhz: 1560, boostMhz: 1860, tdp: 450, peak: 480, psu: 850, length: 313, slots: 3, connectors: '1x 12VHPWR', pcie: 4, msrp: 1999, discontinued: true },
  { id: 'gpu-rtx-3090', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3090', year: 2020, quarter: 3, raster: 42, rt: 41, vram: 24, vramType: 'GDDR6X', bus: 384, baseMhz: 1395, boostMhz: 1695, tdp: 350, peak: 380, psu: 750, length: 313, slots: 3, connectors: '2x 8-pin', pcie: 4, msrp: 1499, discontinued: true },
  { id: 'gpu-rtx-3080', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3080 10GB', year: 2020, quarter: 3, raster: 40, rt: 39, vram: 10, vramType: 'GDDR6X', bus: 320, baseMhz: 1440, boostMhz: 1710, tdp: 320, peak: 350, psu: 750, length: 285, slots: 2, connectors: '2x 8-pin', pcie: 4, msrp: 699, discontinued: true },
  { id: 'gpu-rtx-3070', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3070', year: 2020, quarter: 4, raster: 31, rt: 30, vram: 8, vramType: 'GDDR6', bus: 256, baseMhz: 1500, boostMhz: 1725, tdp: 220, peak: 240, psu: 650, length: 242, slots: 2, connectors: '1x 12-pin', pcie: 4, msrp: 499, discontinued: true },
  { id: 'gpu-rtx-3060-ti', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3060 Ti', year: 2020, quarter: 4, raster: 28, rt: 27, vram: 8, vramType: 'GDDR6', bus: 256, baseMhz: 1410, boostMhz: 1665, tdp: 200, peak: 220, psu: 600, length: 242, slots: 2, connectors: '1x 12-pin', pcie: 4, msrp: 399, discontinued: true },
  { id: 'gpu-rtx-3060-12', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3060 12GB', year: 2021, quarter: 1, raster: 20, rt: 20, vram: 12, vramType: 'GDDR6', bus: 192, baseMhz: 1320, boostMhz: 1777, tdp: 170, peak: 190, psu: 550, length: 242, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 329 },
  { id: 'gpu-rtx-3050-8', brand: 'NVIDIA', family: 'GeForce RTX 30', model: 'RTX 3050 8GB', year: 2022, quarter: 1, raster: 14, rt: 13, vram: 8, vramType: 'GDDR6', bus: 128, baseMhz: 1552, boostMhz: 1777, tdp: 130, peak: 145, psu: 550, length: 200, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 249 },

  // ---- NVIDIA GeForce GTX (Turing / Pascal) ----
  { id: 'gpu-gtx-1660-super', brand: 'NVIDIA', family: 'GeForce GTX 16', model: 'GTX 1660 SUPER', year: 2019, quarter: 4, raster: 13, rt: null, vram: 6, vramType: 'GDDR6', bus: 192, baseMhz: 1530, boostMhz: 1785, tdp: 125, peak: 140, psu: 450, length: 229, slots: 2, connectors: '1x 8-pin', pcie: 3, msrp: 229, discontinued: true },
  { id: 'gpu-gtx-1650', brand: 'NVIDIA', family: 'GeForce GTX 16', model: 'GTX 1650', year: 2019, quarter: 2, raster: 8, rt: null, vram: 4, vramType: 'GDDR5', bus: 128, baseMhz: 1485, boostMhz: 1665, tdp: 75, peak: 85, psu: 350, length: 229, slots: 2, connectors: 'Nenhum', pcie: 3, msrp: 149, discontinued: true },
  { id: 'gpu-gtx-1060-6', brand: 'NVIDIA', family: 'GeForce GTX 10', model: 'GTX 1060 6GB', year: 2016, quarter: 3, raster: 9, rt: null, vram: 6, vramType: 'GDDR5', bus: 192, baseMhz: 1506, boostMhz: 1708, tdp: 120, peak: 135, psu: 400, length: 250, slots: 2, connectors: '1x 6-pin', pcie: 3, msrp: 249, discontinued: true },

  // ---- AMD Radeon RX 9000 (RDNA 4) ----
  { id: 'gpu-rx-9070-xt', brand: 'AMD', family: 'Radeon RX 9000', model: 'RX 9070 XT', year: 2025, quarter: 1, raster: 52, rt: 48, vram: 16, vramType: 'GDDR6', bus: 256, baseMhz: 1660, boostMhz: 2970, tdp: 304, peak: 330, psu: 750, length: 290, slots: 2, connectors: '2x 8-pin', pcie: 5, msrp: 599 },
  { id: 'gpu-rx-9070', brand: 'AMD', family: 'Radeon RX 9000', model: 'RX 9070', year: 2025, quarter: 1, raster: 44, rt: 41, vram: 16, vramType: 'GDDR6', bus: 256, baseMhz: 1330, boostMhz: 2520, tdp: 220, peak: 245, psu: 650, length: 280, slots: 2, connectors: '2x 8-pin', pcie: 5, msrp: 549 },

  // ---- AMD Radeon RX 7000 (RDNA 3) ----
  { id: 'gpu-rx-7900-xtx', brand: 'AMD', family: 'Radeon RX 7000', model: 'RX 7900 XTX', year: 2022, quarter: 4, raster: 62, rt: 47, vram: 24, vramType: 'GDDR6', bus: 384, baseMhz: 1855, boostMhz: 2500, tdp: 355, peak: 390, psu: 800, length: 287, slots: 2, connectors: '2x 8-pin', pcie: 4, msrp: 999 },
  { id: 'gpu-rx-7900-xt', brand: 'AMD', family: 'Radeon RX 7000', model: 'RX 7900 XT', year: 2022, quarter: 4, raster: 51, rt: 39, vram: 20, vramType: 'GDDR6', bus: 320, baseMhz: 1500, boostMhz: 2400, tdp: 315, peak: 345, psu: 750, length: 276, slots: 2, connectors: '2x 8-pin', pcie: 4, msrp: 899 },
  { id: 'gpu-rx-7800-xt', brand: 'AMD', family: 'Radeon RX 7000', model: 'RX 7800 XT', year: 2023, quarter: 3, raster: 41, rt: 31, vram: 16, vramType: 'GDDR6', bus: 256, baseMhz: 1295, boostMhz: 2430, tdp: 263, peak: 290, psu: 700, length: 267, slots: 2, connectors: '2x 8-pin', pcie: 4, msrp: 499 },
  { id: 'gpu-rx-7700-xt', brand: 'AMD', family: 'Radeon RX 7000', model: 'RX 7700 XT', year: 2023, quarter: 3, raster: 33, rt: 25, vram: 12, vramType: 'GDDR6', bus: 192, baseMhz: 1700, boostMhz: 2544, tdp: 245, peak: 270, psu: 650, length: 267, slots: 2, connectors: '2x 8-pin', pcie: 4, msrp: 449 },
  { id: 'gpu-rx-7600', brand: 'AMD', family: 'Radeon RX 7000', model: 'RX 7600', year: 2023, quarter: 2, raster: 22, rt: 16, vram: 8, vramType: 'GDDR6', bus: 128, baseMhz: 1720, boostMhz: 2655, tdp: 165, peak: 185, psu: 550, length: 204, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 269 },

  // ---- AMD Radeon RX 6000 / 500 ----
  { id: 'gpu-rx-6700-xt', brand: 'AMD', family: 'Radeon RX 6000', model: 'RX 6700 XT', year: 2021, quarter: 1, raster: 27, rt: 18, vram: 12, vramType: 'GDDR6', bus: 192, baseMhz: 2321, boostMhz: 2581, tdp: 230, peak: 255, psu: 650, length: 267, slots: 2, connectors: '1x 8-pin + 1x 6-pin', pcie: 4, msrp: 479, discontinued: true },
  { id: 'gpu-rx-6600', brand: 'AMD', family: 'Radeon RX 6000', model: 'RX 6600', year: 2021, quarter: 4, raster: 17, rt: 11, vram: 8, vramType: 'GDDR6', bus: 128, baseMhz: 1626, boostMhz: 2491, tdp: 132, peak: 150, psu: 450, length: 200, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 329, discontinued: true },
  { id: 'gpu-rx-580-8', brand: 'AMD', family: 'Radeon RX 500', model: 'RX 580 8GB', year: 2017, quarter: 2, raster: 10, rt: null, vram: 8, vramType: 'GDDR5', bus: 256, baseMhz: 1257, boostMhz: 1340, tdp: 185, peak: 210, psu: 500, length: 241, slots: 2, connectors: '1x 8-pin', pcie: 3, msrp: 229, discontinued: true },

  // ---- Intel Arc ----
  { id: 'gpu-arc-b580', brand: 'Intel', family: 'Arc B-Series', model: 'Arc B580', year: 2024, quarter: 4, raster: 21, rt: 19, vram: 12, vramType: 'GDDR6', bus: 192, baseMhz: 2670, boostMhz: 2850, tdp: 190, peak: 210, psu: 600, length: 272, slots: 2, connectors: '1x 8-pin', pcie: 4, msrp: 249 },
  { id: 'gpu-arc-a750', brand: 'Intel', family: 'Arc A-Series', model: 'Arc A750', year: 2022, quarter: 4, raster: 18, rt: 16, vram: 8, vramType: 'GDDR6', bus: 256, baseMhz: 2050, boostMhz: 2400, tdp: 225, peak: 245, psu: 600, length: 267, slots: 2, connectors: '1x 8-pin + 1x 6-pin', pcie: 4, msrp: 289, discontinued: true },
];

export const GPU_CATALOG: CatalogComponent[] = GPU_SEEDS.map((g) => {
  const spec: GpuSpec = {
    kind: 'GPU',
    vramGb: g.vram,
    vramType: g.vramType,
    memoryBusBits: g.bus,
    baseClockMhz: g.baseMhz,
    boostClockMhz: g.boostMhz,
    tdpWatts: g.tdp,
    peakPowerWatts: g.peak,
    recommendedPsuWatts: g.psu,
    lengthMm: g.length,
    slotWidth: g.slots,
    powerConnectors: g.connectors,
    pcieVersion: g.pcie,
    performance: { raster: g.raster, rayTracing: g.rt },
  };

  return {
    id: g.id,
    category: 'GPU',
    brand: g.brand,
    family: g.family,
    model: g.model,
    fullName: `${g.brand} ${g.model}`,
    releaseYear: g.year,
    releaseQuarter: g.quarter ?? null,
    spec,
    msrpUsd: g.msrp,
    discontinued: g.discontinued ?? false,
    imageUrl: null,
  };
});
