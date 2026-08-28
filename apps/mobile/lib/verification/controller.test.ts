import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canConcludeFvs,
  clearVerificationItemResult,
  createVerificationDraft,
  emptyVerificationFormState,
  hasMeaningfulVerificationProgress,
  isVerificationComplete,
  isVerificationDraftCompatible,
  mediaSourcesFromVerificationState,
  nextVerificationStep,
  normalizeVerificationStep,
  previousVerificationStep,
  setVerificationItemResult,
  stepForVerificationError,
  verificationStatusFromResults,
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

test('navega pelas duas etapas e não ultrapassa os limites', () => {
  assert.deepEqual(VERIFICATION_STEPS.map(step => step.key), ['checklist', 'review']);
  assert.equal(nextVerificationStep('checklist'), 'review');
  assert.equal(nextVerificationStep('review'), null);
  assert.equal(previousVerificationStep('review'), 'checklist');
  assert.equal(previousVerificationStep('checklist'), null);
  assert.equal(stepForVerificationError('equipe'), 'checklist');
  assert.equal(stepForVerificationError('nc_desc_item-1'), 'checklist');
  assert.equal(stepForVerificationError('reinspFoto'), 'review');
  assert.equal(stepForVerificationError('assinatura'), 'review');
});

test('rascunho v4 legado (4 etapas) é normalizado para o wizard de 2 etapas', () => {
  assert.equal(normalizeVerificationStep('context'), 'checklist');
  assert.equal(normalizeVerificationStep('checklist'), 'checklist');
  assert.equal(normalizeVerificationStep('evidence'), 'review');
  assert.equal(normalizeVerificationStep('review'), 'review');
  // Entrada corrompida ou ausente nunca deve deixar a tela em branco.
  assert.equal(normalizeVerificationStep(undefined), 'checklist');
  assert.equal(normalizeVerificationStep('lixo'), 'checklist');

  // nextVerificationStep/previousVerificationStep também toleram legado.
  assert.equal(nextVerificationStep('context'), 'review');
  assert.equal(previousVerificationStep('evidence'), 'checklist');

  const draft = createVerificationDraft(context, emptyVerificationFormState(), 'evidence');
  assert.equal(draft.currentStep, 'review');
  const draftFromContext = createVerificationDraft(context, emptyVerificationFormState(), 'context');
  assert.equal(draftFromContext.currentStep, 'checklist');
});

test('cria e atualiza itens mantendo painel de NC sincronizado', () => {
  const initial = emptyVerificationFormState('2026-07-23');
  const nc = setVerificationItemResult(initial, 'item-1', 'nao_conforme');
  assert.equal(nc.itemResults['item-1'], 'nao_conforme');
  assert.ok(nc.ncDetails['item-1']);
  const ok = setVerificationItemResult(nc, 'item-1', 'conforme');
  assert.equal(ok.ncDetails['item-1'], undefined);
});

test('limpar a resposta remove item e rascunho de NC, preservando o toque', () => {
  const initial = emptyVerificationFormState('2026-07-23');
  const nc = setVerificationItemResult(initial, 'item-1', 'nao_conforme');
  const other = setVerificationItemResult(nc, 'item-2', 'conforme');

  const cleared = clearVerificationItemResult(other, 'item-1');
  assert.equal(cleared.itemResults['item-1'], undefined);
  assert.equal(cleared.ncDetails['item-1'], undefined);
  // O item vizinho não é afetado.
  assert.equal(cleared.itemResults['item-2'], 'conforme');
  // O toque continua registrado: o rascunho já existe e não deve sumir porque
  // o inspetor voltou atrás em uma resposta.
  assert.ok(cleared.userTouchedItemIds.includes('item-1'));
  assert.equal(hasMeaningfulVerificationProgress(cleared, 'context'), true);
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

test('rascunho só nasce com apontamento real do checklist', () => {
  // Estado vazio: nenhum progresso.
  const empty = emptyVerificationFormState();
  assert.equal(hasMeaningfulVerificationProgress(empty, 'context'), false);

  // Equipe auto-preenchida (sem toque do usuário no checklist) NÃO é progresso.
  const withTeam = { ...empty, selectedEquipeId: 'team-1' };
  assert.equal(hasMeaningfulVerificationProgress(withTeam, 'context'), false);

  // Assinatura + observações + fotos sem apontamento também NÃO são progresso.
  const withExtras = {
    ...empty,
    observacoes: 'texto qualquer',
    signaturePath: 'sig.png',
    reinspFoto: 'reinsp.png',
    generalPhotos: ['a.jpg', 'b.jpg'],
  };
  assert.equal(hasMeaningfulVerificationProgress(withExtras, 'review'), false);

  // Avançar de etapa sem apontar NÃO é progresso.
  assert.equal(hasMeaningfulVerificationProgress(empty, 'checklist'), false);
  assert.equal(hasMeaningfulVerificationProgress(empty, 'review'), false);

  // ItemResults pré-preenchido (re-inspeção) sem userTouchedItemIds NÃO é progresso.
  const preFilled = { ...empty, itemResults: { 'item-1': 'conforme' as const, 'item-2': 'na' as const } };
  assert.equal(hasMeaningfulVerificationProgress(preFilled, 'context'), false);

  // Um único item efetivamente tocado pelo usuário já é progresso.
  const touched = setVerificationItemResult(empty, 'item-1', 'conforme');
  assert.equal(hasMeaningfulVerificationProgress(touched, 'context'), true);

  // NC manual via updateNc (sem setVerificationItemResult) também conta.
  const ncOnly = { ...empty, ncDetails: { 'item-2': { descricao: '', solucao_proposta: '', data_nova_verif: '', responsavel_id: '', foto: null, financeiro: null } } };
  assert.equal(hasMeaningfulVerificationProgress(ncOnly, 'context'), true);

  // setVerificationItemResult acumula o itemId em userTouchedItemIds (dedupe).
  const doubleTouched = setVerificationItemResult(touched, 'item-1', 'na');
  assert.deepEqual(doubleTouched.userTouchedItemIds, ['item-1']);
  const twoItems = setVerificationItemResult(touched, 'item-2', 'nao_conforme');
  assert.deepEqual(twoItems.userTouchedItemIds, ['item-1', 'item-2']);
});

test('conclusão exige todos os itens sem não conformidade', () => {
  const state = { ...emptyVerificationFormState(), itemResults: { a: 'conforme' as const } };
  assert.equal(isVerificationComplete(state, ['a']), true);
  assert.equal(isVerificationComplete(state, []), false);
  assert.equal(isVerificationComplete(state, ['a', 'b']), false);
  assert.equal(isVerificationComplete({ ...state, itemResults: { a: 'nao_conforme' } }, ['a']), false);
  assert.equal(
    canConcludeFvs(state, ['a'], { isReinspection: false, hasUnresolvedNc: false }),
    true,
  );
  assert.equal(
    canConcludeFvs(state, ['a'], { isReinspection: true, hasUnresolvedNc: false }),
    false,
  );
  assert.equal(
    canConcludeFvs(state, ['a'], { isReinspection: false, hasUnresolvedNc: true }),
    false,
  );
});

test('deriva o resultado da verificação a partir do checklist', () => {
  assert.equal(verificationStatusFromResults(['a', 'b'], { a: 'conforme', b: 'na' }), 'conforme');
  assert.equal(verificationStatusFromResults(['a', 'b'], { a: 'conforme', b: 'nao_conforme' }), 'nao_conforme');
});
