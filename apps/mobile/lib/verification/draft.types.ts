export type VerificationStep = 'context' | 'checklist' | 'evidence' | 'review';
export type VerificationMode = 'verification' | 'reinspection';
export type VerificationResult = 'conforme' | 'nao_conforme' | 'na';
export type VerificationConclusion = 'conforme' | 'nao_conforme' | 'em_andamento';

export interface NcDraftDetail {
  descricao: string;
  solucao_proposta: string;
  data_nova_verif: string;
  responsavel_id: string;
  foto: string | null;
}
export interface VerificationFormState {
  dataVerif: string;
  selectedEquipeId: string | null;
  percentExec: number;
  itemResults: Record<string, VerificationResult>;
  ncDetails: Record<string, NcDraftDetail>;
  observacoes: string;
  conclusao: VerificationConclusion | null;
  concluirFvs: boolean;
  signaturePath: string | null;
  reinspFoto: string | null;
  generalPhotos: string[];
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
  schemaVersion: 1;
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

export const DRAFT_SCHEMA_VERSION = 1 as const;

export function makeDraftId(userId: string, fvsId: string, mode: VerificationMode): string {
  return `${userId}:${fvsId}:${mode}`;
}

export function sanitizeDraftState(state: VerificationFormState): VerificationFormState {
  return {
    ...state,
    signaturePath: null,
    reinspFoto: null,
    generalPhotos: [],
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
