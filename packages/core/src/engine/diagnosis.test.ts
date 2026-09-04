/**
 * Testes do diagnóstico e do Setup Score contra máquinas montadas com o catálogo real.
 *
 * O teste mais importante deste arquivo é `PC mais barato e equilibrado vence PC caro e
 * desequilibrado`. Ele trava a promessa central do produto. Se ele quebrar, o Pecê virou
 * um ranking de quanto a pessoa gastou — que é exatamente o que a especificação proíbe.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { componentById } from '../catalog/seed/index.ts';
import type { Rig, RigComponent } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { diagnose } from './diagnosis.ts';
import { buildScenarios } from './scenarios.ts';
import { computeSetupScore } from '../score/setupScore.ts';
import { valuateRig } from '../value/valuation.ts';

function part(id: string, quantity = 1): RigComponent {
  const component = componentById(id);
  assert.ok(component, `componente ausente no catálogo: ${id}`);
  return {
    id: `rc-${id}`,
    component,
    quantity,
    condition: 'new',
    acquiredAt: null,
    paidAmount: null,
    paidCurrency: null,
    notes: null,
  };
}

function rig(name: string, ids: Array<string | [string, number]>): Rig {
  return {
    id: `rig-${name}`,
    ownerId: 'user-1',
    name,
    kind: 'desktop',
    isPrimary: true,
    components: ids.map((entry) =>
      typeof entry === 'string' ? part(entry) : part(entry[0], entry[1]),
    ),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

const profile = (over: Partial<UsageProfile> = {}): UsageProfile => ({
  workloads: [{ kind: 'aaa-gaming', weight: 3 }],
  resolution: '1080p',
  targetFps: 60,
  budget: { tier: 'moderate', amount: null, currency: 'BRL' },
  priorities: ['value-for-money'],
  region: 'BR',
  expertise: 'beginner',
  ...over,
});

// ---------------------------------------------------------------------------

describe('diagnose — o veredito "não faça upgrade"', () => {
  /**
   * A capacidade obrigatória do produto: dizer que está bom e não vender nada.
   * Um PC bem casado e adequado ao alvo não pode gerar recomendação de compra.
   */
  it('PC equilibrado e adequado ao alvo recebe veredito saudável', () => {
    const balanced = rig('Equilibrado', [
      'cpu-r7-7800x3d',
      'gpu-rtx-4070-super',
      'mb-msi-b650-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-samsung-990pro-1tb',
      'psu-corsair-rm750x',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
      ['fan-arctic-p12', 3],
    ]);

    const d = diagnose(balanced, profile({ resolution: '1440p', targetFps: 75 }));

    assert.equal(d.verdict, 'healthy', `esperava healthy, veio ${d.verdict}: ${d.headline}`);
    assert.match(d.headline, /não precisa fazer upgrade/i);
    assert.equal(
      d.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length,
      0,
    );
    assert.ok(d.approved.length >= 4, 'deveria aprovar explicitamente as peças que estão boas');
  });

  it('quando está saudável, não existe cenário de upgrade para empurrar', () => {
    const balanced = rig('Equilibrado', [
      'cpu-r7-7800x3d',
      'gpu-rtx-4070-super',
      'mb-msi-b650-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-samsung-990pro-1tb',
      'psu-corsair-rm750x',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
    ]);
    const p = profile({ resolution: '1440p', targetFps: 75 });
    const d = diagnose(balanced, p);

    // Existem GPUs mais fortes no catálogo, mas o diagnóstico não pede troca de nada.
    assert.equal(d.verdict, 'healthy');
    assert.equal(d.findings.filter((f) => f.kind === 'bottleneck').length, 0);
  });
});

