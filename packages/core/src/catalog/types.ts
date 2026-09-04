/**
 * Catálogo estruturado de hardware.
 *
 * Princípio: o usuário nunca identifica um componente digitando texto livre. Ele seleciona
 * uma entrada do catálogo. Toda a inteligência do produto (gargalo, score, valuation,
 * comparação) depende de specs confiáveis — texto livre inviabilizaria tudo isso.
 */

export const HARDWARE_CATEGORIES = [
  'CPU',
  'GPU',
  'MOTHERBOARD',
  'RAM',
  'STORAGE',
  'PSU',
  'COOLER',
  'CASE',
  'FAN',
  'MONITOR',
  'KEYBOARD',
  'MOUSE',
  'HEADSET',
  'MICROPHONE',
  'WEBCAM',
  'MOUSEPAD',
  'CONTROLLER',
] as const;

export type HardwareCategory = (typeof HARDWARE_CATEGORIES)[number];

/** Categorias que compõem a máquina em si. As demais são periféricos e são opcionais. */
export const CORE_CATEGORIES: HardwareCategory[] = [
  'CPU',
  'GPU',
  'MOTHERBOARD',
  'RAM',
  'STORAGE',
  'PSU',
  'COOLER',
  'CASE',
  'FAN',
];

export const PERIPHERAL_CATEGORIES: HardwareCategory[] = HARDWARE_CATEGORIES.filter(
  (c) => !CORE_CATEGORIES.includes(c),
);

export function isPeripheral(category: HardwareCategory): boolean {
  return PERIPHERAL_CATEGORIES.includes(category);
}

// ---------------------------------------------------------------------------
// Índices de performance
// ---------------------------------------------------------------------------

/**
 * Índices normalizados numa escala 0–100 onde 100 é a referência de topo do catálogo
 * no momento da calibração. São o insumo do modelo de FPS em `engine/performance.ts`.
 *
 * Separar single-thread de multi-thread não é preciosismo: são os dois eixos que
 * decidem se um CPU serve para jogo ou para produção, e tratá-los como um número só
 * é justamente o erro que faz recomendação de hardware ficar errada.
 */
export interface CpuPerformance {
  /** Peso em cargas de thread única / latência. Direciona jogos. */
  singleThread: number;
  /** Peso em cargas paralelas. Direciona render, compilação, encode. */
  multiThread: number;
  /**
   * Índice de jogo. Não é a média dos dois: cache e latência de memória pesam mais
   * do que contagem de núcleos acima de ~8 núcleos.
   */
  gaming: number;
}

export interface GpuPerformance {
  /** Rasterização pura, normalizada. Base do modelo de FPS. */
  raster: number;
  /** Ray tracing. `null` quando a GPU não tem hardware dedicado. */
  rayTracing: number | null;
}

// ---------------------------------------------------------------------------
// Specs por categoria
// ---------------------------------------------------------------------------

export type MemoryType = 'DDR3' | 'DDR4' | 'DDR5';

export interface CpuSpec {
  kind: 'CPU';
  socket: string;
  cores: number;
  threads: number;
  /** Núcleos de performance, quando a arquitetura é híbrida (Intel P/E cores). */
  performanceCores?: number;
  efficiencyCores?: number;
  baseClockGhz: number;
  boostClockGhz: number;
  l3CacheMb: number;
  tdpWatts: number;
  /** Pico real sob carga. É o número que importa para dimensionar fonte e cooler. */
  peakPowerWatts: number;
  integratedGraphics: string | null;
  memoryTypes: MemoryType[];
  lithographyNm: number;
  performance: CpuPerformance;
}

export interface GpuSpec {
  kind: 'GPU';
  vramGb: number;
  vramType: string;
  memoryBusBits: number;
  baseClockMhz: number;
  boostClockMhz: number;
  tdpWatts: number;
  peakPowerWatts: number;
  /** Recomendação de fonte do fabricante, quando existe. */
  recommendedPsuWatts: number | null;
  lengthMm: number;
  slotWidth: number;
  powerConnectors: string;
  pcieVersion: number;
  performance: GpuPerformance;
}

export interface MotherboardSpec {
  kind: 'MOTHERBOARD';
  socket: string;
  chipset: string;
  formFactor: 'ATX' | 'Micro-ATX' | 'Mini-ITX' | 'E-ATX';
  memoryType: MemoryType;
  memorySlots: number;
  maxMemoryGb: number;
  /** Frequência máxima suportada oficialmente (com XMP/EXPO). */
  maxMemoryMhz: number;
  m2Slots: number;
  sataPorts: number;
  pcieVersion: number;
  /** VRM fraco sob CPU forte é um gargalo real e quase nunca visível ao usuário. */
  vrmQuality: 'basic' | 'adequate' | 'strong' | 'enthusiast';
}

export interface RamSpec {
  kind: 'RAM';
  memoryType: MemoryType;
  /** Capacidade de UM módulo. A quantidade vem de `RigComponent.quantity`. */
  capacityGb: number;
  speedMhz: number;
  casLatency: number;
  voltage: number;
  hasHeatspreader: boolean;
}

export interface StorageSpec {
  kind: 'STORAGE';
  storageType: 'HDD' | 'SATA_SSD' | 'NVME_SSD';
  capacityGb: number;
  /** Sequencial de leitura em MB/s. */
  readMbps: number;
  writeMbps: number;
  /** Geração do NVMe, quando aplicável. */
  pcieGen: number | null;
  formFactor: string;
  /** TBW — resistência de escrita. Relevante para saúde a longo prazo. */
  enduranceTbw: number | null;
}

