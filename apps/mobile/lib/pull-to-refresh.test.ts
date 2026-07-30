import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePullDistance,
  isPullToRefreshEnabled,
  MAX_PULL_DISTANCE,
  PULL_TRIGGER_DISTANCE,
  shouldTriggerRefresh,
} from './pull-to-refresh';

test('aplica resistência, ignora movimento para cima e limita a distância', () => {
  assert.equal(calculatePullDistance(-20), 0);
  assert.equal(calculatePullDistance(100), 50);
  assert.equal(calculatePullDistance(1000), MAX_PULL_DISTANCE);
});

test('dispara somente quando a distância visual alcança o limite', () => {
  assert.equal(shouldTriggerRefresh(PULL_TRIGGER_DISTANCE - 1), false);
  assert.equal(shouldTriggerRefresh(PULL_TRIGGER_DISTANCE), true);
});

test('habilita atualização nas telas autenticadas de consulta', () => {
  assert.equal(isPullToRefreshEnabled(['(app)', '(tabs)']), true);
  assert.equal(isPullToRefreshEnabled(['(app)', '(tabs)', 'obras', '[id]']), true);
  assert.equal(
    isPullToRefreshEnabled([
      '(app)',
      '(tabs)',
      'obras',
      '[id]',
      'ambiente',
      '[ambId]',
      'fvs',
      '[fvsId]',
      'verificacao',
      '[verificacaoId]',
    ]),
    true,
  );
});

test('desabilita atualização em autenticação, impressão e formulários', () => {
  assert.equal(isPullToRefreshEnabled(['(auth)', 'login']), false);
  assert.equal(isPullToRefreshEnabled(['(auth)', 'redefinir-senha']), false);
  assert.equal(isPullToRefreshEnabled(['(app)', 'alterar-senha']), false);
  assert.equal(isPullToRefreshEnabled(['(app)', 'print', '[fvsId]']), false);
  assert.equal(
    isPullToRefreshEnabled([
      '(app)',
      '(tabs)',
      'obras',
      '[id]',
      'ambiente',
      '[ambId]',
      'fvs',
      '[fvsId]',
      'verificacao',
      'nova',
    ]),
    false,
  );
});