describe('diagnose — detecção de gargalo real', () => {
  it('processador fraco com placa forte em 1080p é acusado como gargalo de CPU', () => {
    const lopsided = rig('Desequilibrado', [
      'cpu-i5-10400f',
      'gpu-rtx-4080-super',
      'mb-msi-b560m-pro',
      ['ram-corsair-veng-ddr4-8-3200', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-rm850x',
      'cool-cm-hyper212',
      'case-corsair-4000d-airflow',
    ]);

    const d = diagnose(lopsided, profile());
    const bottleneck = d.findings.find((f) => f.kind === 'bottleneck');

    assert.ok(bottleneck, 'deveria ter encontrado um gargalo');
    assert.equal(bottleneck.category, 'CPU');
    assert.match(bottleneck.what, /processador/i);
    assert.ok(bottleneck.technical.length > 0, 'precisa ter camada técnica para o avançado');
    assert.ok(bottleneck.why.length > 40, 'a explicação precisa ser em linguagem natural');
  });

  it('o mesmo PC em 4K deixa de ter gargalo de processador', () => {
    const lopsided = rig('Desequilibrado', [
      'cpu-i5-10400f',
      'gpu-rtx-4080-super',
      'mb-msi-b560m-pro',
      ['ram-corsair-veng-ddr4-8-3200', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-rm850x',
      'cool-cm-hyper212',
      'case-corsair-4000d-airflow',
    ]);

    const at4k = diagnose(lopsided, profile({ resolution: '4K', targetFps: 60 }));
    const bottleneck = at4k.findings.find((f) => f.kind === 'bottleneck');
    assert.notEqual(bottleneck?.category, 'CPU', 'em 4K o processador não deve ser acusado');
  });
});

describe('diagnose — problemas de subsistema', () => {
  it('fonte insuficiente é tratada como crítico', () => {
    const underpowered = rig('Fonte fraca', [
      'cpu-i9-14900k',
      'gpu-rtx-4090',
      'mb-msi-z790-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-samsung-990pro-1tb',
      'psu-corsair-cx550',
      'cool-arctic-lf3-360',
      'case-lianli-o11d-evo',
    ]);

    const d = diagnose(underpowered, profile());
    assert.equal(d.verdict, 'critical');
    const power = d.findings.find((f) => f.kind === 'power');
    assert.ok(power);
    assert.equal(power.severity, 'critical');
    assert.match(power.why, /desligar/i);
  });

  it('um único pente de memória é sinalizado como canal simples', () => {
    const single = rig('Canal simples', [
      'cpu-r5-5600',
      'gpu-rtx-3060-12',
      'mb-asus-b550m-a',
      ['ram-corsair-veng-ddr4-16-3200', 1],
      'sto-kingston-nv2-1tb',
      'psu-corsair-cx650',
      'cool-deepcool-gammaxx-400',
      'case-gamemax-vengeance',
    ]);

    const d = diagnose(single, profile());
    const finding = d.findings.find((f) => f.id === 'memory-single-channel');
    assert.ok(finding, 'canal simples precisa ser detectado');
    assert.equal(finding.severity, 'high');
    assert.match(finding.expectedGain ?? '', /%/);
  });

  it('PC só com HD recebe recomendação de SSD com alta prioridade', () => {
    const noSsd = rig('Sem SSD', [
      'cpu-r5-3600',
      'gpu-gtx-1660-super',
      'mb-msi-b450m-pro',
      ['ram-corsair-veng-ddr4-8-3200', 2],
      'sto-seagate-barracuda-2tb',
      'psu-corsair-cx550',
      'cool-amd-wraith-stealth',
      'case-generic-mid-tower',
    ]);

    const d = diagnose(noSsd, profile());
    const storage = d.findings.find((f) => f.id === 'storage-no-ssd');
    assert.ok(storage);
    assert.equal(storage.severity, 'high');
  });

  it('PC potente num monitor de 60Hz aponta o monitor, não as peças internas', () => {
    const monitorLimited = rig('Monitor fraco', [
      'cpu-r7-9800x3d',
      'gpu-rtx-5080',
      'mb-asus-x870e-hero',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-samsung-990pro-2tb',
      'psu-corsair-rm1000x',
      'cool-arctic-lf3-360',
      'case-lianli-o11d-evo',
      'mon-generic-1080-60',
    ]);

    const d = diagnose(monitorLimited, profile({ resolution: '1080p', targetFps: null }));
    const display = d.findings.find((f) => f.id === 'display-refresh-limited');
    assert.ok(display, 'deveria apontar o monitor como limitante');
    assert.equal(display.category, 'MONITOR');
  });
});

describe('diagnose — honestidade sobre incerteza', () => {
  it('cadastro incompleto vira limitação declarada, não um número inventado', () => {
    const incomplete = rig('Incompleto', ['cpu-r5-5600', 'gpu-rtx-3060-12']);
    const d = diagnose(incomplete, profile());

    assert.ok(d.limitations.length >= 3, 'deveria listar o que falta cadastrar');
    assert.ok(d.limitations.some((l) => /fonte/i.test(l)));
    assert.ok(d.limitations.some((l) => /cooler/i.test(l)));
  });

  it('sem CPU e GPU não inventa estimativa de desempenho', () => {
    const empty = rig('Vazio', ['psu-corsair-cx650', 'case-fractal-north']);
    const d = diagnose(empty, profile());
    assert.equal(d.performance.fps, null);
  });
});

// ---------------------------------------------------------------------------

describe('Setup Score — não é ranking de preço', () => {
  /**
   * O teste que define o produto.
   *
   * Esquerda: máquina cara e mal montada — GPU top presa a um processador de 2020,
   * canal simples de memória, cooler de caixa, gabinete sem ventilação.
   * Direita: máquina bem mais barata, mas com tudo casado.
   *
   * A barata precisa vencer.
   */
  it('PC mais barato e equilibrado vence PC caro e desequilibrado', () => {
    const expensive = rig('Caro e desequilibrado', [
      'cpu-i5-10400f',
      'gpu-rtx-4090',
      'mb-msi-b560m-pro',
      ['ram-corsair-veng-ddr4-16-3200', 1],
      'sto-kingston-a400-480',
      'psu-corsair-rm850x',
      'cool-intel-laminar-rm1',
      'case-generic-glass',
    ]);

    const affordable = rig('Barato e equilibrado', [
      'cpu-r5-7600',
      'gpu-rtx-4060-ti-8',
      'mb-gigabyte-b650m-ds3h',
      ['ram-kingston-fury-ddr5-16-5600', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-cx650',
      'cool-thermalright-pa120',
      'case-nzxt-h5-flow',
      ['fan-arctic-p12', 3],
    ]);

    const p = profile({ resolution: '1080p', targetFps: 100 });

    const expensiveValue = valuateRig(expensive, 'BR');
    const affordableValue = valuateRig(affordable, 'BR');
    const expensiveScore = computeSetupScore(expensive, p);
    const affordableScore = computeSetupScore(affordable, p);

    // Pré-condição: a máquina da esquerda realmente custa mais.
    assert.ok(
      expensiveValue.coreTotal > affordableValue.coreTotal,
      `pré-condição falhou: caro=${expensiveValue.coreTotal} barato=${affordableValue.coreTotal}`,
    );

    assert.ok(
      affordableScore.total > expensiveScore.total,
      `o PC barato e equilibrado (R$${affordableValue.coreTotal}, score ${affordableScore.total}) ` +
        `deveria vencer o caro e desequilibrado (R$${expensiveValue.coreTotal}, score ${expensiveScore.total})`,
    );
  });

  it('cada dimensão do score vem com explicação', () => {
    const r = rig('Qualquer', [
      'cpu-r5-5600',
      'gpu-rtx-3060-12',
      'mb-asus-b550m-a',
      ['ram-corsair-veng-ddr4-8-3200', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-cx650',
      'cool-cm-hyper212',
      'case-corsair-4000d-airflow',
    ]);

    const score = computeSetupScore(r, profile());
    assert.equal(score.dimensions.length, 5);
    for (const d of score.dimensions) {
      assert.ok(d.reason.length > 10, `dimensão ${d.dimension} sem explicação`);
      assert.ok(d.score >= 0 && d.score <= 100);
    }
    const totalWeight = score.dimensions.reduce((s, d) => s + d.weight, 0);
    assert.ok(Math.abs(totalWeight - 1) < 0.001, 'os pesos precisam somar 1');
  });
});

// ---------------------------------------------------------------------------

describe('buildScenarios — recomendações concretas e compatíveis', () => {
  it('nunca recomenda peça incompatível com a placa-mãe', () => {
    // Placa AM4: nenhum processador AM5 pode aparecer.
    const am4 = rig('AM4', [
      'cpu-r5-3600',
      'gpu-rtx-4070',
      'mb-asus-b550m-a',
      ['ram-corsair-veng-ddr4-16-3200', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-cx650',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
    ]);

    const scenarios = buildScenarios(am4, profile(), { category: 'CPU' });
    assert.ok(scenarios.length > 0, 'deveria encontrar upgrades de CPU compatíveis');

    for (const s of scenarios) {
      const spec = s.component.spec;
      assert.equal(spec.kind, 'CPU');
      if (spec.kind === 'CPU') {
        assert.equal(spec.socket, 'AM4', `recomendou ${s.component.model}, que é ${spec.socket}`);
      }
      assert.notEqual(s.compatibility.level, 'blocked');
    }
  });

  it('nunca recomenda GPU que estoure a fonte do usuário', () => {
    const smallPsu = rig('Fonte pequena', [
      'cpu-r7-7800x3d',
      'gpu-rtx-3060-12',
      'mb-msi-b650-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-cx550',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
    ]);

    const scenarios = buildScenarios(smallPsu, profile(), { category: 'GPU' });
    for (const s of scenarios) {
      assert.notEqual(
        s.compatibility.level,
        'blocked',
        `${s.component.model} não deveria ter passado`,
      );
    }
  });

  it('todo cenário traz ganho projetado, custo e justificativa', () => {
    const r = rig('Base', [
      'cpu-r7-7800x3d',
      'gpu-rtx-3060-12',
      'mb-msi-b650-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-rm850x',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
    ]);

    const scenarios = buildScenarios(r, profile(), { category: 'GPU' });
    assert.ok(scenarios.length >= 2);

    for (const s of scenarios) {
      assert.ok(s.gainPercent >= 8, 'não faz sentido sugerir upgrade sem ganho relevante');
      assert.ok(s.estimatedCost > 0);
      assert.ok(s.rationale.length > 20);
      assert.ok(s.advantages.length > 0);
      assert.ok(s.fpsAfter > s.fpsBefore);
    }
  });

  it('respeita o teto de orçamento', () => {
    const r = rig('Base', [
      'cpu-r7-7800x3d',
      'gpu-rtx-3060-12',
      'mb-msi-b650-tomahawk',
      ['ram-corsair-veng-ddr5-16-6000', 2],
      'sto-kingston-nv2-1tb',
      'psu-corsair-rm850x',
      'cool-deepcool-ak620',
      'case-corsair-4000d-airflow',
    ]);

    const scenarios = buildScenarios(r, profile(), { category: 'GPU', maxBudget: 3000 });
    for (const s of scenarios) {
      assert.ok(s.estimatedCost <= 3000, `${s.component.model} custa ${s.estimatedCost}`);
    }
  });
});
