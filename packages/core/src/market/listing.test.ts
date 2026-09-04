/**
 * Testes do marketplace.
 *
 * O teste mais importante deste arquivo é `anunciar todas as peças não muda nada no
 * diagnóstico nem no Setup Score`. Ele é a forma executável da regra que manda no produto:
 * monetização jamais altera a verdade técnica. Se alguém um dia fizer o anúncio mexer no
 * rig — marcar peça, injetar preço, reordenar componente — este teste quebra antes de a
 * distorção chegar na tela de alguém.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { componentById } from '../catalog/seed/index.ts';
import type { Rig, RigComponent } from '../rig/types.ts';
import type { UsageProfile } from '../profile/types.ts';
import { diagnose } from '../engine/diagnosis.ts';
import { buildScenarios } from '../engine/scenarios.ts';
import { computeSetupScore } from '../score/setupScore.ts';
import { suggestSellingPrice } from '../value/valuation.ts';
import {
  assessAskingPrice,
  buildListingDraft,
  canTransition,
  isOpen,
  priceBands,
  transitionError,
} from './listing.ts';

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

const BALANCED: Array<string | [string, number]> = [
  'cpu-r7-7800x3d',
  'gpu-rtx-4070-super',
  'mb-msi-b650-tomahawk',
  ['ram-corsair-veng-ddr5-16-6000', 2],
  'sto-samsung-990pro-1tb',
  'psu-corsair-rm750x',
  'cool-deepcool-ak620',
  'case-corsair-4000d-airflow',
];

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

// ---------------------------------------------------------------------------

describe('marketplace — monetização não altera a verdade técnica', () => {
  it('anunciar todas as peças não muda nada no diagnóstico nem no Setup Score', () => {
    const machine = rig('Equilibrado', BALANCED);
    const p = profile();
    const now = new Date('2026-09-04');

    const diagnosisBefore = diagnose(machine, p);
    const scoreBefore = computeSetupScore(machine, p, diagnosisBefore);
    const snapshot = JSON.stringify(machine);

    // Todo o setup vai a leilão. O engine não pode nem perceber.
    const drafts = machine.components.map((item) => buildListingDraft(item, p.region, now));
    assert.ok(
      drafts.some((d) => d !== null),
      'pré-condição falhou: nenhuma peça deste PC tem preço de referência',
    );

    const diagnosisAfter = diagnose(machine, p);
    const scoreAfter = computeSetupScore(machine, p, diagnosisAfter);

    assert.equal(JSON.stringify(machine), snapshot, 'o rascunho de anúncio mutou a máquina');
    assert.deepEqual(diagnosisAfter, diagnosisBefore, 'o diagnóstico mudou depois de anunciar');
    assert.deepEqual(scoreAfter, scoreBefore, 'o Setup Score mudou depois de anunciar');
  });

  it('PC saudável com peças anunciadas continua sem cenário de compra', () => {
    const machine = rig('Equilibrado', BALANCED);
    const p = profile();

    const d = diagnose(machine, p);
    assert.equal(d.verdict, 'healthy', `pré-condição falhou: veredito ${d.verdict}`);

    // Poder vender a GPU não é motivo para o produto sugerir trocá-la.
    const gpu = machine.components.find((c) => c.component.category === 'GPU')!;
    assert.ok(buildListingDraft(gpu, p.region), 'a GPU deveria ter faixa de venda');

    assert.equal(diagnose(machine, p).verdict, 'healthy');
    assert.deepEqual(
      buildScenarios(machine, p, { category: 'GPU', maxBudget: null }).filter(
        (s) => s.gainPercent < 8,
      ),
      [],
      'cenário sem ganho relevante não pode aparecer só porque existe mercado',
    );
  });

  it('a faixa de venda é a mesma faixa da valuation — o marketplace não tem preço próprio', () => {
    const machine = rig('Equilibrado', BALANCED);
    const now = new Date('2026-09-04');
    const gpu = machine.components.find((c) => c.component.category === 'GPU')!;

    const draft = buildListingDraft(gpu, 'BR', now)!;
    const guidance = suggestSellingPrice(gpu, 'BR', now)!;

    assert.deepEqual(draft.guidance, guidance);
  });
});

describe('marketplace — honestidade sobre o que não se sabe', () => {
  it('peça sem preço de referência não vira anúncio com valor inventado', () => {
    const machine = rig('Equilibrado', BALANCED);
    const gpu = machine.components.find((c) => c.component.category === 'GPU')!;

    const unpriced: RigComponent = {
      ...gpu,
      component: { ...gpu.component, msrpUsd: null },
    };

    assert.equal(
      buildListingDraft(unpriced, 'BR'),
      null,
      'sem MSRP o produto precisa admitir a lacuna em vez de anunciar R$ 0',
    );
  });

  it('o rascunho carrega a ficha técnica, não só o nome', () => {
    const machine = rig('Equilibrado', BALANCED);
    const gpu = machine.components.find((c) => c.component.category === 'GPU')!;
    const draft = buildListingDraft(gpu, 'BR')!;

    assert.match(draft.title, /RTX 4070/i);
    assert.ok(draft.highlights.length >= 3, 'anúncio sem ficha técnica é classificado, não Pecê');
    assert.equal(draft.category, 'GPU');
  });
});

describe('assessAskingPrice — avalia o preço, não autoriza', () => {
  const guidance = {
    suggestedLow: 1000,
    suggestedHigh: 1400,
    quickSale: 920,
    currency: 'BRL',
    note: '',
  };

  it('preço dentro da faixa é lido como justo', () => {
    assert.equal(assessAskingPrice(1200, guidance).fairness, 'in-range');
    assert.equal(assessAskingPrice(1000, guidance).fairness, 'in-range');
    assert.equal(assessAskingPrice(1400, guidance).fairness, 'in-range');
  });

  it('abaixo e acima da faixa são reconhecidos, e o exagero tem nome próprio', () => {
    assert.equal(assessAskingPrice(800, guidance).fairness, 'below-range');
    assert.equal(assessAskingPrice(1500, guidance).fairness, 'above-range');
    assert.equal(assessAskingPrice(2500, guidance).fairness, 'far-above-range');
  });

  it('todo veredito de preço vem com explicação e com a faixa que o gerou', () => {
    for (const price of [800, 1200, 1500, 2500]) {
      const a = assessAskingPrice(price, guidance);
      assert.ok(a.note.length > 20, `preço ${price} veio sem explicação`);
      assert.equal(a.suggestedLow, 1000);
      assert.equal(a.suggestedHigh, 1400);
    }
  });

  it('a distância até o meio da faixa é informada em porcentagem', () => {
    assert.equal(assessAskingPrice(1200, guidance).deltaPercent, 0);
    assert.equal(assessAskingPrice(600, guidance).deltaPercent, -50);
  });
});

describe('priceBands — a tela e o servidor não podem discordar', () => {
  const guidance = {
    suggestedLow: 1000,
    suggestedHigh: 1400,
    quickSale: 920,
    currency: 'BRL',
    note: '',
  };

  /**
   * O app dá retorno enquanto a pessoa digita o preço, e faz isso comparando o número com
   * as faixas que o engine mandou. Se essas faixas discordassem do julgamento do servidor,
   * o usuário veria "na faixa" ao digitar e "acima da faixa" depois de salvar — que é
   * exatamente o tipo de contradição entre tela e engine que este projeto não aceita.
   */
  it('a faixa que o app usa para dar retorno é a mesma que o servidor usa para julgar', () => {
    const bands = priceBands(guidance);
    for (let price = 1; price <= 3000; price += 7) {
      const shown = bands.find((b) => b.to === null || price <= b.to)!;
      assert.equal(
        shown.fairness,
        assessAskingPrice(price, guidance).fairness,
        `preço ${price}: a tela mostraria ${shown.fairness}`,
      );
    }
  });

  it('as faixas cobrem toda a reta de preço, sem buraco entre elas', () => {
    const bands = priceBands(guidance);
    assert.equal(bands[0]!.from, 0);
    assert.equal(bands[bands.length - 1]!.to, null);
    for (let i = 1; i < bands.length; i += 1) {
      assert.equal(bands[i]!.from, bands[i - 1]!.to! + 1, `buraco antes de ${bands[i]!.fairness}`);
    }
  });

  it('cada faixa chega na tela já com rótulo e explicação', () => {
    for (const band of priceBands(guidance)) {
      assert.ok(band.label.length > 0, `${band.fairness} sem rótulo`);
      assert.ok(band.note.length > 20, `${band.fairness} sem explicação`);
    }
  });
});

describe('ciclo de vida do anúncio', () => {
  it('anúncio ativo pode ser reservado, vendido ou retirado', () => {
    assert.ok(canTransition('active', 'reserved'));
    assert.ok(canTransition('active', 'sold'));
    assert.ok(canTransition('active', 'withdrawn'));
  });

  it('venda é terminal — desfazer contaria uma história falsa no PC Evolution', () => {
    assert.equal(canTransition('sold', 'active'), false);
    assert.match(transitionError('sold', 'active')!, /já foi vendida/i);
  });

  it('anúncio retirado pode voltar ao ar', () => {
    assert.ok(canTransition('withdrawn', 'active'));
    assert.equal(transitionError('withdrawn', 'active'), null);
  });

  it('só anúncio aberto aparece para quem procura peça', () => {
    assert.ok(isOpen('active'));
    assert.ok(isOpen('reserved'));
    assert.equal(isOpen('sold'), false);
    assert.equal(isOpen('withdrawn'), false);
  });
});
