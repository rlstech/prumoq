import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHydratedMedia,
  makeDraftId,
  sanitizeDraftState,
  VerificationFormState,
} from './draft.types';
import { collectVerificationErrors, VerificationValidationInput } from './validation';

function formState(): VerificationFormState {
  return {
    dataVerif: '2026-07-23',
    selectedEquipeId: 'team-1',
    percentExec: 50,
    itemResults: { item1: 'nao_conforme' },
    ncDetails: {
      item1: {
        descricao: 'Trinca identificada',
        solucao_proposta: 'Refazer o acabamento',
        data_nova_verif: '2026-07-30',
        responsavel_id: 'team-1',
        foto: 'blob:nc',
      },
    },
    observacoes: 'Área sinalizada.',
    conclusao: 'nao_conforme',
    concluirFvs: false,
    signaturePath: 'data:image/png;base64,signature',
    reinspFoto: 'blob:reinspection',
    generalPhotos: ['blob:general'],
  };
}

function validationInput(): VerificationValidationInput {
  return {
    selectedEquipeId: 'team-1',
    isReinspection: false,
    conclusion: 'conforme',
    concludeFvs: false,
    signaturePath: 'signature.png',
    reinspectionPhoto: null,
    itemIds: ['item1'],
    itemResults: { item1: 'conforme' },
    ncDetails: {},
    openNcItemIds: [],
  };
}

test('cria uma chave de rascunho isolada por usuário, FVS e modo', () => {
  assert.equal(
    makeDraftId('user-1', 'fvs-9', 'reinspection'),
    'user-1:fvs-9:reinspection',
  );
});

test('remove URIs efêmeras do JSON persistido', () => {
  const sanitized = sanitizeDraftState(formState());
  assert.deepEqual(sanitized.generalPhotos, []);
  assert.equal(sanitized.signaturePath, null);
  assert.equal(sanitized.reinspFoto, null);
  assert.equal(sanitized.ncDetails.item1.foto, null);
  assert.equal(sanitized.ncDetails.item1.descricao, 'Trinca identificada');
});

test('hidrata cada tipo de mídia no campo correto', () => {
  const hydrated = applyHydratedMedia(sanitizeDraftState(formState()), [
    {
      ref: { id: 'general-0', kind: 'general', storageKey: 'g', mimeType: 'image/jpeg' },
      uri: 'blob:general-restored',
    },
    {
      ref: { id: 'nc-item1', kind: 'nc', itemId: 'item1', storageKey: 'n', mimeType: 'image/jpeg' },
      uri: 'blob:nc-restored',
    },
    {
      ref: { id: 'signature', kind: 'signature', storageKey: 's', mimeType: 'image/png' },
      uri: 'blob:signature-restored',
    },
  ]);
  assert.deepEqual(hydrated.generalPhotos, ['blob:general-restored']);
  assert.equal(hydrated.ncDetails.item1.foto, 'blob:nc-restored');
  assert.equal(hydrated.signaturePath, 'blob:signature-restored');
});

test('valida as quatro etapas de forma independente', () => {
  const input = validationInput();
  assert.deepEqual(collectVerificationErrors(input, 'context'), {});
  assert.deepEqual(collectVerificationErrors(input, 'checklist'), {});
  assert.deepEqual(collectVerificationErrors(input, 'evidence'), {});
  assert.deepEqual(collectVerificationErrors(input, 'review'), {});

  assert.equal(
    collectVerificationErrors({ ...input, selectedEquipeId: null }, 'context').equipe,
    'Selecione a equipe executora',
  );
  assert.equal(
    collectVerificationErrors({ ...input, itemResults: {} }, 'checklist').item_item1,
    'Classifique este item',
  );
  assert.equal(
    collectVerificationErrors({ ...input, conclusion: null }, 'evidence').conclusao,
    'Selecione o resultado da verificação',
  );
  assert.equal(
    collectVerificationErrors({ ...input, signaturePath: null }, 'review').assinatura,
    'Assinatura digital obrigatória',
  );
});

test('exige foto e dados completos ao abrir uma nova NC', () => {
  const errors = collectVerificationErrors({
    ...validationInput(),
    itemResults: { item1: 'nao_conforme' },
    ncDetails: {
      item1: {
        descricao: '',
        solucao_proposta: '',
        data_nova_verif: '',
        responsavel_id: '',
        foto: null,
      },
    },
  }, 'checklist');

  assert.equal(errors.nc_desc_item1, 'Descrição obrigatória');
  assert.equal(errors.nc_foto_item1, 'Foto obrigatória');
  assert.equal(errors.nc_sol_item1, 'Solução obrigatória');
  assert.equal(errors.nc_data_item1, 'Data obrigatória');
  assert.equal(errors.nc_resp_item1, 'Responsável obrigatório');
});

test('reinspeção exige evidência fotográfica', () => {
  const errors = collectVerificationErrors({
    ...validationInput(),
    isReinspection: true,
    conclusion: null,
    reinspectionPhoto: null,
  }, 'evidence');
  assert.equal(errors.reinspFoto, 'Foto da re-inspeção obrigatória');
  assert.equal(errors.conclusao, undefined);
});
