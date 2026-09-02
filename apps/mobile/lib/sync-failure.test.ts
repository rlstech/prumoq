import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyUploadFailure } from './sync-failure';

function pg(code: string, message = 'erro') {
  return { code, message };
}

test('RLS recusando a linha é definitivo', () => {
  const result = classifyUploadFailure(pg('42501', 'new row violates row-level security policy'));
  assert.equal(result.permanent, true);
  assert.equal(result.code, '42501');
});

test('violações de integridade e de dado são definitivas', () => {
  for (const code of ['23503', '23502', '23505', '23514', '22P02', '22007']) {
    assert.equal(classifyUploadFailure(pg(code)).permanent, true, code);
  }
});

test('JWT expirado é transitório — o cliente renova', () => {
  assert.equal(classifyUploadFailure(pg('PGRST301')).permanent, false);
});

test('erro de forma da requisição no PostgREST é definitivo', () => {
  assert.equal(classifyUploadFailure(pg('PGRST204')).permanent, true);
});

test('arquivo local sumido não volta por repetição', () => {
  const result = classifyUploadFailure(new Error('Pending media file is unavailable or empty'));
  assert.equal(result.permanent, true);
  assert.equal(result.code, 'MEDIA_MISSING');
});

test('status HTTP no texto separa recusa de indisponibilidade', () => {
  assert.equal(classifyUploadFailure(new Error('Presign failed: 403')).permanent, true);
  assert.equal(classifyUploadFailure(new Error('R2 upload failed: 400')).permanent, true);
  assert.equal(classifyUploadFailure(new Error('Presign failed: 500')).permanent, false);
  assert.equal(classifyUploadFailure(new Error('R2 upload failed: 429')).permanent, false);
  assert.equal(classifyUploadFailure(new Error('Presign failed: 401')).permanent, false);
});

test('falha de rede é transitória', () => {
  assert.equal(classifyUploadFailure(new Error('Network request failed')).permanent, false);
  assert.equal(classifyUploadFailure(new Error('No active Supabase session')).permanent, false);
});

test('erro desconhecido repete, para não perder gravação de campo', () => {
  const result = classifyUploadFailure({ mensagem: 'algo estranho' });
  assert.equal(result.permanent, false);
  assert.equal(result.code, 'UNKNOWN');
});
