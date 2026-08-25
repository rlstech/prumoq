import {
  NcDraftDetail,
  normalizeVerificationStep,
  VerificationResult,
  VerificationStep,
} from './draft.types';
import { validateNcFinancialDeclaration } from '../nc-finance';

export interface VerificationValidationInput {
  selectedEquipeId: string | null;
  isReinspection: boolean;
  signaturePath: string | null;
  reinspectionPhoto: string | null;
  itemIds: string[];
  itemResults: Record<string, VerificationResult>;
  ncDetails: Record<string, NcDraftDetail>;
  openNcItemIds: string[];
  financialRequired?: boolean;
}

export function collectVerificationErrors(
  input: VerificationValidationInput,
  step?: VerificationStep,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const openNcItems = new Set(input.openNcItemIds);
  // Rascunhos v4 legados podem passar 'context'/'evidence' aqui — normaliza
  // para o bloco fundido correto do wizard de 2 etapas.
  const scope = step ? normalizeVerificationStep(step) : undefined;

  if (!scope || scope === 'checklist') {
    if (!input.selectedEquipeId) errors.equipe = 'Selecione a equipe executora';

    for (const itemId of input.itemIds) {
      if (!input.itemResults[itemId]) errors[`item_${itemId}`] = 'Classifique este item';
      if (input.itemResults[itemId] !== 'nao_conforme' || openNcItems.has(itemId)) continue;
      const nc = input.ncDetails[itemId];
      if (!nc?.descricao.trim()) errors[`nc_desc_${itemId}`] = 'Descrição obrigatória';
      if (!nc?.foto) errors[`nc_foto_${itemId}`] = 'Foto obrigatória';
      if (!nc?.solucao_proposta.trim()) errors[`nc_sol_${itemId}`] = 'Solução obrigatória';
      if (!nc?.data_nova_verif) errors[`nc_data_${itemId}`] = 'Data obrigatória';
      if (!nc?.responsavel_id) errors[`nc_resp_${itemId}`] = 'Responsável obrigatório';
      if (input.financialRequired) {
        const financialError = validateNcFinancialDeclaration(nc?.financeiro);
        if (financialError) errors[`nc_fin_${itemId}`] = financialError;
      }
    }
  }

  if (!scope || scope === 'review') {
    if (input.isReinspection && !input.reinspectionPhoto) {
      errors.reinspFoto = 'Foto da re-inspeção obrigatória';
    }
    if (!input.signaturePath) errors.assinatura = 'Assinatura digital obrigatória';
  }

  return errors;
}
