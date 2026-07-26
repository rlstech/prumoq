import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVerificationDraft,
  emptyVerificationFormState,
  hasMeaningfulVerificationProgress,
  isVerificationComplete,
  isVerificationDraftCompatible,
  mediaSourcesFromVerificationState,
  nextVerificationStep,
  previousVerificationStep,
  setVerificationItemResult,
  stepForVerificationError,
  VERIFICATION_STEPS,
} from './controller';

const context = {
  draftId: 'user:fvs:verification',
  userId: 'user',
  obraId: 'obra',
  ambienteId: 'ambiente',
  fvsId: 'fvs',
  fvsName: 'Piso',
  ambienteName: 'Sala',
  mode: 'verification' as const,
  revision: 2,
  itemFingerprint: '2:item-1:Piso acabado',
};

test('navega pelas quatro etapas e não ultrapassa os limites', () => {
  assert.deepEqual(VERIFICATION_STEPS.map(step => step.key), ['context', 'checklist', 'evidence', 'review']);
  assert.equal(nextVerificationStep('context'), 'checklist');
  assert.equal(nextVerificationStep('review'), null);
  assert.equal(previousVerificationStep('review'), 'evidence');
  assert.equal(previousVerificationStep('context'), null);
  assert.equal(stepForVerificationError('equipe'), 'context');
  assert.equal(stepForVerificationError('nc_desc_item-1'), 'checklist');
  assert.equal(stepForVerificationError('assinatura'), 'review');
});

test('cria e atualiza itens mantendo painel de NC sincronizado', () => {
  const initial = emptyVerificationFormState('2026-07-23');
  const nc = setVerificationItemResult(initial, 'item-1', 'nao_conforme');
  assert.equal(nc.itemResults['item-1'], 'nao_conforme');
  assert.ok(nc.ncDetails['item-1']);
  const ok = setVerificationItemResult(nc, 'item-1', 'conforme');
  assert.equal(ok.ncDetails['item-1'], undefined);
});

test('detecta progresso, serializa mídia e verifica compatibilidade de revisão', () => {
  const state = setVerificationItemResult(emptyVerificationFormState(), 'item-1', 'conforme');
  const withSignature = { ...state, signaturePath: 'sig.png', generalPhotos: ['photo.jpg'] };
  assert.equal(hasMeaningfulVerificationProgress(state, 'context'), true);
  const draft = createVerificationDraft(context, withSignature, 'review', '2026-07-23T12:00:00.000Z');
  assert.equal(draft.currentStep, 'review');
  assert.equal(isVerificationDraftCompatible(draft, context), true);
  assert.equal(isVerificationDraftCompatible(draft, { ...context, revision: 3 }), false);
  assert.equal(isVerificationDraftCompatible(draft, { ...context, draftId: 'other-draft' }), false);
  assert.deepEqual(mediaSourcesFromVerificationState(withSignature).map(media => media.kind), ['general', 'signature']);
});

test('conclusão exige todos os itens conforme', () => {
  const state = { ...emptyVerificationFormState(), concluirFvs: true, itemResults: { a: 'conforme' as const } };
  assert.equal(isVerificationComplete(state, ['a']), true);
  assert.equal(isVerificationComplete(state, ['a', 'b']), false);
  assert.equal(isVerificationComplete({ ...state, itemResults: { a: 'nao_conforme' } }, ['a']), false);
});
