/**
 * Catálogo do restante da plataforma: placas-mãe, memória, armazenamento, fontes,
 * refrigeração, gabinetes e ventoinhas.
 *
 * Menos glamouroso que CPU e GPU, e responsável pela maior parte dos problemas reais:
 * fonte subdimensionada, canal simples de memória, cooler de caixa em processador de
 * 250W, gabinete sem fluxo de ar. É aqui que mora boa parte do valor do produto.
 */

import type {
  CaseSpec,
  CatalogComponent,
  CoolerSpec,
  FanSpec,
  MotherboardSpec,
  PsuSpec,
  RamSpec,
  StorageSpec,
} from '../types.ts';

function entry(
  id: string,
  category: CatalogComponent['category'],
  brand: string,
  family: string,
  model: string,
  year: number,
  msrpUsd: number | null,
  spec: CatalogComponent['spec'],
  discontinued = false,
): CatalogComponent {
  return {
    id,
    category,
    brand,
    family,
    model,
    fullName: `${brand} ${model}`,
    releaseYear: year,
    releaseQuarter: null,
    spec,
    msrpUsd,
    discontinued,
    imageUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Placas-mãe
// ---------------------------------------------------------------------------

const mb = (
  socket: string,
  chipset: string,
  formFactor: MotherboardSpec['formFactor'],
  memoryType: MotherboardSpec['memoryType'],
  slots: number,
  maxGb: number,
  maxMhz: number,
  m2: number,
  sata: number,
  pcie: number,
  vrm: MotherboardSpec['vrmQuality'],
): MotherboardSpec => ({
  kind: 'MOTHERBOARD',
  socket,
  chipset,
  formFactor,
  memoryType,
  memorySlots: slots,
  maxMemoryGb: maxGb,
  maxMemoryMhz: maxMhz,
  m2Slots: m2,
  sataPorts: sata,
  pcieVersion: pcie,
  vrmQuality: vrm,
});

export const MOTHERBOARD_CATALOG: CatalogComponent[] = [
  entry('mb-asus-x870e-hero', 'MOTHERBOARD', 'ASUS', 'ROG Crosshair', 'ROG Crosshair X870E Hero', 2024, 699, mb('AM5', 'X870E', 'ATX', 'DDR5', 4, 192, 8000, 4, 4, 5, 'enthusiast')),
  entry('mb-msi-b650-tomahawk', 'MOTHERBOARD', 'MSI', 'MAG Tomahawk', 'MAG B650 Tomahawk WiFi', 2023, 219, mb('AM5', 'B650', 'ATX', 'DDR5', 4, 128, 6400, 3, 6, 4, 'strong')),
  entry('mb-gigabyte-b650m-ds3h', 'MOTHERBOARD', 'Gigabyte', 'B650M', 'B650M DS3H', 2023, 139, mb('AM5', 'B650', 'Micro-ATX', 'DDR5', 4, 128, 6000, 2, 4, 4, 'adequate')),
  entry('mb-asus-b550m-a', 'MOTHERBOARD', 'ASUS', 'PRIME', 'PRIME B550M-A', 2020, 109, mb('AM4', 'B550', 'Micro-ATX', 'DDR4', 4, 128, 4400, 1, 4, 4, 'adequate')),
  entry('mb-msi-b450m-pro', 'MOTHERBOARD', 'MSI', 'PRO Series', 'B450M PRO-VDH MAX', 2019, 79, mb('AM4', 'B450', 'Micro-ATX', 'DDR4', 4, 64, 3466, 1, 4, 3, 'basic'), true),
  entry('mb-asus-x670e-strix', 'MOTHERBOARD', 'ASUS', 'ROG Strix', 'ROG Strix X670E-E Gaming', 2022, 499, mb('AM5', 'X670E', 'ATX', 'DDR5', 4, 128, 6400, 4, 6, 5, 'enthusiast')),
  entry('mb-msi-z790-tomahawk', 'MOTHERBOARD', 'MSI', 'MAG Tomahawk', 'MAG Z790 Tomahawk WiFi', 2022, 329, mb('LGA1700', 'Z790', 'ATX', 'DDR5', 4, 192, 7200, 4, 6, 5, 'strong')),
  entry('mb-asus-b760m-plus', 'MOTHERBOARD', 'ASUS', 'PRIME', 'PRIME B760M-A WiFi', 2023, 159, mb('LGA1700', 'B760', 'Micro-ATX', 'DDR5', 4, 128, 6400, 2, 4, 4, 'adequate')),
  entry('mb-gigabyte-b660m-ds3h', 'MOTHERBOARD', 'Gigabyte', 'B660M', 'B660M DS3H DDR4', 2022, 119, mb('LGA1700', 'B660', 'Micro-ATX', 'DDR4', 4, 128, 3200, 2, 4, 4, 'adequate')),
  entry('mb-asus-z890-strix', 'MOTHERBOARD', 'ASUS', 'ROG Strix', 'ROG Strix Z890-A Gaming', 2024, 399, mb('LGA1851', 'Z890', 'ATX', 'DDR5', 4, 192, 8600, 4, 4, 5, 'enthusiast')),
  entry('mb-msi-b560m-pro', 'MOTHERBOARD', 'MSI', 'PRO Series', 'B560M PRO-VDH', 2021, 99, mb('LGA1200', 'B560', 'Micro-ATX', 'DDR4', 4, 128, 3200, 2, 4, 4, 'basic'), true),
  entry('mb-asus-h410m-e', 'MOTHERBOARD', 'ASUS', 'PRIME', 'PRIME H410M-E', 2020, 69, mb('LGA1200', 'H410', 'Micro-ATX', 'DDR4', 2, 64, 2933, 0, 4, 3, 'basic'), true),
];

// ---------------------------------------------------------------------------
// Memória — capacidade é sempre por módulo
// ---------------------------------------------------------------------------

const ram = (
  memoryType: RamSpec['memoryType'],
  capacityGb: number,
  speedMhz: number,
  cas: number,
  voltage: number,
  heatspreader = true,
): RamSpec => ({
  kind: 'RAM',
  memoryType,
  capacityGb,
  speedMhz,
  casLatency: cas,
  voltage,
  hasHeatspreader: heatspreader,
});

export const RAM_CATALOG: CatalogComponent[] = [
  entry('ram-corsair-veng-ddr5-16-6000', 'RAM', 'Corsair', 'Vengeance', 'Vengeance DDR5 16GB 6000MHz CL30', 2023, 55, ram('DDR5', 16, 6000, 30, 1.35)),
  entry('ram-corsair-veng-ddr5-32-6000', 'RAM', 'Corsair', 'Vengeance', 'Vengeance DDR5 32GB 6000MHz CL30', 2023, 105, ram('DDR5', 32, 6000, 30, 1.35)),
  entry('ram-gskill-tridentz5-16-6400', 'RAM', 'G.Skill', 'Trident Z5', 'Trident Z5 RGB DDR5 16GB 6400MHz CL32', 2023, 72, ram('DDR5', 16, 6400, 32, 1.4)),
  entry('ram-kingston-fury-ddr5-16-5600', 'RAM', 'Kingston', 'FURY Beast', 'FURY Beast DDR5 16GB 5600MHz CL36', 2022, 48, ram('DDR5', 16, 5600, 36, 1.25)),
  entry('ram-kingston-fury-ddr5-8-5200', 'RAM', 'Kingston', 'FURY Beast', 'FURY Beast DDR5 8GB 5200MHz CL40', 2022, 32, ram('DDR5', 8, 5200, 40, 1.25)),
  entry('ram-corsair-veng-ddr4-8-3200', 'RAM', 'Corsair', 'Vengeance', 'Vengeance LPX DDR4 8GB 3200MHz CL16', 2019, 26, ram('DDR4', 8, 3200, 16, 1.35)),
  entry('ram-corsair-veng-ddr4-16-3200', 'RAM', 'Corsair', 'Vengeance', 'Vengeance LPX DDR4 16GB 3200MHz CL16', 2019, 42, ram('DDR4', 16, 3200, 16, 1.35)),
  entry('ram-gskill-ripjaws-ddr4-16-3600', 'RAM', 'G.Skill', 'Ripjaws V', 'Ripjaws V DDR4 16GB 3600MHz CL16', 2019, 48, ram('DDR4', 16, 3600, 16, 1.35)),
  entry('ram-kingston-fury-ddr4-8-2666', 'RAM', 'Kingston', 'FURY Beast', 'FURY Beast DDR4 8GB 2666MHz CL16', 2018, 22, ram('DDR4', 8, 2666, 16, 1.2)),
  entry('ram-generic-ddr4-4-2400', 'RAM', 'Genérica', 'DDR4', 'DDR4 4GB 2400MHz', 2016, 14, ram('DDR4', 4, 2400, 17, 1.2, false)),
];

// ---------------------------------------------------------------------------
// Armazenamento
// ---------------------------------------------------------------------------

const storage = (
  storageType: StorageSpec['storageType'],
  capacityGb: number,
  read: number,
  write: number,
  pcieGen: number | null,
  formFactor: string,
  tbw: number | null,
): StorageSpec => ({
  kind: 'STORAGE',
  storageType,
  capacityGb,
  readMbps: read,
  writeMbps: write,
  pcieGen,
  formFactor,
  enduranceTbw: tbw,
});

export const STORAGE_CATALOG: CatalogComponent[] = [
  entry('sto-samsung-990pro-2tb', 'STORAGE', 'Samsung', '990 PRO', '990 PRO 2TB NVMe', 2022, 169, storage('NVME_SSD', 2000, 7450, 6900, 4, 'M.2 2280', 1200)),
  entry('sto-samsung-990pro-1tb', 'STORAGE', 'Samsung', '990 PRO', '990 PRO 1TB NVMe', 2022, 99, storage('NVME_SSD', 1000, 7450, 6900, 4, 'M.2 2280', 600)),
  entry('sto-wd-sn850x-1tb', 'STORAGE', 'Western Digital', 'Black SN850X', 'WD Black SN850X 1TB NVMe', 2022, 89, storage('NVME_SSD', 1000, 7300, 6300, 4, 'M.2 2280', 600)),
  entry('sto-kingston-nv2-1tb', 'STORAGE', 'Kingston', 'NV2', 'NV2 1TB NVMe', 2022, 55, storage('NVME_SSD', 1000, 3500, 2100, 4, 'M.2 2280', 320)),
  entry('sto-kingston-nv2-500gb', 'STORAGE', 'Kingston', 'NV2', 'NV2 500GB NVMe', 2022, 35, storage('NVME_SSD', 500, 3500, 2100, 4, 'M.2 2280', 160)),
  entry('sto-crucial-p3-2tb', 'STORAGE', 'Crucial', 'P3', 'P3 2TB NVMe', 2022, 99, storage('NVME_SSD', 2000, 3500, 3000, 3, 'M.2 2280', 440)),
  entry('sto-samsung-870evo-1tb', 'STORAGE', 'Samsung', '870 EVO', '870 EVO 1TB SATA', 2021, 79, storage('SATA_SSD', 1000, 560, 530, null, '2.5"', 600)),
  entry('sto-kingston-a400-480', 'STORAGE', 'Kingston', 'A400', 'A400 480GB SATA', 2017, 35, storage('SATA_SSD', 480, 500, 450, null, '2.5"', 160)),
  entry('sto-kingston-a400-240', 'STORAGE', 'Kingston', 'A400', 'A400 240GB SATA', 2017, 25, storage('SATA_SSD', 240, 500, 350, null, '2.5"', 80)),
  entry('sto-seagate-barracuda-2tb', 'STORAGE', 'Seagate', 'BarraCuda', 'BarraCuda 2TB 7200RPM', 2016, 55, storage('HDD', 2000, 220, 200, null, '3.5"', null)),
  entry('sto-wd-blue-1tb-hdd', 'STORAGE', 'Western Digital', 'Blue', 'WD Blue 1TB 7200RPM', 2015, 45, storage('HDD', 1000, 150, 140, null, '3.5"', null)),
];

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------

const psu = (
  wattage: number,
  efficiency: PsuSpec['efficiencyRating'],
  modularity: PsuSpec['modularity'],
  pcie5: boolean,
  warranty: number,
  formFactor: PsuSpec['formFactor'] = 'ATX',
): PsuSpec => ({
  kind: 'PSU',
  wattage,
  efficiencyRating: efficiency,
  modularity,
  formFactor,
  hasPcie5Connector: pcie5,
  warrantyYears: warranty,
});

export const PSU_CATALOG: CatalogComponent[] = [
  entry('psu-corsair-rm1000x', 'PSU', 'Corsair', 'RMx', 'RM1000x 1000W', 2021, 189, psu(1000, '80+ Gold', 'full-modular', true, 10)),
  entry('psu-corsair-rm850x', 'PSU', 'Corsair', 'RMx', 'RM850x 850W', 2021, 139, psu(850, '80+ Gold', 'full-modular', true, 10)),
  entry('psu-corsair-rm750x', 'PSU', 'Corsair', 'RMx', 'RM750x 750W', 2021, 119, psu(750, '80+ Gold', 'full-modular', true, 10)),
  entry('psu-seasonic-focus-gx-650', 'PSU', 'Seasonic', 'FOCUS GX', 'FOCUS GX-650 650W', 2019, 109, psu(650, '80+ Gold', 'full-modular', false, 10)),
  entry('psu-corsair-cx650', 'PSU', 'Corsair', 'CX', 'CX650 650W', 2021, 69, psu(650, '80+ Bronze', 'non-modular', false, 5)),
  entry('psu-corsair-cx550', 'PSU', 'Corsair', 'CX', 'CX550 550W', 2021, 59, psu(550, '80+ Bronze', 'non-modular', false, 5)),
  entry('psu-evga-600w-br', 'PSU', 'EVGA', '600 BR', '600 BR 600W', 2019, 55, psu(600, '80+ Bronze', 'non-modular', false, 3), true),
  entry('psu-cooler-master-mwe-500', 'PSU', 'Cooler Master', 'MWE', 'MWE 500 White 500W', 2019, 45, psu(500, '80+ White', 'non-modular', false, 3)),
  entry('psu-generic-500w', 'PSU', 'Genérica', 'Sem marca', 'Fonte genérica 500W', 2018, 25, psu(500, 'None', 'non-modular', false, 1)),
  entry('psu-generic-400w', 'PSU', 'Genérica', 'Sem marca', 'Fonte genérica 400W', 2018, 20, psu(400, 'None', 'non-modular', false, 1)),
];

// ---------------------------------------------------------------------------
// Refrigeração
// ---------------------------------------------------------------------------

const AM5_AM4 = ['AM5', 'AM4'];
const INTEL_MODERN = ['LGA1700', 'LGA1851', 'LGA1200', 'LGA1151'];
const ALL_SOCKETS = [...AM5_AM4, ...INTEL_MODERN];

const cooler = (
  coolerType: CoolerSpec['coolerType'],
  capacity: number,
  radiator: number | null,
  height: number | null,
  sockets: string[],
  noise: number | null,
): CoolerSpec => ({
  kind: 'COOLER',
  coolerType,
  tdpCapacityWatts: capacity,
  radiatorSizeMm: radiator,
  heightMm: height,
  sockets,
  noiseDb: noise,
});

export const COOLER_CATALOG: CatalogComponent[] = [
  entry('cool-arctic-lf3-360', 'COOLER', 'Arctic', 'Liquid Freezer', 'Liquid Freezer III 360', 2024, 139, cooler('aio-liquid', 350, 360, null, ALL_SOCKETS, 22)),
  entry('cool-nzxt-kraken-280', 'COOLER', 'NZXT', 'Kraken', 'Kraken 280 RGB', 2023, 159, cooler('aio-liquid', 280, 280, null, ALL_SOCKETS, 25)),
  entry('cool-corsair-h100i', 'COOLER', 'Corsair', 'iCUE', 'iCUE H100i ELITE 240mm', 2021, 129, cooler('aio-liquid', 250, 240, null, ALL_SOCKETS, 27)),
  entry('cool-noctua-nhd15', 'COOLER', 'Noctua', 'NH-D15', 'NH-D15 chromax.black', 2021, 109, cooler('air', 250, null, 165, ALL_SOCKETS, 24)),
  entry('cool-deepcool-ak620', 'COOLER', 'DeepCool', 'AK Series', 'AK620', 2021, 65, cooler('air', 260, null, 160, ALL_SOCKETS, 28)),
  entry('cool-thermalright-pa120', 'COOLER', 'Thermalright', 'Peerless Assassin', 'Peerless Assassin 120 SE', 2022, 35, cooler('air', 245, null, 155, ALL_SOCKETS, 26)),
  entry('cool-cm-hyper212', 'COOLER', 'Cooler Master', 'Hyper', 'Hyper 212 Black Edition', 2019, 45, cooler('air', 150, null, 159, ALL_SOCKETS, 30)),
  entry('cool-deepcool-gammaxx-400', 'COOLER', 'DeepCool', 'GAMMAXX', 'GAMMAXX 400', 2018, 25, cooler('air', 130, null, 155, ALL_SOCKETS, 32)),
  entry('cool-amd-wraith-stealth', 'COOLER', 'AMD', 'Wraith', 'Wraith Stealth (de caixa)', 2019, null, cooler('stock', 65, null, 54, AM5_AM4, 38)),
  entry('cool-amd-wraith-prism', 'COOLER', 'AMD', 'Wraith', 'Wraith Prism (de caixa)', 2019, null, cooler('stock', 105, null, 85, ['AM4'], 39)),
  entry('cool-intel-laminar-rm1', 'COOLER', 'Intel', 'Laminar', 'Laminar RM1 (de caixa)', 2022, null, cooler('stock', 80, null, 60, INTEL_MODERN, 40)),
];

// ---------------------------------------------------------------------------
// Gabinetes
// ---------------------------------------------------------------------------

const pcCase = (
  formFactors: string[],
  maxGpu: number,
  maxCooler: number,
  included: number,
  mounts: number,
  airflow: CaseSpec['airflowQuality'],
): CaseSpec => ({
  kind: 'CASE',
  formFactors,
  maxGpuLengthMm: maxGpu,
  maxCoolerHeightMm: maxCooler,
  includedFans: included,
  fanMounts: mounts,
  airflowQuality: airflow,
});

const ATX_ALL = ['ATX', 'Micro-ATX', 'Mini-ITX'];

export const CASE_CATALOG: CatalogComponent[] = [
  entry('case-lianli-o11d-evo', 'CASE', 'Lian Li', 'O11 Dynamic', 'O11 Dynamic EVO', 2022, 169, pcCase(['E-ATX', ...ATX_ALL], 426, 167, 0, 10, 'good')),
  entry('case-fractal-north', 'CASE', 'Fractal Design', 'North', 'North', 2023, 139, pcCase(ATX_ALL, 355, 170, 2, 7, 'good')),
  entry('case-nzxt-h5-flow', 'CASE', 'NZXT', 'H Series', 'H5 Flow', 2023, 94, pcCase(ATX_ALL, 365, 165, 2, 7, 'excellent')),
  entry('case-corsair-4000d-airflow', 'CASE', 'Corsair', '4000D', '4000D Airflow', 2020, 104, pcCase(ATX_ALL, 360, 170, 2, 6, 'excellent')),
  entry('case-cm-nr200p', 'CASE', 'Cooler Master', 'NR200', 'MasterBox NR200P', 2020, 99, pcCase(['Mini-ITX'], 330, 155, 2, 6, 'good')),
  entry('case-gamemax-vengeance', 'CASE', 'GameMax', 'Vengeance', 'Vengeance', 2021, 55, pcCase(['ATX', 'Micro-ATX'], 340, 160, 4, 6, 'moderate')),
  entry('case-generic-mid-tower', 'CASE', 'Genérico', 'Mid Tower', 'Gabinete mid tower genérico', 2018, 35, pcCase(['ATX', 'Micro-ATX'], 320, 155, 1, 3, 'restricted')),
  entry('case-generic-glass', 'CASE', 'Genérico', 'Mid Tower', 'Gabinete gamer com vidro (genérico)', 2020, 45, pcCase(['ATX', 'Micro-ATX'], 330, 158, 3, 6, 'restricted')),
];

// ---------------------------------------------------------------------------
// Ventoinhas
// ---------------------------------------------------------------------------

const fan = (size: number, cfm: number, pressure: number, noise: number, rgb: boolean): FanSpec => ({
  kind: 'FAN',
  sizeMm: size,
  airflowCfm: cfm,
  staticPressureMmH2O: pressure,
  noiseDb: noise,
  hasRgb: rgb,
});

export const FAN_CATALOG: CatalogComponent[] = [
  entry('fan-noctua-nfa12x25', 'FAN', 'Noctua', 'NF-A12x25', 'NF-A12x25 PWM 120mm', 2018, 33, fan(120, 60.1, 2.34, 22.6, false)),
  entry('fan-arctic-p12', 'FAN', 'Arctic', 'P12', 'P12 PWM PST 120mm', 2019, 9, fan(120, 56.3, 2.2, 22.5, false)),
  entry('fan-corsair-ql120', 'FAN', 'Corsair', 'iCUE QL', 'iCUE QL120 RGB 120mm', 2020, 35, fan(120, 41.8, 1.55, 26, true)),
  entry('fan-lianli-uniflan-sl120', 'FAN', 'Lian Li', 'UNI FAN', 'UNI FAN SL120 V2', 2022, 25, fan(120, 58.5, 2.65, 29, true)),
  entry('fan-generic-120-rgb', 'FAN', 'Genérica', 'RGB', 'Ventoinha 120mm RGB genérica', 2020, 6, fan(120, 32, 1.1, 32, true)),
];

export const PLATFORM_CATALOG: CatalogComponent[] = [
  ...MOTHERBOARD_CATALOG,
  ...RAM_CATALOG,
  ...STORAGE_CATALOG,
  ...PSU_CATALOG,
  ...COOLER_CATALOG,
  ...CASE_CATALOG,
  ...FAN_CATALOG,
];
