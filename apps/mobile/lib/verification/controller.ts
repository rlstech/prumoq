import {
  DRAFT_SCHEMA_VERSION,
  normalizeVerificationStep,
} from './draft.types';
import type {
  DraftMediaSource,
  NcDraftDetail,
  VerificationDraftV1,
  VerificationFlowStep,
  VerificationFormState,
  VerificationMode,
  VerificationResult,
  VerificationStep,
} from './draft.types';
import { collectVerificationErrors } from './validation';
import type { VerificationValidationInput } from './validation';

export { normalizeVerificationStep };

/**
 * The order is deliberately kept outside the screen.  This makes navigation,
 * validation and deep-linking behave identically on native and on the PWA.
 *
 * Only two steps are navigable. 'context' and 'evidence' remain valid values
 * of VerificationStep purely so that verification drafts saved by the old
 * four-step build (schema v4) keep parsing — see normalizeVerificationStep.
 */
export const VERIFICATION_STEPS: readonly { key: VerificationFlowStep; label: string }[] = [
  { key: 'checklist', label: 'Vistoria' },
  { key: 'review', label: 'Fechamento' },
] as const;

export const verificationStepIndex = (step: VerificationStep): number =>
  VERIFICATION_STEPS.findIndex(candidate => candidate.key === normalizeVerificationStep(step));

export function nextVerificationStep(step: VerificationStep): VerificationFlowStep | null {
  const index = verificationStepIndex(step);
  if (index < 0) return null;
  const next = VERIFICATION_STEPS[index + 1];
  return next?.key ?? null;
}

export function previousVerificationStep(step: VerificationStep): VerificationFlowStep | null {
  const index = verificationStepIndex(step);
  if (index < 0) return null;
  const previous = VERIFICATION_STEPS[index - 1];
  return previous?.key ?? null;
}

export function stepForVerificationError(key: string): VerificationFlowStep {
  if (key === 'assinatura' || key === 'reinspFoto' || key === 'conclusao') return 'review';
  // equipe, item_*, nc_desc_*, nc_foto_*, nc_sol_*, nc_data_*, nc_resp_*, nc_fin_*
  return 'checklist';
}

export function emptyVerificationFormState(today = new Date().toISOString().slice(0, 10)): VerificationFormState {
  return {
    dataVerif: today,
    selectedEquipeId: null,
    itemResults: {},
    ncDetails: {},
    observacoes: '',
    signaturePath: null,
    reinspFoto: null,
    generalPhotos: [],
    registrarAvanco: false,
    measurementAdvances: {},
    userTouchedItemIds: [],
  };
}

/** Keep nested state immutable when it is passed to a component setter. */
export function patchVerificationState(
  state: VerificationFormState,
  patch: Partial<VerificationFormState>,
): VerificationFormState {
  return {
    ...state,
    ...patch,
    itemResults: patch.itemResults ? { ...patch.itemResults } : { ...state.itemResults },
    ncDetails: patch.ncDetails
      ? Object.fromEntries(Object.entries(patch.ncDetails).map(([id, detail]) => [id, { ...detail }]))
      : Object.fromEntries(Object.entries(state.ncDetails).map(([id, detail]) => [id, { ...detail }])),
    generalPhotos: patch.generalPhotos ? [...patch.generalPhotos] : [...state.generalPhotos],
    measurementAdvances: patch.measurementAdvances ? { ...patch.measurementAdvances } : { ...(state.measurementAdvances ?? {}) },
    userTouchedItemIds: patch.userTouchedItemIds ? [...patch.userTouchedItemIds] : [...state.userTouchedItemIds],
  };
}

export function setVerificationItemResult(
  state: VerificationFormState,
  itemId: string,
  result: VerificationResult,
): VerificationFormState {
  const itemResults = { ...state.itemResults, [itemId]: result };
  const ncDetails = { ...state.ncDetails };
  if (result === 'nao_conforme') {
    ncDetails[itemId] = ncDetails[itemId] ?? {
      descricao: '',
      solucao_proposta: '',
      data_nova_verif: '',
      responsavel_id: '',
      foto: null,
      financeiro: null,
    } satisfies NcDraftDetail;
  } else {
    delete ncDetails[itemId];
  }
  const userTouchedItemIds = state.userTouchedItemIds.includes(itemId)
    ? state.userTouchedItemIds
    : [...state.userTouchedItemIds, itemId];
  return { ...state, itemResults, ncDetails, userTouchedItemIds };
}

