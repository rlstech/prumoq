import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearVerificationItemResult,
  createVerificationDraft,
  emptyVerificationFormState,
  hasMeaningfulVerificationProgress,
  isVerificationDraftCompatible,
  mediaSourcesFromVerificationState,
  nextVerificationStep,
  normalizeVerificationStep,
  patchVerificationState,
  previousVerificationStep,
  setVerificationItemResult,
  stepForVerificationError,
  validateVerificationStep,
  VERIFICATION_STEPS,
} from '../lib/verification/controller';
import type { VerificationDraftContext } from '../lib/verification/controller';
import type {
  DraftStore,
  NcDraftDetail,
  VerificationDraftV1,
  VerificationFlowStep,
  VerificationFormState,
  VerificationResult,
  VerificationStep,
} from '../lib/verification/draft.types';
import type { VerificationValidationInput } from '../lib/verification/validation';
import { draftStore as defaultDraftStore } from '../lib/verification/draftStore';

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Maps an NC draft field to the error key `validateVerificationStep` emits for
 * it, so editing a field can retire its own stale error. Keys must match the
 * ones the checklist screen reads (`nc_desc_<id>`, `nc_foto_<id>`, …). */
const NC_ERROR_PREFIX: Record<keyof NcDraftDetail, string> = {
  descricao: 'nc_desc_',
  foto: 'nc_foto_',
  solucao_proposta: 'nc_sol_',
  data_nova_verif: 'nc_data_',
  responsavel_id: 'nc_resp_',
  financeiro: 'nc_fin_',
};

export interface UseVerificationFlowOptions {
  context: VerificationDraftContext | null;
  itemIds: readonly string[];
  openNcItemIds?: readonly string[];
  isReinspection?: boolean;
  initialState?: VerificationFormState;
  initialStep?: VerificationStep;
  store?: DraftStore;
  /** Extra fields used by validation (for example, a custom result policy). */
  validation?: Partial<Omit<VerificationValidationInput, 'itemIds' | 'itemResults' | 'ncDetails' | 'openNcItemIds'>>;
}

export interface VerificationFlowApi {
  state: VerificationFormState;
  currentStep: VerificationFlowStep;
  steps: typeof VERIFICATION_STEPS;
  errors: Record<string, string>;
  draftCandidate: VerificationDraftV1 | null;
  draftConflict: boolean;
  draftChecked: boolean;
  draftStatus: DraftSaveStatus;
  hasMeaningfulProgress: boolean;
  updateState: (patch: Partial<VerificationFormState> | ((state: VerificationFormState) => VerificationFormState)) => void;
  setItemResult: (itemId: string, result: VerificationResult) => void;
  clearItemResult: (itemId: string) => void;
  updateNc: (itemId: string, patch: Partial<NcDraftDetail>) => void;
  getValidationErrors: (step?: VerificationStep) => Record<string, string>;
  validate: (step?: VerificationStep) => Record<string, string>;
  goToStep: (step: VerificationStep) => boolean;
  nextStep: () => boolean;
  previousStep: () => boolean;
  stepForError: (errorKey: string) => VerificationFlowStep;
  persistDraft: () => Promise<void>;
  restoreDraft: () => boolean;
  /** Remove o rascunho do storage sem tocar no state — usado após salvar a verificação. */
  discardDraft: () => Promise<void>;
  /**
   * Remove o rascunho do storage e zera o state — usado pelo botão "Descartar"
   * da tela Nova Verificação. Garante que hasMeaningfulVerificationProgress
   * volte a false e o debounce não regrave o rascunho logo em seguida.
   */
  discardDraftAndReset: () => Promise<void>;
}

/**
 * Presentation-agnostic state machine for the two-step verification flow.
 *
 * Screens only render `state` and call the methods returned here.  The hook
 * owns draft compatibility, debounced persistence and the background flush so
 * a native screen and the PWA cannot drift apart in edge cases.
 */
