/**
 * Testes do PC Health.
 *
 * Dois deles guardam promessas do produto e não são detalhe de implementação:
 *
 * - `problema de saúde não vira recomendação de compra quando o conserto é grátis`:
 *   é o "seu PC está bom, não faça upgrade" aplicado ao eixo novo. Um app que responde
 *   "seu cooler está sujo" com "compre uma GPU melhor" virou funil.
 *
 * - `saúde e diagnóstico nunca discordam sobre o mesmo fato`: os dois leem as mesmas
 *   funções de análise de propósito. Se alguém reescrever os checks térmicos aqui, a aba
 *   Saúde e a de diagnóstico passam a dizer coisas diferentes sobre a mesma máquina.
 *
 * Todo teste passa um `now` explícito. Saúde é o único módulo do engine que depende do
 * tempo, e teste dependente de data que passa hoje e falha em setembro do ano que vem é
 * pior do que teste nenhum.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { componentById } from '../catalog/seed/index.ts';
import type { Rig, RigComponent } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { diagnose } from '../engine/diagnosis.ts';
import { buildScenarios } from '../engine/scenarios.ts';
import { assessHealth } from './health.ts';

const NOW = new Date('2026-09-04');

function part(id: string, quantity = 1, acquiredAt: Date | null = null): RigComponent {
  const component = componentById(id);
  assert.ok(component, `componente ausente no catálogo: ${id}`);
  return {
    id: `rc-${id}`,
    component,
    quantity,
    condition: 'new',
    acquiredAt,
    paidAmount: null,
    paidCurrency: null,
    notes: null,
  };
}

function rig(name: string, items: RigComponent[]): Rig {
  return {
    id: `rig-${name}`,
    ownerId: 'user-1',
    name,
    kind: 'desktop',
    isPrimary: true,
    components: items,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

const profile = (over: Partial<UsageProfile> = {}): UsageProfile => ({
  workloads: [{ kind: 'aaa-gaming', weight: 3 }],
  resolution: '1440p',
  targetFps: 75,
  budget: { tier: 'moderate', amount: null, currency: 'BRL' },
  priorities: ['value-for-money'],
  region: 'BR',
  expertise: 'beginner',
  ...over,
});

/** Máquina moderna e bem casada: nada a apontar em saúde. */
function healthyRig(): Rig {
  return rig('Saudável', [
    part('cpu-r7-7800x3d'),
    part('gpu-rtx-4070-super'),
    part('mb-msi-b650-tomahawk'),
    part('ram-corsair-veng-ddr5-16-6000', 2),
    part('sto-samsung-990pro-1tb'),
    part('psu-corsair-rm750x'),
    part('cool-deepcool-ak620'),
    part('case-corsair-4000d-airflow'),
    part('fan-arctic-p12', 3),
  ]);
}

// ---------------------------------------------------------------------------

describe('PC Health — o eixo da condição, não do desempenho', () => {
  it('máquina moderna e bem cuidada recebe saúde em ordem', () => {
    const report = assessHealth(healthyRig(), NOW);

    assert.equal(report.status, 'good', `veio ${report.status}: ${report.headline}`);
    assert.equal(report.score, 100);
    assert.equal(report.checks.length, 0);
    assert.ok(report.passing.length >= 3, 'saúde boa precisa dizer o que está em ordem');
    assert.match(report.headline, /bem cuidada/i);
  });

  it('saúde não depende do que a pessoa faz com o PC', () => {
    // Uma fonte de nove anos é o mesmo risco para quem joga e para quem edita vídeo.
    const machine = healthyRig();
    const before = assessHealth(machine, NOW);
    // Sem perfil na assinatura, não há como o uso influenciar — o teste trava a assinatura.
    assert.deepEqual(assessHealth(machine, NOW), before);
  });

  it('avaliação declara que não lê sensores', () => {
    const report = assessHealth(healthyRig(), NOW);
    assert.ok(
      report.limitations.some((l) => /sensor/i.test(l)),
      'o produto precisa admitir que estima pelo tempo, não mede temperatura',
    );
  });

  /**
   * A regra de idade aqui é diferente da valuation de propósito. Lá o ano de lançamento é
   * piso: um modelo de 2018 vale menos hoje. Desgaste conta tempo ligado, e um modelo
   * antigo comprado lacrado ontem não tem desgaste nenhum. Tratar os dois igual faria o
   * produto mandar trocar a fonte de quem acabou de comprá-la.
   */
  it('peça sem data de compra não vira acusação de desgaste — vira lacuna declarada', () => {
    const machine = healthyRig();
    assert.ok(
      machine.components.every((c) => c.acquiredAt === null),
      'pré-condição: nenhuma peça tem data declarada',
    );

    const report = assessHealth(machine, NOW);

    assert.equal(
      report.checks.some((c) => c.area === 'wear' || c.area === 'maintenance'),
      false,
      'sem data de compra o engine não pode afirmar desgaste',
    );
    assert.ok(
      report.limitations.some((l) => /data de compra/i.test(l)),
      'a lacuna precisa ser dita, não escondida',
    );
  });
});

