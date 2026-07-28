import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterAndSortNcs,
  formatNcDate,
  getNcTiming,
  groupNcs,
  isActionableNc,
  summarizeNcs,
  type NcListItem,
} from './nc-list';

const TODAY = new Date(2026, 6, 27, 15, 30);

function nc(overrides: Partial<NcListItem> = {}): NcListItem {
  return {
    id: 'nc-1',
    descricao: 'Falha no acabamento',
    status: 'aberta',
    data_nova_verif: '2026-07-27',
    prioridade: 'media',
    item_titulo: 'Acabamento da parede',
    ambiente_nome: 'Apartamento 101',
    obra_nome: 'Residencial Horizonte',
    responsavel_nome: 'Equipe Alfa',
    ...overrides,
  };
}

test('classifica prazos sem deslocamento de fuso horário', () => {
  assert.equal(getNcTiming('2026-07-26', TODAY).bucket, 'overdue');
  assert.equal(getNcTiming('2026-07-27', TODAY).bucket, 'today');
  assert.equal(getNcTiming('2026-07-30', TODAY).bucket, 'soon');
  assert.equal(getNcTiming('2026-07-31', TODAY).bucket, 'scheduled');
  assert.equal(getNcTiming(null, TODAY).bucket, 'unscheduled');
  assert.equal(formatNcDate('2026-01-01'), '01/01/2026');
});

test('considera aberta e em correção como estados acionáveis', () => {
  assert.equal(isActionableNc('aberta'), true);
  assert.equal(isActionableNc('em_correcao'), true);
  assert.equal(isActionableNc('resolvida'), false);
  assert.equal(isActionableNc('encerrada_sem_resolucao'), false);
});

test('resume ações críticas e resoluções', () => {
  assert.deepEqual(
    summarizeNcs([
      nc({ id: '1', data_nova_verif: '2026-07-25' }),
      nc({ id: '2', status: 'em_correcao' }),
      nc({ id: '3', status: 'resolvida' }),
    ], TODAY),
    { actionable: 2, overdue: 1, today: 1, resolved: 1 },
  );
});

test('busca ignora acentos e encontra todos os campos operacionais', () => {
  const items = [
    nc({ id: '1', ambiente_nome: 'Área técnica' }),
    nc({ id: '2', ambiente_nome: 'Garagem', item_titulo: 'Piso' }),
  ];
  const result = filterAndSortNcs(items, {
    tab: 'todas',
    search: 'area tecnica',
    urgency: 'all',
    priority: 'all',
  }, TODAY);
  assert.deepEqual(result.map(item => item.id), ['1']);
});

test('combina status, urgência e prioridade', () => {
  const items = [
    nc({ id: '1', data_nova_verif: '2026-07-26', prioridade: 'alta' }),
    nc({ id: '2', data_nova_verif: '2026-07-26', prioridade: 'baixa' }),
    nc({ id: '3', data_nova_verif: '2026-07-26', prioridade: 'alta', status: 'resolvida' }),
  ];
  const result = filterAndSortNcs(items, {
    tab: 'abertas',
    search: '',
    urgency: 'overdue',
    priority: 'alta',
  }, TODAY);
  assert.deepEqual(result.map(item => item.id), ['1']);
});

test('ordena ações por prazo, prioridade e agrupa o histórico por último', () => {
  const sorted = filterAndSortNcs([
    nc({ id: 'future', data_nova_verif: '2026-08-10', prioridade: 'alta' }),
    nc({ id: 'today-low', prioridade: 'baixa' }),
    nc({ id: 'today-high', prioridade: 'alta' }),
    nc({ id: 'resolved', status: 'resolvida' }),
    nc({ id: 'history', status: 'encerrada_sem_resolucao' }),
  ], {
    tab: 'todas',
    search: '',
    urgency: 'all',
    priority: 'all',
  }, TODAY);

  assert.deepEqual(
    sorted.map(item => item.id),
    ['today-high', 'today-low', 'future', 'resolved', 'history'],
  );
  assert.deepEqual(
    groupNcs(sorted, TODAY).map(group => group.key),
    ['today', 'scheduled', 'resolved', 'historical'],
  );
});