export function useVerificationFlow(options: UseVerificationFlowOptions): VerificationFlowApi {
  const {
    context,
    itemIds,
    openNcItemIds = [],
    isReinspection = openNcItemIds.length > 0,
    initialState,
    initialStep = 'checklist',
    store = defaultDraftStore,
    validation: validationDefaults,
  } = options;

  const [state, setState] = useState<VerificationFormState>(initialState ?? emptyVerificationFormState());
  const [currentStep, setCurrentStep] = useState<VerificationFlowStep>(normalizeVerificationStep(initialStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftCandidate, setDraftCandidate] = useState<VerificationDraftV1 | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const [draftChecked, setDraftChecked] = useState(!context);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>('idle');
  const contextKey = context?.draftId ?? null;
  const latestRef = useRef({ state, currentStep, context, hasMeaningful: false });
  const loadedContextRef = useRef<string | null>(null);
  const persistInFlightRef = useRef<Promise<void> | null>(null);
  const persistQueuedRef = useRef(false);
  // Guard contra race: enquanto discardDraftAndReset está em andamento, abortar
  // qualquer persistDraft que entre (ex.: timer do debounce já em voo).
  const discardingRef = useRef(false);

  const hasMeaningfulProgress = useMemo(
    () => hasMeaningfulVerificationProgress(state, currentStep),
    [state, currentStep],
  );
  latestRef.current = { state, currentStep, context, hasMeaningful: hasMeaningfulProgress };

  const updateState = useCallback((patch: Partial<VerificationFormState> | ((value: VerificationFormState) => VerificationFormState)) => {
    setState(previous => {
      const resolved = typeof patch === 'function' ? patch(previous) : patch;
      return resolved === previous ? previous : patchVerificationState(previous, resolved);
    });
    setDraftStatus('idle');
  }, []);

  // Errors are only recomputed on validate(), i.e. when the user hits the
  // primary action. Without this, a field stays flagged in red after it has
  // already been answered — worst on the NC form, which has five required
  // fields open at once.
  const clearErrors = useCallback((keys: readonly string[]) => {
    setErrors(previous => {
      const stale = keys.filter(key => key in previous);
      if (stale.length === 0) return previous;
      const next = { ...previous };
      for (const key of stale) delete next[key];
      return next;
    });
  }, []);

  const setItemResult = useCallback((itemId: string, result: VerificationResult) => {
    setState(previous => setVerificationItemResult(previous, itemId, result));
    clearErrors([`item_${itemId}`]);
    setDraftStatus('idle');
  }, [clearErrors]);

  const clearItemResult = useCallback((itemId: string) => {
    setState(previous => clearVerificationItemResult(previous, itemId));
    clearErrors([
      `item_${itemId}`,
      `nc_desc_${itemId}`,
      `nc_foto_${itemId}`,
      `nc_sol_${itemId}`,
      `nc_data_${itemId}`,
      `nc_resp_${itemId}`,
      `nc_fin_${itemId}`,
    ]);
    setDraftStatus('idle');
  }, [clearErrors]);

  const updateNc = useCallback((itemId: string, patch: Partial<NcDraftDetail>) => {
    clearErrors(
      Object.keys(patch)
        .map(field => NC_ERROR_PREFIX[field as keyof NcDraftDetail])
        .filter((prefix): prefix is string => !!prefix)
        .map(prefix => `${prefix}${itemId}`),
    );
    setState(previous => {
      const detail = previous.ncDetails[itemId] ?? {
        descricao: '',
        solucao_proposta: '',
        data_nova_verif: '',
        responsavel_id: '',
        foto: null,
        financeiro: null,
      } satisfies NcDraftDetail;
      return patchVerificationState(previous, { ncDetails: { ...previous.ncDetails, [itemId]: { ...detail, ...patch } } });
    });
    setDraftStatus('idle');
  }, [clearErrors]);

  const validationInput = useCallback((value = latestRef.current.state): VerificationValidationInput => ({
    selectedEquipeId: value.selectedEquipeId,
    isReinspection,
    signaturePath: value.signaturePath,
    reinspectionPhoto: value.reinspFoto,
    itemIds: [...itemIds],
    itemResults: value.itemResults,
    ncDetails: value.ncDetails,
    openNcItemIds: [...openNcItemIds],
    ...validationDefaults,
  }), [isReinspection, itemIds, openNcItemIds, validationDefaults]);

  const validate = useCallback((step?: VerificationStep): Record<string, string> => {
    const nextErrors = validateVerificationStep(validationInput(), step);
    setErrors(nextErrors);
    return nextErrors;
  }, [validationInput]);

  const getValidationErrors = useCallback(
    (step?: VerificationStep): Record<string, string> =>
      validateVerificationStep(validationInput(), step),
    [validationInput],
  );

  const persistDraft = useCallback(async (): Promise<void> => {
    if (discardingRef.current) return;
    const snapshotContext = latestRef.current.context;
    const snapshotState = latestRef.current.state;
    const snapshotStep = latestRef.current.currentStep;
    if (!snapshotContext || !latestRef.current.hasMeaningful) return;
    // Serialize writes. This matters when a field is changed while a photo is
    // being copied to the native document directory.
    if (persistInFlightRef.current) {
      persistQueuedRef.current = true;
      return persistInFlightRef.current;
    }
    const operation = (async () => {
      setDraftStatus('saving');
      try {
        const snapshot = createVerificationDraft(snapshotContext, snapshotState, snapshotStep);
        await store.save(snapshot, mediaSourcesFromVerificationState(snapshotState));
        setDraftStatus('saved');
      } catch (error) {
        // A draft save must never block the field workflow. The next debounce
        // or background transition will retry it.
        console.warn('[VerificationDraft] save error:', error);
        setDraftStatus('error');
      } finally {
        persistInFlightRef.current = null;
        if (persistQueuedRef.current) {
          persistQueuedRef.current = false;
          void persistDraft();
        }
      }
    })();
    persistInFlightRef.current = operation;
    return operation;
  }, [store]);

  // Load once for each FVS/mode. A mismatching revision or item fingerprint
  // is surfaced as a conflict and is never restored automatically.
  useEffect(() => {
    if (!context) {
      loadedContextRef.current = null;
      setDraftChecked(true);
      setDraftCandidate(null);
      setDraftConflict(false);
      return;
    }
    if (loadedContextRef.current === contextKey) return;
    loadedContextRef.current = contextKey;
    let cancelled = false;
    setDraftChecked(false);
    setDraftCandidate(null);
    setDraftConflict(false);
    void store.load(context.draftId).then(draft => {
      if (cancelled) return;
      if (!draft) {
        setDraftChecked(true);
        return;
      }
      setDraftCandidate(draft);
      setDraftConflict(!isVerificationDraftCompatible(draft, context));
      setDraftChecked(true);
    }).catch(error => {
      if (cancelled) return;
      console.warn('[VerificationDraft] load error:', error);
      // Do not overwrite a potentially recoverable draft when loading failed
      // (for example, while IndexedDB is temporarily unavailable).
      setDraftConflict(true);
      setDraftChecked(true);
    });
    return () => { cancelled = true; };
  }, [context, contextKey, store]);

  // Debounce changes so typing in a long checklist remains responsive.
  useEffect(() => {
    if (!draftChecked || draftCandidate || draftConflict || !context || !hasMeaningfulProgress) return;
    const timer = setTimeout(() => { void persistDraft(); }, 500);
    return () => clearTimeout(timer);
  }, [context, draftCandidate, draftChecked, draftConflict, hasMeaningfulProgress, persistDraft, state, currentStep]);

  // Flush the latest state when the app leaves the foreground. On web the
  // React Native AppState shim emits the same transition for tab switches.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && draftChecked && !draftCandidate && !draftConflict && latestRef.current.hasMeaningful) {
        void persistDraft();
      }
    });
    return () => subscription.remove();
  }, [draftCandidate, draftChecked, draftConflict, persistDraft]);

  const goToStep = useCallback((step: VerificationStep): boolean => {
    const target = normalizeVerificationStep(step);
    if (target === currentStep) return true;
    const currentIndex = VERIFICATION_STEPS.findIndex(candidate => candidate.key === currentStep);
    const targetIndex = VERIFICATION_STEPS.findIndex(candidate => candidate.key === target);
    if (targetIndex < 0) return false;
    // Moving forward validates only the current stage. Backward navigation is
    // always allowed so a failed validation can be corrected.
    if (targetIndex > currentIndex && Object.keys(validate(currentStep)).length > 0) return false;
    latestRef.current.currentStep = target;
    setCurrentStep(target);
    setErrors({});
    void persistDraft();
    return true;
  }, [currentStep, persistDraft, validate]);

  const nextStep = useCallback((): boolean => {
    const next = nextVerificationStep(currentStep);
    return next ? goToStep(next) : false;
  }, [currentStep, goToStep]);

  const previousStep = useCallback((): boolean => {
    const previous = previousVerificationStep(currentStep);
    return previous ? goToStep(previous) : false;
  }, [currentStep, goToStep]);

  const restoreDraft = useCallback((): boolean => {
    const candidate = draftCandidate;
    if (!candidate || draftConflict || !context || !isVerificationDraftCompatible(candidate, context)) return false;
    setState(candidate.state);
    // candidate.currentStep pode ser um valor legado ('context'/'evidence')
    // gravado por um build de 4 etapas anterior — normaliza para nunca
    // restaurar num step inexistente (o ponto crítico deste refactor).
    setCurrentStep(normalizeVerificationStep(candidate.currentStep));
    setDraftCandidate(null);
    setDraftConflict(false);
    setDraftStatus('saved');
    setErrors({});
    return true;
  }, [context, draftCandidate, draftConflict]);

  const discardDraft = useCallback(async (): Promise<void> => {
    // Bloqueia o debounce de auto-save de regravar o rascunho logo após
    // excluí-lo. Sem esta guarda, o fluxo de `handleSave` → `discardDraft`
    // deixava um rascunho órfão no storage (carbono em `discardDraftAndReset`).
    discardingRef.current = true;
    if (context) await store.delete(context.draftId);
    setDraftCandidate(null);
    setDraftConflict(false);
    setDraftStatus('idle');
  }, [context, store]);

  const discardDraftAndReset = useCallback(async (): Promise<void> => {
    await discardDraft();
    setState(emptyVerificationFormState());
    setCurrentStep('checklist');
    setErrors({});
    // O componente é desmontado pela navegação logo após este call — não é
    // necessário limpar discardingRef.current.
  }, [discardDraft]);

  return {
    state,
    currentStep,
    steps: VERIFICATION_STEPS,
    errors,
    draftCandidate,
    draftConflict,
    draftChecked,
    draftStatus,
    hasMeaningfulProgress,
    updateState,
    setItemResult,
    clearItemResult,
    updateNc,
    getValidationErrors,
    validate,
    goToStep,
    nextStep,
    previousStep,
    stepForError: stepForVerificationError,
    persistDraft,
    restoreDraft,
    discardDraft,
    discardDraftAndReset,
  };
}