export interface PsuSpec {
  kind: 'PSU';
  wattage: number;
  efficiencyRating:
    | '80+ White'
    | '80+ Bronze'
    | '80+ Silver'
    | '80+ Gold'
    | '80+ Platinum'
    | '80+ Titanium'
    | 'None';
  modularity: 'non-modular' | 'semi-modular' | 'full-modular';
  formFactor: 'ATX' | 'SFX' | 'SFX-L';
  hasPcie5Connector: boolean;
  /** Anos de garantia — o melhor proxy público de qualidade real de fonte. */
  warrantyYears: number;
}

export interface CoolerSpec {
  kind: 'COOLER';
  coolerType: 'air' | 'aio-liquid' | 'custom-liquid' | 'stock';
  /** Dissipação em watts. É o número que decide se o CPU vai fazer throttle. */
  tdpCapacityWatts: number;
  radiatorSizeMm: number | null;
  heightMm: number | null;
  sockets: string[];
  noiseDb: number | null;
}

export interface CaseSpec {
  kind: 'CASE';
  formFactors: string[];
  maxGpuLengthMm: number;
  maxCoolerHeightMm: number;
  includedFans: number;
  fanMounts: number;
  /** Gabinete fechado com vidro estrangula build potente. */
  airflowQuality: 'restricted' | 'moderate' | 'good' | 'excellent';
}

export interface FanSpec {
  kind: 'FAN';
  sizeMm: number;
  airflowCfm: number;
  staticPressureMmH2O: number;
  noiseDb: number;
  hasRgb: boolean;
}

export interface MonitorSpec {
  kind: 'MONITOR';
  sizeInches: number;
  resolutionWidth: number;
  resolutionHeight: number;
  refreshRateHz: number;
  panelType: 'TN' | 'IPS' | 'VA' | 'OLED' | 'QD-OLED';
  responseTimeMs: number;
  hasHdr: boolean;
  adaptiveSync: 'none' | 'FreeSync' | 'G-Sync' | 'G-Sync Compatible';
  curved: boolean;
}

export interface PeripheralSpec {
  kind: 'PERIPHERAL';
  connection: 'wired' | 'wireless' | 'both';
  /**
   * Atributos específicos do tipo de periférico. Mantidos abertos de propósito:
   * periférico não entra no cálculo de performance, então não justifica schema rígido.
   */
  attributes: Record<string, string | number | boolean>;
}

export type ComponentSpec =
  | CpuSpec
  | GpuSpec
  | MotherboardSpec
  | RamSpec
  | StorageSpec
  | PsuSpec
  | CoolerSpec
  | CaseSpec
  | FanSpec
  | MonitorSpec
  | PeripheralSpec;

// ---------------------------------------------------------------------------
// Entrada do catálogo
// ---------------------------------------------------------------------------

export interface CatalogComponent {
  id: string;
  category: HardwareCategory;
  brand: string;
  /** Família agrupa modelos para a navegação em três níveis: marca → família → modelo. */
  family: string;
  model: string;
  /** Nome completo, usado na busca textual. */
  fullName: string;
  releaseYear: number;
  releaseQuarter: number | null;
  spec: ComponentSpec;
  /** Preço de lançamento em USD. Base da curva de depreciação. */
  msrpUsd: number | null;
  /** Descontinuado pelo fabricante — pesa na longevidade e na disponibilidade. */
  discontinued: boolean;
  imageUrl: string | null;
}

// ---------------------------------------------------------------------------
// Estreitamento de tipo, para o engine não ficar cheio de casts
// ---------------------------------------------------------------------------

export type Typed<S extends ComponentSpec> = CatalogComponent & { spec: S };

export function asCpu(c: CatalogComponent): Typed<CpuSpec> | null {
  return c.spec.kind === 'CPU' ? (c as Typed<CpuSpec>) : null;
}
export function asGpu(c: CatalogComponent): Typed<GpuSpec> | null {
  return c.spec.kind === 'GPU' ? (c as Typed<GpuSpec>) : null;
}
export function asRam(c: CatalogComponent): Typed<RamSpec> | null {
  return c.spec.kind === 'RAM' ? (c as Typed<RamSpec>) : null;
}
export function asStorage(c: CatalogComponent): Typed<StorageSpec> | null {
  return c.spec.kind === 'STORAGE' ? (c as Typed<StorageSpec>) : null;
}
export function asPsu(c: CatalogComponent): Typed<PsuSpec> | null {
  return c.spec.kind === 'PSU' ? (c as Typed<PsuSpec>) : null;
}
export function asCooler(c: CatalogComponent): Typed<CoolerSpec> | null {
  return c.spec.kind === 'COOLER' ? (c as Typed<CoolerSpec>) : null;
}
export function asMotherboard(c: CatalogComponent): Typed<MotherboardSpec> | null {
  return c.spec.kind === 'MOTHERBOARD' ? (c as Typed<MotherboardSpec>) : null;
}
export function asCase(c: CatalogComponent): Typed<CaseSpec> | null {
  return c.spec.kind === 'CASE' ? (c as Typed<CaseSpec>) : null;
}
export function asMonitor(c: CatalogComponent): Typed<MonitorSpec> | null {
  return c.spec.kind === 'MONITOR' ? (c as Typed<MonitorSpec>) : null;
}