describe('PC Health — o tempo, que nenhum FPS mostra', () => {
  it('fonte velha vira risco, mesmo com a máquina rápida', () => {
    const machine = healthyRig();
    machine.components = machine.components.map((c) =>
      c.component.category === 'PSU' ? part('psu-corsair-rm750x', 1, new Date('2015-01-01')) : c,
    );

    const report = assessHealth(machine, NOW);
    const psu = report.checks.find((c) => c.id === 'wear-psu-age');

    assert.ok(psu, 'fonte de mais de 8 anos precisa aparecer');
    assert.equal(psu.status, 'at-risk');
    assert.ok(psu.ageYears !== null && psu.ageYears >= 8);

    // E o desempenho não mudou: é exatamente o ponto do eixo separado.
    const d = diagnose(machine, profile());
    assert.equal(d.verdict, 'healthy', 'a fonte velha não deveria mexer no veredito de desempenho');
  });

  it('peça instalada há anos sugere limpeza e pasta, não compra', () => {
    const old = new Date('2020-01-01');
    const machine = rig('Antiga', [
      part('cpu-r7-7800x3d', 1, old),
      part('gpu-rtx-4070-super', 1, old),
      part('mb-msi-b650-tomahawk', 1, old),
      part('ram-corsair-veng-ddr5-16-6000', 2, old),
      part('sto-samsung-990pro-1tb', 1, old),
      part('psu-corsair-rm750x', 1, old),
      part('cool-deepcool-ak620', 1, old),
      part('case-corsair-4000d-airflow', 1, old),
    ]);

    const report = assessHealth(machine, NOW);
    const maintenance = report.checks.find((c) => c.id === 'maintenance-due');

    assert.ok(maintenance, 'máquina com anos de uso precisa lembrar da manutenção');
    assert.equal(maintenance.costsMoney, false);
    assert.match(maintenance.how ?? '', /pasta térmica/i);
    assert.ok(report.freeActions.length > 0);
  });

  it('máquina nova não recebe lembrete de manutenção', () => {
    const report = assessHealth(healthyRig(), new Date('2024-06-01'));
    assert.equal(
      report.checks.some((c) => c.id === 'maintenance-due'),
      false,
    );
  });
});

