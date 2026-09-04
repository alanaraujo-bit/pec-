/**
 * Testes de calibração do modelo de performance.
 *
 * Não são testes de unidade comuns: eles travam o modelo contra a realidade conhecida.
 * Se alguém ajustar um coeficiente e um destes quebrar, o modelo passou a mentir.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { CpuSpec, GpuSpec } from '../catalog/types.ts';
import { estimateFps } from './performance.ts';

function cpu(gaming: number, over: Partial<CpuSpec> = {}): CpuSpec {
  return {
    kind: 'CPU',
    socket: 'AM5',
    cores: 8,
    threads: 16,
    baseClockGhz: 4.2,
    boostClockGhz: 5.2,
    l3CacheMb: 96,
    tdpWatts: 120,
    peakPowerWatts: 162,
    integratedGraphics: null,
    memoryTypes: ['DDR5'],
    lithographyNm: 4,
    performance: { singleThread: gaming, multiThread: gaming, gaming },
    ...over,
  };
}

function gpu(raster: number, vramGb = 16): GpuSpec {
  return {
    kind: 'GPU',
    vramGb,
    vramType: 'GDDR7',
    memoryBusBits: 256,
    baseClockMhz: 2000,
    boostClockMhz: 2600,
    tdpWatts: 300,
    peakPowerWatts: 350,
    recommendedPsuWatts: 750,
    lengthMm: 300,
    slotWidth: 3,
    powerConnectors: '1x 12V-2x6',
    pcieVersion: 5,
    performance: { raster, rayTracing: raster * 0.85 },
  };
}

// Índices de referência, na mesma escala do catálogo (RTX 5090 = 100, 9800X3D = 100).
const RTX_4090 = 72;
const RTX_4070 = 37;
const RTX_3060 = 20;
const R7_9800X3D = 100;
const I5_10400F = 48;

/** Faixa aceitável: o modelo é uma estimativa, não uma medição. */
function assertNear(actual: number, expected: number, tolerance: number, label: string) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${label}: esperado ~${expected} (±${tolerance}), obtido ${actual}`,
  );
}

describe('estimateFps — ancoragem na realidade', () => {
  it('RTX 4090 + 9800X3D em jogo pesado bate os números conhecidos nas três resoluções', () => {
    const c = cpu(R7_9800X3D);
    const g = gpu(RTX_4090, 24);

    const r1080 = estimateFps(c, g, '1080p', 'aaa-gaming')!;
    const r1440 = estimateFps(c, g, '1440p', 'aaa-gaming')!;
    const r4k = estimateFps(c, g, '4K', 'aaa-gaming')!;

    assertNear(r1080.fps, 190, 25, '4090+9800X3D @1080p');
    assertNear(r1440.fps, 138, 20, '4090+9800X3D @1440p');
    assertNear(r4k.fps, 87, 15, '4090+9800X3D @4K');
  });

  it('RTX 3060 em 1080p entrega a faixa de 60fps que se vê na prática', () => {
    const r = estimateFps(cpu(R7_9800X3D), gpu(RTX_3060, 12), '1080p', 'aaa-gaming')!;
    assertNear(r.fps, 60, 12, '3060 @1080p');
    assert.equal(r.limitedBy, 'gpu');
  });

  it('CS2 num topo de linha passa de 600fps', () => {
    const r = estimateFps(cpu(R7_9800X3D), gpu(RTX_4090, 24), '1080p', 'competitive-gaming')!;
    assert.ok(r.fps > 600, `esperado >600fps, obtido ${r.fps}`);
  });
});

describe('estimateFps — comportamento do gargalo', () => {
  /**
   * A propriedade que mais importa no produto inteiro: gargalo de CPU encolhe conforme
   * a resolução sobe, porque o custo de CPU por frame não depende de resolução.
   * Errar isso significa recomendar troca de processador para quem joga em 4K.
   */
  it('gargalo de CPU some ao subir a resolução', () => {
    const c = cpu(I5_10400F);
    const g = gpu(RTX_4070, 12);

    const at1080 = estimateFps(c, g, '1080p', 'aaa-gaming')!;
    const at4k = estimateFps(c, g, '4K', 'aaa-gaming')!;

    assert.equal(at1080.limitedBy, 'cpu', '1080p deve ser limitado por CPU');
    assert.equal(at4k.limitedBy, 'gpu', '4K deve ser limitado por GPU');
  });

  it('o teto de CPU não muda com a resolução', () => {
    const c = cpu(I5_10400F);
    const g = gpu(RTX_4070, 12);
    const a = estimateFps(c, g, '1080p', 'aaa-gaming')!;
    const b = estimateFps(c, g, '4K', 'aaa-gaming')!;
    assert.equal(a.cpuBoundFps, b.cpuBoundFps);
  });

  it('par equilibrado não é reportado como gargalo', () => {
    // 4070 a 1440p com um CPU proporcional: nenhum dos dois deve ser acusado.
    const g = gpu(RTX_4070, 12);
    const gpuCeiling = RTX_4070 * 1.95;
    const matchedCpu = cpu(gpuCeiling / 1.9);
    const r = estimateFps(matchedCpu, g, '1440p', 'aaa-gaming')!;
    assert.equal(r.limitedBy, 'balanced');
    assert.ok(r.bottleneckSeverity < 0.08);
  });
});

describe('estimateFps — VRAM', () => {
  it('VRAM insuficiente em 4K penaliza o resultado', () => {
    const c = cpu(R7_9800X3D);
    const generous = estimateFps(c, gpu(RTX_4070, 16), '4K', 'aaa-gaming')!;
    const starved = estimateFps(c, gpu(RTX_4070, 8), '4K', 'aaa-gaming')!;

    assert.equal(generous.vramPenalty, 0);
    assert.ok(starved.vramPenalty > 0, 'esperava penalidade com 8GB em 4K');
    assert.ok(starved.fps < generous.fps);
    assert.equal(starved.confidence, 'low', 'com VRAM estourada a confiança tem de cair');
  });

  it('jogo competitivo não é penalizado por VRAM', () => {
    const r = estimateFps(cpu(R7_9800X3D), gpu(RTX_3060, 6), '1080p', 'competitive-gaming')!;
    assert.equal(r.vramPenalty, 0);
  });
});

describe('estimateFps — contrato', () => {
  it('devolve null para carga que não produz FPS', () => {
    assert.equal(estimateFps(cpu(80), gpu(40), '1080p', 'video-editing'), null);
  });
});
