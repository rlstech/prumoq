/** União histórica: rascunhos v4 gravados pelo build de 4 etapas continuam
 *  parseáveis. Só 'checklist' e 'review' são navegáveis (ver VerificationFlowStep). */
export type VerificationStep = 'context' | 'checklist' | 'evidence' | 'review';

/** Etapas efetivamente navegáveis no wizard de 2 etapas. */
export type VerificationFlowStep = Extract<VerificationStep, 'checklist' | 'review'>;

/** Reduz qualquer VerificationStep (incluindo legado 'context'/'evidence' de
 *  rascunhos v4 antigos, ou entrada corrompida) para uma etapa navegável.
 *  Nunca retorna algo que não exista mais no wizard — usada em toda leitura
 *  de currentStep vindo de storage para não deixar a tela em branco. */
export function normalizeVerificationStep(step: unknown): VerificationFlowStep {
  return step === 'review' || step === 'evidence' ? 'review' : 'checklist';
}

export type VerificationMode = 'verification' | 'reinspection';
export type VerificationResult = 'conforme' | 'nao_conforme' | 'na';

export interface NcDraftDetail {
  descricao: string;
  solucao_proposta: string;
  data_nova_verif: string;
  responsavel_id: string;
  foto: string | null;
  financeiro?: import('../nc-finance').NcFinancialDeclaration | null;
}

export interface MeasurementAdvanceDraft {
  /** Quantidade executada somente nesta verificação (delta sobre o acumulado). */
  executadoDelta: string;
  /** Quantidade aprovada somente nesta verificação (delta liberado para medição). */
  aprovadoDelta: string;
}

export interface VerificationFormState {
  dataVerif: string;
  selectedEquipeId: string | null;
  itemResults: Record<string, VerificationResult>;
  ncDetails: Record<string, NcDraftDetail>;
  observacoes: string;
  signaturePath: string | null;
  reinspFoto: string | null;
  generalPhotos: string[];
  /** false = verificação simples, sem acompanhamento físico. */
  registrarAvanco: boolean;
  measurementAdvances?: Record<string, MeasurementAdvanceDraft>;
  /**
   * Itens do checklist efetivamente tocados pelo usuário. Não inclui itens
   * pré-preenchidos em modo re-inspeção — só é preenchido via
   * setVerificationItemResult. É o critério canônico para decidir se há
   * progresso significativo que justifique persistir um rascunho.
   */
  userTouchedItemIds: string[];
}

export type DraftMediaKind = 'general' | 'nc' | 'reinspection' | 'signature';

export interface DraftMediaRef {
  id: string;
  kind: DraftMediaKind;
  itemId?: string;
  storageKey: string;
  mimeType: string;
}

export interface DraftMediaSource {
  id: string;
  kind: DraftMediaKind;
  itemId?: string;
  uri: string;
  mimeType: string;
}

export interface VerificationDraftV1 {
  schemaVersion: 4;
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
  updatedAt: string;
  currentStep: VerificationStep;
  state: VerificationFormState;
  media: DraftMediaRef[];
}

export interface DraftStore {
  save(draft: VerificationDraftV1, media: DraftMediaSource[]): Promise<void>;
  load(draftId: string): Promise<VerificationDraftV1 | null>;
  listForUser(userId: string): Promise<VerificationDraftV1[]>;
  delete(draftId: string): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}

export const DRAFT_SCHEMA_VERSION = 4 as const;

export function makeDraftId(userId: string, fvsId: string, mode: VerificationMode): string {
  return `${userId}:${fvsId}:${mode}`;
}

export function sanitizeDraftState(state: VerificationFormState): VerificationFormState {
  return {
    ...state,
    signaturePath: null,
    reinspFoto: null,
    generalPhotos: [],
    userTouchedItemIds: [...state.userTouchedItemIds],
    ncDetails: Object.fromEntries(
      Object.entries(state.ncDetails).map(([itemId, detail]) => [
        itemId,
        { ...detail, foto: null },
      ]),
    ),
  };
}

export function applyHydratedMedia(
  state: VerificationFormState,
  hydrated: { ref: DraftMediaRef; uri: string }[],
): VerificationFormState {
  const next: VerificationFormState = {
    ...state,
    ncDetails: Object.fromEntries(
      Object.entries(state.ncDetails).map(([itemId, detail]) => [itemId, { ...detail }]),
    ),
    generalPhotos: [],
    userTouchedItemIds: [...state.userTouchedItemIds],
  };

  for (const { ref, uri } of hydrated) {
    if (ref.kind === 'general') next.generalPhotos.push(uri);
    if (ref.kind === 'reinspection') next.reinspFoto = uri;
    if (ref.kind === 'signature') next.signaturePath = uri;
    if (ref.kind === 'nc' && ref.itemId && next.ncDetails[ref.itemId]) {
      next.ncDetails[ref.itemId] = { ...next.ncDetails[ref.itemId], foto: uri };
    }
  }

  return next;
}
