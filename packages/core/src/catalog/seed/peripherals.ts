/**
 * Monitores e periféricos.
 *
 * Periféricos não entram no cálculo de desempenho — por isso o schema deles é aberto.
 * O monitor é a exceção e tem schema próprio: ele define a resolução real de uso e o
 * teto de quadros que o usuário efetivamente enxerga, e sem ele o engine não consegue
 * detectar o desencontro mais caro que existe (PC forte preso num monitor de 60Hz).
 */

import type { CatalogComponent, MonitorSpec, PeripheralSpec } from '../types.ts';

function entry(
  id: string,
  category: CatalogComponent['category'],
  brand: string,
  family: string,
  model: string,
  year: number,
  msrpUsd: number | null,
  spec: CatalogComponent['spec'],
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
    discontinued: false,
    imageUrl: null,
  };
}

const monitor = (
  size: number,
  w: number,
  h: number,
  hz: number,
  panel: MonitorSpec['panelType'],
  responseMs: number,
  hdr: boolean,
  sync: MonitorSpec['adaptiveSync'],
  curved = false,
): MonitorSpec => ({
  kind: 'MONITOR',
  sizeInches: size,
  resolutionWidth: w,
  resolutionHeight: h,
  refreshRateHz: hz,
  panelType: panel,
  responseTimeMs: responseMs,
  hasHdr: hdr,
  adaptiveSync: sync,
  curved,
});

export const MONITOR_CATALOG: CatalogComponent[] = [
  entry('mon-lg-27gp850', 'MONITOR', 'LG', 'UltraGear', '27GP850-B 27" QHD 165Hz', 2021, 449, monitor(27, 2560, 1440, 165, 'IPS', 1, true, 'G-Sync Compatible')),
  entry('mon-lg-27gr95qe', 'MONITOR', 'LG', 'UltraGear', '27GR95QE 27" QHD 240Hz OLED', 2023, 799, monitor(27, 2560, 1440, 240, 'OLED', 0.03, true, 'G-Sync Compatible')),
  entry('mon-samsung-odyssey-g7', 'MONITOR', 'Samsung', 'Odyssey', 'Odyssey G7 32" QHD 240Hz', 2020, 699, monitor(32, 2560, 1440, 240, 'VA', 1, true, 'G-Sync Compatible', true)),
  entry('mon-samsung-odyssey-g5', 'MONITOR', 'Samsung', 'Odyssey', 'Odyssey G5 27" QHD 144Hz', 2020, 299, monitor(27, 2560, 1440, 144, 'VA', 1, true, 'FreeSync', true)),
  entry('mon-aoc-24g2', 'MONITOR', 'AOC', 'Gaming', '24G2 24" FHD 144Hz', 2019, 179, monitor(23.8, 1920, 1080, 144, 'IPS', 1, false, 'FreeSync')),
  entry('mon-lg-34gp63a', 'MONITOR', 'LG', 'UltraGear', '34GP63A 34" UWQHD 160Hz', 2021, 449, monitor(34, 3440, 1440, 160, 'VA', 1, true, 'FreeSync', true)),
  entry('mon-dell-s2721dgf', 'MONITOR', 'Dell', 'S Series', 'S2721DGF 27" QHD 165Hz', 2020, 379, monitor(27, 2560, 1440, 165, 'IPS', 1, true, 'G-Sync Compatible')),
  entry('mon-lg-27up850', 'MONITOR', 'LG', 'UltraFine', '27UP850-W 27" 4K 60Hz', 2021, 449, monitor(27, 3840, 2160, 60, 'IPS', 5, true, 'FreeSync')),
  entry('mon-samsung-odyssey-neo-g8', 'MONITOR', 'Samsung', 'Odyssey', 'Odyssey Neo G8 32" 4K 240Hz', 2022, 999, monitor(32, 3840, 2160, 240, 'VA', 1, true, 'G-Sync Compatible', true)),
  entry('mon-generic-1080-60', 'MONITOR', 'Genérico', 'Escritório', 'Monitor 21.5" FHD 60Hz', 2018, 99, monitor(21.5, 1920, 1080, 60, 'TN', 5, false, 'none')),
  entry('mon-generic-1080-75', 'MONITOR', 'Genérico', 'Escritório', 'Monitor 24" FHD 75Hz', 2020, 129, monitor(24, 1920, 1080, 75, 'IPS', 5, false, 'FreeSync')),
];

const peripheral = (
  connection: PeripheralSpec['connection'],
  attributes: PeripheralSpec['attributes'],
): PeripheralSpec => ({ kind: 'PERIPHERAL', connection, attributes });

