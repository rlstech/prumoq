import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeFvsProgress } from './fvs-progress';

test('calcula o progresso somente pela quantidade de FVS concluídas', () => {
  const summary = summarizeFvsProgress([
    { status: 'concluida' },
    { status: 'em_andamento' },
    { status: 'pendente' },
    { status: 'concluida' },
  ]);

  assert.deepEqual(summary, {
    total: 4,
    completed: 2,
    percentage: 50,
  });
});

test('ignora qualquer percentual manual legado', () => {
  const legacyRows = [
    { status: 'em_andamento', percentual_exec: 100 },
    { status: 'concluida', percentual_exec: 0 },
  ];
  const summary = summarizeFvsProgress(legacyRows);

  assert.equal(summary.completed, 1);
  assert.equal(summary.percentage, 50);
});

test('preserva estados concluídos legados e retira reaberturas do progresso', () => {
  const summary = summarizeFvsProgress([
    { status: 'conforme' },
    { status: 'concluida_ressalva' },
    { status: 'em_revisao' },
  ]);

  assert.equal(summary.completed, 2);
  assert.ok(Math.abs(summary.percentage - (200 / 3)) < Number.EPSILON * 100);
});

test('retorna zero quando não há FVS planejadas', () => {
  assert.deepEqual(summarizeFvsProgress([]), {
    total: 0,
    completed: 0,
    percentage: 0,
  });
});