export function isVerificationDraftCompatible(
  draft: VerificationDraftV1,
  context: Pick<VerificationDraftV1, 'draftId' | 'userId' | 'obraId' | 'ambienteId' | 'fvsId' | 'mode' | 'revision' | 'itemFingerprint'>,
): boolean {
  return draft.schemaVersion === DRAFT_SCHEMA_VERSION
    && draft.draftId === context.draftId
    && draft.userId === context.userId
    && draft.obraId === context.obraId
    && draft.ambienteId === context.ambienteId
    && draft.fvsId === context.fvsId
    && draft.mode === context.mode
    && draft.revision === context.revision
    && draft.itemFingerprint === context.itemFingerprint;
}

export function hasMeaningfulVerificationProgress(
  state: VerificationFormState,
  // Kept for API compatibility — no longer part of the criterion.
  _currentStep: VerificationStep,
): boolean {
  // Rascunho só deve nascer quando o usuário fez ao menos um apontamento real
  // do checklist. Equipe auto-preenchida, data, observações, assinatura e
  // fotos isoladas NÃO contam — caso contrário abrir a tela de Nova
  // Verificação já cria um rascunho vazio na Dashboard. Itens pré-preenchidos
  // em re-inspeção também não contam: só o que o usuário efetivamente tocou
  // (via setVerificationItemResult) aparece em userTouchedItemIds.
  return state.userTouchedItemIds.length > 0
    || Object.keys(state.ncDetails).length > 0;
}

export function mediaSourcesFromVerificationState(state: VerificationFormState): DraftMediaSource[] {
  const media: DraftMediaSource[] = state.generalPhotos.map((uri, index) => ({
    id: `general-${index}`,
    kind: 'general',
    uri,
    mimeType: 'image/jpeg',
  }));
  for (const [itemId, detail] of Object.entries(state.ncDetails)) {
    if (detail.foto) {
      media.push({ id: `nc-${itemId}`, kind: 'nc', itemId, uri: detail.foto, mimeType: 'image/jpeg' });
    }
  }
  if (state.reinspFoto) media.push({ id: 'reinspection', kind: 'reinspection', uri: state.reinspFoto, mimeType: 'image/jpeg' });
  if (state.signaturePath) media.push({ id: 'signature', kind: 'signature', uri: state.signaturePath, mimeType: 'image/png' });
  return media;
}

export interface VerificationDraftContext {
  draftId: string;
  userId: string;
  obraId: string;
  ambienteId: string;
  fvsId: string;
  fvsName: string;
  ambienteName: string;
  mode: VerificationMode;
  revision: number;
  itemFingerprint: string;
}

export function createVerificationDraft(
  context: VerificationDraftContext,
  state: VerificationFormState,
  currentStep: VerificationStep,
  updatedAt = new Date().toISOString(),
): VerificationDraftV1 {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    ...context,
    updatedAt,
    // Normalizado na gravação: cada auto-save migra rascunhos legados
    // ('context'/'evidence') para o wizard de 2 etapas, sem bump de schema.
    currentStep: normalizeVerificationStep(currentStep),
    state,
    // Media is intentionally persisted by DraftStore after copying blobs.
    media: [],
  };
}

export function validateVerificationStep(
  input: VerificationValidationInput,
  step?: VerificationStep,
): Record<string, string> {
  return collectVerificationErrors(input, step);
}

export function isVerificationComplete(
  state: VerificationFormState,
  itemIds: readonly string[],
): boolean {
  const allAnswered = itemIds.length > 0
    && itemIds.every(itemId => !!state.itemResults[itemId]);
  const noNc = itemIds.every(itemId => state.itemResults[itemId] !== 'nao_conforme');
  return allAnswered && noNc;
}

export function canConcludeFvs(
  state: VerificationFormState,
  itemIds: readonly string[],
  options: {
    isReinspection: boolean;
    hasUnresolvedNc: boolean;
  },
): boolean {
  return !options.isReinspection
    && !options.hasUnresolvedNc
    && isVerificationComplete(state, itemIds);
}

export function verificationStatusFromResults(
  itemIds: readonly string[],
  itemResults: Record<string, VerificationResult>,
): 'conforme' | 'nao_conforme' {
  return itemIds.some(itemId => itemResults[itemId] === 'nao_conforme')
    ? 'nao_conforme'
    : 'conforme';
}

export function draftContextFrom(
  draft: VerificationDraftV1,
): VerificationDraftContext {
  return {
    draftId: draft.draftId,
    userId: draft.userId,
    obraId: draft.obraId,
    ambienteId: draft.ambienteId,
    fvsId: draft.fvsId,
    fvsName: draft.fvsName,
    ambienteName: draft.ambienteName,
    mode: draft.mode,
    revision: draft.revision,
    itemFingerprint: draft.itemFingerprint,
  };
}
