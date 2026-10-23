import assert from 'node:assert/strict';
import test from 'node:test';
import { firstErrorItemId, focusPosition, initialFocusId, nextFocusId, previousFocusId } from './focus';

const order = ['a', 'b', 'c', 'd'];

test('o foco começa no primeiro item sem resposta', () => {
  assert.equal(initialFocusId({ order }, { a: 'conforme', b: 'na' }), 'c');
  assert.equal(initialFocusId({ order }, {}), 'a');
});

test('com tudo respondido o foco volta ao primeiro item', () => {
  assert.equal(initialFocusId({ order }, { a: 'conforme', b: 'conforme', c: 'na', d: 'conforme' }), 'a');
});

test('lista vazia não tem foco', () => {
  assert.equal(initialFocusId({ order: [] }, {}), null);
  assert.equal(nextFocusId({ order: [] }, null), null);
});

test('itens travados da reinspeção ficam fora do percurso', () => {
  const items = { order, locked: new Set(['a', 'c']) };
  assert.equal(initialFocusId(items, {}), 'b');
  assert.equal(nextFocusId(items, 'b'), 'd');
  assert.equal(nextFocusId(items, 'd'), null);
  assert.equal(previousFocusId(items, 'd'), 'b');
  assert.equal(previousFocusId(items, 'b'), null);
  assert.deepEqual(focusPosition(items, 'd'), { position: 2, total: 2 });
});

test('próximo e anterior seguem a ordem da tela', () => {
  assert.equal(nextFocusId({ order }, 'a'), 'b');
  assert.equal(nextFocusId({ order }, 'd'), null);
  assert.equal(previousFocusId({ order }, 'a'), null);
  assert.equal(previousFocusId({ order }, 'c'), 'b');
  assert.equal(nextFocusId({ order }, 'x'), 'a');
});

test('o primeiro erro segue a ordem da tela, não a das chaves', () => {
  const errors = { nc_foto_d: 'Foto obrigatória', item_b: 'Classifique o item', equipe: 'Selecione a equipe' };
  assert.equal(firstErrorItemId(order, errors), 'b');
  assert.equal(firstErrorItemId(order, { nc_fin_c: 'Declare' }), 'c');
  assert.equal(firstErrorItemId(order, { equipe: 'x', assinatura: 'y' }), null);
  assert.equal(firstErrorItemId(order, { item_a: undefined }), null);
});
