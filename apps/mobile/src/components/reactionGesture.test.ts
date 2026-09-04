import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  CANCEL_THRESHOLD_Y,
  NO_SELECTION,
  REACTION_ORDER,
  SLOT_WIDTH,
  indexFromTranslation,
  resolveReaction,
} from './reactionGesture.ts';

describe('gesto de reação — mapeamento do dedo para a reação', () => {
  it('sem deslocar, a primeira reação já está selecionada', () => {
    assert.equal(indexFromTranslation(0, 0), 0);
  });

  it('cada slot deslizado avança uma reação', () => {
    assert.equal(indexFromTranslation(SLOT_WIDTH, 0), 1);
    assert.equal(indexFromTranslation(SLOT_WIDTH * 2, 0), 2);
  });

  it('o ponto médio entre dois itens escolhe o mais próximo', () => {
    assert.equal(indexFromTranslation(SLOT_WIDTH * 0.49, 0), 0);
    assert.equal(indexFromTranslation(SLOT_WIDTH * 0.51, 0), 1);
  });

  it('deslizar além do último item continua no último, não estoura', () => {
    assert.equal(indexFromTranslation(SLOT_WIDTH * 10, 0), REACTION_ORDER.length - 1);
  });

  it('deslizar para a esquerda do primeiro continua no primeiro', () => {
    assert.equal(indexFromTranslation(-SLOT_WIDTH * 5, 0), 0);
  });

  it('arrastar para baixo cancela, mesmo com o X sobre um item válido', () => {
    assert.equal(indexFromTranslation(SLOT_WIDTH, CANCEL_THRESHOLD_Y + 1), NO_SELECTION);
    // Logo abaixo do limite ainda seleciona: o cancelamento precisa ser deliberado.
    assert.equal(indexFromTranslation(SLOT_WIDTH, CANCEL_THRESHOLD_Y - 1), 1);
  });
});

describe('gesto de reação — o que fazer ao soltar', () => {
  it('soltar sobre uma reação nova aplica ela', () => {
    assert.deepEqual(resolveReaction(0, null), { action: 'set', kind: 'LOVE' });
    assert.deepEqual(resolveReaction(2, 'LIKE'), { action: 'set', kind: 'DISLIKE' });
  });

  it('soltar sobre a reação já ativa remove — o mesmo gesto liga e desliga', () => {
    assert.deepEqual(resolveReaction(0, 'LOVE'), { action: 'clear' });
    assert.deepEqual(resolveReaction(1, 'LIKE'), { action: 'clear' });
  });

  it('soltar cancelado não faz nada', () => {
    assert.deepEqual(resolveReaction(NO_SELECTION, 'LOVE'), { action: 'none' });
  });

  it('todas as três reações são alcançáveis pelo gesto', () => {
    const reachable = new Set(
      REACTION_ORDER.map((_, i) => {
        const result = resolveReaction(indexFromTranslation(SLOT_WIDTH * i, 0), null);
        return result.action === 'set' ? result.kind : null;
      }),
    );
    assert.deepEqual([...reachable].sort(), [...REACTION_ORDER].sort());
  });
});