export const PERIPHERAL_CATALOG: CatalogComponent[] = [
  // Teclados
  entry('kb-keychron-k8', 'KEYBOARD', 'Keychron', 'K Series', 'K8 Pro', 2022, 99, peripheral('both', { layout: 'TKL', switches: 'Gateron Brown', hotswap: true })),
  entry('kb-logitech-g915', 'KEYBOARD', 'Logitech', 'G Series', 'G915 TKL', 2020, 229, peripheral('wireless', { layout: 'TKL', switches: 'GL Tactile', profile: 'low' })),
  entry('kb-redragon-kumara', 'KEYBOARD', 'Redragon', 'Kumara', 'K552 Kumara', 2017, 39, peripheral('wired', { layout: 'TKL', switches: 'Outemu Blue' })),
  entry('kb-hyperx-alloy-origins', 'KEYBOARD', 'HyperX', 'Alloy', 'Alloy Origins Core', 2020, 89, peripheral('wired', { layout: 'TKL', switches: 'HyperX Red' })),

  // Mouses
  entry('mou-logitech-gpro-x-superlight', 'MOUSE', 'Logitech', 'G PRO', 'G PRO X Superlight 2', 2023, 159, peripheral('wireless', { dpi: 32000, weightGrams: 60, sensor: 'HERO 2' })),
  entry('mou-razer-viper-v3-pro', 'MOUSE', 'Razer', 'Viper', 'Viper V3 Pro', 2024, 159, peripheral('wireless', { dpi: 35000, weightGrams: 54, sensor: 'Focus Pro 35K' })),
  entry('mou-logitech-g203', 'MOUSE', 'Logitech', 'G Series', 'G203 LIGHTSYNC', 2019, 39, peripheral('wired', { dpi: 8000, weightGrams: 85, sensor: 'Mercury' })),
  entry('mou-redragon-cobra', 'MOUSE', 'Redragon', 'Cobra', 'M711 Cobra', 2017, 25, peripheral('wired', { dpi: 10000, weightGrams: 100, sensor: 'PMW3325' })),

  // Headsets
  entry('hs-hyperx-cloud-ii', 'HEADSET', 'HyperX', 'Cloud', 'Cloud II', 2015, 99, peripheral('wired', { driverMm: 53, surround: '7.1 virtual' })),
  entry('hs-steelseries-arctis-nova-7', 'HEADSET', 'SteelSeries', 'Arctis', 'Arctis Nova 7', 2022, 179, peripheral('wireless', { driverMm: 40, batteryHours: 38 })),
  entry('hs-logitech-g733', 'HEADSET', 'Logitech', 'G Series', 'G733 LIGHTSPEED', 2020, 149, peripheral('wireless', { driverMm: 40, batteryHours: 29 })),

  // Microfones
  entry('mic-hyperx-quadcast-s', 'MICROPHONE', 'HyperX', 'QuadCast', 'QuadCast S', 2020, 159, peripheral('wired', { type: 'condensador USB', patterns: 4 })),
  entry('mic-fifine-k669b', 'MICROPHONE', 'Fifine', 'K Series', 'K669B', 2019, 35, peripheral('wired', { type: 'condensador USB', patterns: 1 })),

  // Webcams
  entry('cam-logitech-c920', 'WEBCAM', 'Logitech', 'C Series', 'C920 HD Pro', 2012, 79, peripheral('wired', { resolution: '1080p', fps: 30 })),
  entry('cam-logitech-brio-4k', 'WEBCAM', 'Logitech', 'BRIO', 'BRIO 4K', 2017, 199, peripheral('wired', { resolution: '4K', fps: 30 })),

  // Mousepads e controles
  entry('pad-artisan-hien', 'MOUSEPAD', 'Artisan', 'Hien', 'Hien Mid XL', 2020, 55, peripheral('wired', { sizeMm: '420x330', surface: 'tecido' })),
  entry('pad-generic-speed-xl', 'MOUSEPAD', 'Genérico', 'Speed', 'Mousepad XL Speed', 2020, 15, peripheral('wired', { sizeMm: '800x300', surface: 'tecido' })),
  entry('ctl-xbox-series', 'CONTROLLER', 'Microsoft', 'Xbox', 'Controle Xbox Series X|S', 2020, 59, peripheral('both', { platform: 'Xbox/PC' })),
  entry('ctl-dualsense', 'CONTROLLER', 'Sony', 'DualSense', 'DualSense', 2020, 69, peripheral('both', { platform: 'PS5/PC', hapticFeedback: true })),
];
