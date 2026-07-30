import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNcLifecycle,
  ncPriorityLabel,
  ncStatusLabel,
  reinspectionResultLabel,
} from './nc-detail';

test('traduz status, prioridade e resultado da reinspeção', () => {
  assert.equal(ncStatusLabel('em_correcao'), 'Em correção');
  assert.equal(ncPriorityLabel('media'), 'Média');
  assert.equal(ncPriorityLabel(null), 'Não informada');
  assert.equal(reinspectionResultLabel('reprovada'), 'Reinspeção reprovada');
});

test('monta o ciclo da NC em ordem cronológica e inclui a resolução', () => {
  const events = buildNcLifecycle(
    {
      created_at: '2026-07-01T10:00:00Z',
      resolvida_em: '2026-07-08T11:00:00Z',
      observacao_resolucao: 'Correção aprovada.',
    },
    [
      {
        id: 'reinspecao-2',
        created_at: '2026-07-06T10:00:00Z',
        resultado: 'aprovada',
        observacao: null,
        inspetor_nome: 'Maria',
        numero_verif: 3,
        foto_url: 'fotos/aprovada.jpg',
        nova_nc_id: null,
      },
      {
        id: 'reinspecao-1',
        created_at: '2026-07-03T10:00:00Z',
        resultado: 'reprovada',
        observacao: 'Correção insuficiente.',
        inspetor_nome: 'João',
        numero_verif: 2,
        foto_url: null,
        nova_nc_id: 'nc-2',
      },
    ],
  );

  assert.deepEqual(events.map(event => event.id), [
    'opened',
    'reinspecao-1',
    'reinspecao-2',
    'resolved',
  ]);
  assert.equal(events[1].tone, 'warning');
  assert.equal(events[1].relatedNcId, 'nc-2');
  assert.equal(events[2].tone, 'success');
});

test('não cria marco de resolução enquanto a NC segue aberta', () => {
  const events = buildNcLifecycle(
    {
      created_at: null,
      resolvida_em: null,
      observacao_resolucao: null,
    },
    [],
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'opened');
});