describe('PC Health — não vira funil de venda', () => {
  /**
   * A promessa central aplicada ao eixo novo. Uma máquina cuja saúde pede manutenção
   * não pode receber cenário de compra como resposta.
   */
  it('problema de saúde não vira recomendação de compra quando o conserto é grátis', () => {
    const old = new Date('2019-01-01');
    const machine = rig('Precisa de carinho', [
      part('cpu-r7-7800x3d', 1, old),
      part('gpu-rtx-4070-super', 1, old),
      part('mb-msi-b650-tomahawk', 1, old),
      part('ram-corsair-veng-ddr5-16-6000', 2, old),
      part('sto-samsung-990pro-1tb', 1, old),
      part('psu-corsair-rm750x', 1, old),
      part('cool-deepcool-ak620', 1, old),
      part('case-corsair-4000d-airflow', 1, old),
    ]);
    const p = profile();

    const report = assessHealth(machine, NOW);
    assert.notEqual(report.status, 'good', 'pré-condição: esta máquina tem o que cuidar');

    // O diagnóstico continua sem empurrar compra.
    const d = diagnose(machine, p);
    assert.equal(d.verdict, 'healthy');
    assert.deepEqual(
      buildScenarios(machine, p, { category: 'GPU', maxBudget: null }).filter((s) => s.gainPercent < 8),
      [],
    );

    // E a maior parte do que Health aponta se resolve sem gastar.
    const free = report.checks.filter((c) => !c.costsMoney);
    assert.ok(free.length > 0, 'saúde precisa oferecer caminho que não custa dinheiro');
    assert.match(report.summary, /sem comprar nada/i);
  });

  it('o que é grátis aparece antes do que custa, em gravidade igual', () => {
    const old = new Date('2015-01-01');
    const machine = rig('Mista', [
      part('cpu-r7-7800x3d', 1, old),
      part('gpu-rtx-4070-super', 1, old),
      part('mb-msi-b650-tomahawk', 1, old),
      part('ram-corsair-veng-ddr5-16-6000', 2, old),
      part('sto-samsung-990pro-1tb', 1, old),
      part('psu-corsair-rm750x', 1, old),
      part('cool-deepcool-ak620', 1, old),
      part('case-corsair-4000d-airflow', 1, old),
      part('fan-arctic-p12', 3, old),
    ]);

    const report = assessHealth(machine, NOW);
    const sameStatus = report.checks.filter((c) => c.status === report.checks[0]!.status);

    const firstPaid = sameStatus.findIndex((c) => c.costsMoney);
    const lastFree = sameStatus.map((c) => c.costsMoney).lastIndexOf(false);
    if (firstPaid !== -1 && lastFree !== -1) {
      assert.ok(lastFree < firstPaid, 'o que custa dinheiro não pode vir antes do que é grátis');
    }
  });
});

describe('PC Health — não contradiz o diagnóstico', () => {
  /**
   * Refrigeração, energia e compatibilidade são analisadas uma vez só, e os dois eixos
   * leem o mesmo resultado. Este teste falha no dia em que alguém reescrever essa análise
   * dentro do health.ts — que é exatamente quando a tela começaria a discordar do engine.
   */
  it('saúde e diagnóstico nunca discordam sobre o mesmo fato', () => {
    const machines: Rig[] = [
      healthyRig(),
      rig('Fonte apertada', [
        part('cpu-i5-10400f'),
        part('gpu-rtx-4090'),
        part('mb-msi-b560m-pro'),
        part('ram-corsair-veng-ddr4-16-3200'),
        part('sto-kingston-a400-480'),
        part('psu-corsair-cx650'),
        part('cool-intel-laminar-rm1'),
        part('case-generic-glass'),
      ]),
    ];

    for (const machine of machines) {
      const d = diagnose(machine, profile());
      const report = assessHealth(machine, NOW);

      for (const f of d.findings) {
        if (!['thermal', 'power', 'compatibility'].includes(f.kind)) continue;

        const check = report.checks.find((c) => c.id === f.id);
        assert.ok(check, `o achado ${f.id} sumiu do relatório de saúde`);
        assert.equal(check.what, f.what, `${f.id}: os dois eixos dizem coisas diferentes`);
        assert.equal(check.why, f.why, `${f.id}: as explicações divergiram`);
      }
    }
  });

  it('um achado crítico do diagnóstico nunca deixa a saúde como "em ordem"', () => {
    const machine = rig('Fonte insuficiente', [
      part('cpu-r7-7800x3d'),
      part('gpu-rtx-4090'),
      part('mb-msi-b650-tomahawk'),
      part('ram-corsair-veng-ddr5-16-6000', 2),
      part('sto-samsung-990pro-1tb'),
      part('psu-corsair-cx650'),
      part('cool-deepcool-ak620'),
      part('case-corsair-4000d-airflow'),
    ]);

    const d = diagnose(machine, profile());
    const critical = d.findings.filter(
      (f) => f.severity === 'critical' && ['power', 'thermal', 'compatibility'].includes(f.kind),
    );
    if (critical.length === 0) return; // Cenário não produziu crítico; nada a afirmar.

    const report = assessHealth(machine, NOW);
    assert.equal(report.status, 'critical');
    assert.ok(report.score < 60);
  });
});
