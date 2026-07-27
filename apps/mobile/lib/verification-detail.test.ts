import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDateOnly,
  groupByKey,
  isPendingMediaKey,
  resolveStoredMediaUri,
  sortVerificationItems,
  sortVerificationRecords,
  summarizeVerificationItems,
  verificationDetailPath,
} from './verification-detail';

test('resume todos os resultados do checklist', () => {
  assert.deepEqual(
    summarizeVerificationItems([
      { resultado: 'conforme' },
      { resultado: 'nao_conforme' },
      { resultado: 'na' },
      { resultado: 'conforme' },
    ]),
    {
      total: 4,
      conformes: 2,
      naoConformes: 1,
      naoAplicaveis: 1,
    },
  );
});

test('ordena verificações pela data informada e desempata pelo número', () => {
  const sorted = sortVerificationRecords([
    { data_verif: '2026-07-24', numero_verif: 8 },
    { data_verif: '2026-07-25', numero_verif: 9 },
    { data_verif: '2026-07-25', numero_verif: 10 },
  ]);

  assert.deepEqual(sorted.map(item => item.numero_verif), [10, 9, 8]);
});

test('formata datas de domínio sem deslocamento de fuso horário', () => {
  assert.equal(formatDateOnly('2026-01-01'), '01/01/2026');
  assert.equal(formatDateOnly('2026-07-26T23:30:00Z'), '26/07/2026');
});

test('mantém registros da mesma data ligados aos próprios IDs', () => {
  assert.equal(
    verificationDetailPath({
      obraId: 'obra-a',
      ambienteId: 'ambiente-b',
      fvsId: 'fvs-c',
      verificacaoId: 'verificacao-10',
    }),
    '/obras/obra-a/ambiente/ambiente-b/fvs/fvs-c/verificacao/verificacao-10',
  );
  assert.notEqual(
    verificationDetailPath({
      obraId: 'obra-a',
      ambienteId: 'ambiente-b',
      fvsId: 'fvs-c',
      verificacaoId: 'verificacao-10',
    }),
    verificationDetailPath({
      obraId: 'obra-a',
      ambienteId: 'ambiente-b',
      fvsId: 'fvs-c',
      verificacaoId: 'verificacao-9',
    }),
  );
});

test('ordena itens e associa NCs e fotos ao registro correto', () => {
  const items = sortVerificationItems([
    { id: 'item-2', ordem: 2 },
    { id: 'item-1', ordem: 1 },
  ]);
  const ncsByItem = groupByKey([
    { id: 'nc-2', verificacao_item_id: 'item-2' },
    { id: 'nc-1', verificacao_item_id: 'item-1' },
  ], item => item.verificacao_item_id);
  const photosByNc = groupByKey([
    { id: 'foto-1', nc_id: 'nc-1' },
    { id: 'foto-2', nc_id: 'nc-1' },
  ], photo => photo.nc_id);

  assert.deepEqual(items.map(item => item.id), ['item-1', 'item-2']);
  assert.deepEqual(ncsByItem['item-1']?.map(nc => nc.id), ['nc-1']);
  assert.equal(ncsByItem['item-sem-nc'], undefined);
  assert.deepEqual(photosByNc['nc-1']?.map(photo => photo.id), ['foto-1', 'foto-2']);
});

test('trata mídia local pendente e URLs já resolvidas', () => {
  assert.equal(isPendingMediaKey('pending:file:///foto.jpg'), true);
  assert.equal(isPendingMediaKey('fotos/arquivo.jpg'), false);
  assert.equal(resolveStoredMediaUri('pending:file:///foto.jpg'), 'file:///foto.jpg');
  assert.equal(resolveStoredMediaUri('data:image/png;base64,abc'), 'data:image/png;base64,abc');
  assert.equal(
    resolveStoredMediaUri('fotos/arquivo.jpg', 'https://fotos.example.com/'),
    'https://fotos.example.com/fotos/arquivo.jpg',
  );
});

test('registro legado sem itens produz resumo vazio', () => {
  assert.deepEqual(summarizeVerificationItems([]), {
    total: 0,
    conformes: 0,
    naoConformes: 0,
    naoAplicaveis: 0,
  });
});
