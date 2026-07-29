import {
  NcDraftDetail,
  VerificationResult,
  VerificationStep,
} from './draft.types';

export interface VerificationValidationInput {
  selectedEquipeId: string | null;
  isReinspection: boolean;
  signaturePath: string | null;
  reinspectionPhoto: string | null;
  itemIds: string[];
  itemResults: Record<string, VerificationResult>;
  ncDetails: Record<string, NcDraftDetail>;
  openNcItemIds: string[];
}

export function collectVerificationErrors(
  input: VerificationValidationInput,
  step?: VerificationStep,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const openNcItems = new Set(input.openNcItemIds);

  if (!step || step === 'context') {
    if (!input.selectedEquipeId) errors.equipe = 'Selecione a equipe executora';
  }

  if (!step || step === 'checklist') {
    for (const itemId of input.itemIds) {
      if (!input.itemResults[itemId]) errors[`item_${itemId}`] = 'Classifique este item';
      if (input.itemResults[itemId] !== 'nao_conforme' || openNcItems.has(itemId)) continue;
      const nc = input.ncDetails[itemId];
      if (!nc?.descricao.trim()) errors[`nc_desc_${itemId}`] = 'Descrição obrigatória';
      if (!nc?.foto) errors[`nc_foto_${itemId}`] = 'Foto obrigatória';
      if (!nc?.solucao_proposta.trim()) errors[`nc_sol_${itemId}`] = 'Solução obrigatória';
      if (!nc?.data_nova_verif) errors[`nc_data_${itemId}`] = 'Data obrigatória';
      if (!nc?.responsavel_id) errors[`nc_resp_${itemId}`] = 'Responsável obrigatório';
    }
  }

  if (!step || step === 'evidence') {
    if (input.isReinspection && !input.reinspectionPhoto) {
      errors.reinspFoto = 'Foto da re-inspeção obrigatória';
    }
  }

  if (!step || step === 'review') {
    if (!input.signaturePath) errors.assinatura = 'Assinatura digital obrigatória';
  }

  return errors;
}
