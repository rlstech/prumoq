import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams } from 'expo-router';
import { goBack } from '../../../../../../../../../../lib/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCheck,
  LockKeyhole,
  Save,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '../../../../../../../../../../components/AppHeader';
import { NCReprovadaPanel } from '../../../../../../../../../../components/NCReprovadaPanel';
import { NCResolvedScreen } from '../../../../../../../../../../components/NCResolvedScreen';
import { SignatureField } from '../../../../../../../../../../components/SignatureField';
import {
  BottomActionBar,
  Button,
  Card,
  DataRow,
  DatumCard,
  EmptyState,
  ErrorBanner,
  ListSurface,
  ModalSheet,
  Stepper,
  Toast,
} from '../../../../../../../../../../components/ui';
import { ChecklistItemRow } from '../../../../../../../../../../components/verification/ChecklistItemRow';
import { EvidenceSection } from '../../../../../../../../../../components/verification/EvidenceSection';
import { ChecklistRouteRail } from '../../../../../../../../../../components/verification/ChecklistRouteRail';
import { MeasurementAdvanceSection } from '../../../../../../../../../../components/verification/MeasurementAdvanceSection';
import { FinancialNcTarget, NcFinancialResolutionSheet } from '../../../../../../../../../../components/verification/NcFinancialResolutionSheet';
import { NcSheet } from '../../../../../../../../../../components/verification/NcSheet';
import { ReviewOutcome } from '../../../../../../../../../../components/verification/ReviewOutcome';
import { SignatureSection } from '../../../../../../../../../../components/verification/SignatureSection';
import {
  SaveOutcome,
  VerificationSaveOutcome,
} from '../../../../../../../../../../components/verification/VerificationSaveOutcome';
import { VerificationContextStrip } from '../../../../../../../../../../components/verification/VerificationContextStrip';
import {
  CountRow,
  EquipeRow,
  FeatureRow,
  FvsRow,
  ItemRow,
  ManagerRow,
  MeasurementLinkRow,
  NcAbertaRow,
  ReinspResult,
  Resultado,
  UltimaVerifItemRow,
  UsuarioRow,
  emptyNcDetail,
  getRoutePriorityId,
  measurementTotal,
} from '../../../../../../../../../../components/verification/types';
import { captureNcPhoto, pickNcPhoto } from '../../../../../../../../../../hooks/useNcPhoto';
import { usePhotoCapture } from '../../../../../../../../../../hooks/usePhotoCapture';
import { useResponsiveLayout } from '../../../../../../../../../../hooks/useResponsiveLayout';
import { useVerificationFlow } from '../../../../../../../../../../hooks/useVerificationFlow';
import {
  Breakpoints,
  Colors,
  FontFamily,
  Radius,
  Spacing,
  Typography,
  ZIndex,
} from '../../../../../../../../../../lib/constants';
import { db } from '../../../../../../../../../../lib/powersync';
import { alertInfo } from '../../../../../../../../../../lib/platform-alert';
import { supabase } from '../../../../../../../../../../lib/supabase';
import {
  makeDraftId,
  VerificationMode,
  VerificationStep,
} from '../../../../../../../../../../lib/verification/draft.types';
import {
  canConcludeFvs,
  verificationStatusFromResults,
} from '../../../../../../../../../../lib/verification/controller';
import { approveReinspecao, createNc, reprovarReinspecao } from '../../../../../../../../../../services/nc.service';
import { resolveNcFinancialImpact } from '../../../../../../../../../../services/nc-finance.service';
import { recordApprovedAdvances } from '../../../../../../../../../../services/measurement.service';
import { uuid } from '../../../../../../../../../../lib/uuid';
import { signatureStore } from '../../../../../../../../../../lib/signature-store';

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NovaVerificacaoScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const { isTablet } = useResponsiveLayout();
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  // Queries
  const {
    data: usuarioRows,
    error: usuarioError,
  } = useQuery<UsuarioRow>(
    userId
      ? `SELECT id, cliente_id, nome, cargo, perfil FROM usuarios WHERE id = ? LIMIT 1`
      : `SELECT 1 WHERE 0`,
    userId ? [userId] : [],
  );
  const usuario = usuarioRows[0];

  const { data: fvsRows } = useQuery<FvsRow>(`
    SELECT id, subservico, revisao_associada, status FROM fvs_planejadas WHERE id = ?
  `, [fvsId]);
  const fvs = fvsRows[0];

  const { data: featureRows } = useQuery<FeatureRow>(`
    SELECT controle_medicoes_efetivo, controle_financeiro_nc_efetivo FROM obras WHERE id = ?
  `, [id]);
  const features = featureRows[0];
  const measurementEnabled = features?.controle_medicoes_efetivo === 1;
  const financialRequired = features?.controle_financeiro_nc_efetivo === 1;

  const { data: managers } = useQuery<ManagerRow>(`
    SELECT id, nome FROM usuarios WHERE perfil IN ('admin','gestor') ORDER BY nome
  `);

  const { data: measurementLinks, isLoading: measurementLinksLoading } = useQuery<MeasurementLinkRow>(`
    SELECT v.id, v.etapa_id, v.equipe_id, e.nome AS equipe_nome, s.nome AS etapa_nome,
           v.escopo_atribuido, c.unidade, COALESCE(s.permite_avanco_parcial, 1) AS permite_avanco_parcial,
           COALESCE((SELECT aa.executado_atual FROM avancos_aprovados_servico aa WHERE aa.vinculacao_id = v.id ORDER BY aa.data_aprovacao DESC LIMIT 1), 0) AS executado_atual,
           COALESCE((SELECT aa.aprovado_atual FROM avancos_aprovados_servico aa WHERE aa.vinculacao_id = v.id ORDER BY aa.data_aprovacao DESC LIMIT 1), 0) AS aprovado_atual
    FROM vinculos_execucao_servico v
    JOIN fvs_medicao_configuracoes c ON c.fvs_planejada_id = v.fvs_planejada_id
    JOIN equipes e ON e.id = v.equipe_id
    LEFT JOIN fvs_medicao_etapas s ON s.id = v.etapa_id
    WHERE v.fvs_planejada_id = ? AND v.status = 'ativo'
    ORDER BY s.ordem
  `, [fvsId]);

  const { data: ambienteRows } = useQuery<{ nome: string }>(`
    SELECT a.nome FROM ambientes a JOIN obras o ON o.id = a.obra_id WHERE a.id = ?
  `, [ambId]);
  const ambienteNome = ambienteRows[0]?.nome ?? '';

  const { data: lastEquipeRows } = useQuery<{ equipe_id: string | null }>(`
    SELECT equipe_id FROM verificacoes WHERE fvs_planejada_id = ? ORDER BY created_at DESC LIMIT 1
  `, [fvsId]);

  const { data: itens } = useQuery<ItemRow>(`
    SELECT fpi.id, fpi.ordem, fpi.titulo, fpi.metodo_verif, fpi.tolerancia
    FROM fvs_padrao_itens fpi
    JOIN fvs_planejadas fp ON fp.fvs_padrao_id = fpi.fvs_padrao_id
      AND fpi.revisao = fp.revisao_associada
    WHERE fp.id = ?
    ORDER BY fpi.ordem
  `, [fvsId]);

  const { data: equipes } = useQuery<EquipeRow>(`
    SELECT e.id, e.nome, e.tipo
    FROM equipes e
    JOIN obra_equipes oe ON oe.equipe_id = e.id
    WHERE oe.obra_id = ? AND e.ativo = 1
    ORDER BY e.nome
  `, [id]);

  const { data: countRows } = useQuery<CountRow>(`
    SELECT COUNT(*) AS count FROM verificacoes WHERE fvs_planejada_id = ?
  `, [fvsId]);
  const proximoNumero = (countRows[0]?.count ?? 0) + 1;

  const { data: conclusionCountRows } = useQuery<CountRow>(`
    SELECT COUNT(*) AS count FROM fvs_conclusoes WHERE fvs_planejada_id = ?
  `, [fvsId]);

  const { data: ncsAbertas } = useQuery<NcAbertaRow>(`
    SELECT nc.id as nc_id, nc.descricao, nc.numero_ocorrencia,
           nc.data_nova_verif, nc.responsavel_id,
           nc.financeiro_requerido, nc.situacao_financeira,
           vi.fvs_padrao_item_id, vi.titulo,
           v.numero_verif, v.data_verif as nc_data_criacao
    FROM nao_conformidades nc
    JOIN verificacao_itens vi ON nc.verificacao_item_id = vi.id
    JOIN verificacoes v ON vi.verificacao_id = v.id
    WHERE v.fvs_planejada_id = ? AND nc.status IN ('aberta','em_correcao')
  `, [fvsId]);

  const { data: ultimaVerifItens } = useQuery<UltimaVerifItemRow>(`
    SELECT vi.fvs_padrao_item_id, vi.resultado
    FROM verificacao_itens vi
    JOIN verificacoes v ON vi.verificacao_id = v.id
    WHERE v.id = (
      SELECT id FROM verificacoes
      WHERE fvs_planejada_id = ?
      ORDER BY numero_verif DESC
      LIMIT 1
    )
  `, [fvsId]);

  const ncAbertoByItemId = useMemo(
    () => Object.fromEntries(ncsAbertas.map(r => [r.fvs_padrao_item_id, r])),
    [ncsAbertas],
  );

  const hasOpenNCs = Object.keys(ncAbertoByItemId).length > 0;

  const sortedItens = useMemo(() => {
    if (!hasOpenNCs) return itens;
    return [...itens].sort((a, b) => {
      const aHasNc = !!ncAbertoByItemId[a.id];
      const bHasNc = !!ncAbertoByItemId[b.id];
      if (aHasNc && !bHasNc) return -1;
      if (!aHasNc && bHasNc) return 1;
      return a.ordem - b.ordem;
    });
  }, [itens, ncAbertoByItemId, hasOpenNCs]);

  // Presentation-only state. Form data, validation and drafts live in
  // useVerificationFlow so native and PWA follow the same state machine.
  const [showSignature, setShowSignature] = useState(false);
  const [showConclusionConfirm, setShowConclusionConfirm] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome>('continue');
  const [isSaving, setIsSaving] = useState(false);
  const [reinspResult, setReinspResult] = useState<ReinspResult>({ type: 'idle' });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [resolvedFinancialNcIds, setResolvedFinancialNcIds] = useState<string[]>([]);
  const [showFinancialResolution, setShowFinancialResolution] = useState(false);
  /** Checklist item whose NC sheet is open, or null. */
  const [ncSheetItemId, setNcSheetItemId] = useState<string | null>(null);

  function showToast(msg: string, type: 'success' | 'error', onDone?: () => void) {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
      onDone?.();
    }, 2200);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setAuthResolved(true);
    }).catch(err => {
      console.warn('[NovaVerificacao] getSession failed', err);
      setAuthResolved(true);
    });
    if (Platform.OS === 'web') {
      supabase.functions.invoke('r2-presign', {
        body: { filename: '_warmup.jpg', mimeType: 'image/jpeg', contentLength: 1 },
      }).catch(() => {});
    }
  }, []);

  const identityReady = !!userId && usuario?.id === userId && !usuarioError;
  const identityUnavailable = authResolved && (!userId || !!usuarioError);
  const mode: VerificationMode = hasOpenNCs ? 'reinspection' : 'verification';
  const itemIds = useMemo(() => itens.map(item => item.id), [itens]);
  const openNcItemIds = useMemo(() => Object.keys(ncAbertoByItemId), [ncAbertoByItemId]);
  const itemFingerprint = useMemo(
    () => `${fvs?.revisao_associada ?? 0}:${itens.map(item => `${item.id}:${item.titulo}`).join('|')}`,
    [fvs?.revisao_associada, itens],
  );
  const draftContext = useMemo(() => {
    if (!userId || !fvs) return null;
    return {
      draftId: makeDraftId(userId, fvsId, mode),
      userId,
      obraId: id,
      ambienteId: ambId,
      fvsId,
      fvsName: fvs.subservico,
      ambienteName: ambienteNome,
      mode,
      revision: fvs.revisao_associada,
      itemFingerprint,
    };
  }, [ambId, ambienteNome, fvs, fvsId, id, itemFingerprint, mode, userId]);

  const flow = useVerificationFlow({
    context: draftContext,
    itemIds,
    openNcItemIds,
    isReinspection: hasOpenNCs,
    validation: { financialRequired },
  });
  const {
    state: {
      dataVerif,
      selectedEquipeId,
      itemResults,
      ncDetails,
      observacoes,
      signaturePath,
      reinspFoto,
      generalPhotos,
      registrarAvanco,
      measurementAdvances,
      userTouchedItemIds,
    },
    currentStep,
    steps: flowSteps,
    errors,
    draftCandidate,
    draftConflict,
    draftStatus,
    hasMeaningfulProgress,
    updateState,
    setItemResult,
    clearItemResult,
    updateNc,
    getValidationErrors,
    validate: validateFlow,
    goToStep,
    nextStep,
    previousStep,
    stepForError,
    restoreDraft,
    discardDraft,
    discardDraftAndReset,
  } = flow;

  // A captured default is kept locally so the verification remains completable
  // offline. It is cloned at save time; this value is only the form preview.
  useEffect(() => {
    if (!userId || signaturePath) return;
    void signatureStore.get(userId).then(path => {
      if (path) updateState({ signaturePath: path });
    }).catch(() => {});
  }, [signaturePath, updateState, userId]);

  const {
    addFromCamera,
    addFromGallery,
    removePhoto,
  } = usePhotoCapture([], {
    photos: generalPhotos,
    onChange: photos => updateState({ generalPhotos: photos }),
  });

  const selectedEquipe = equipes.find(e => e.id === selectedEquipeId) ?? null;
  const currentMeasurementAdvances = measurementAdvances ?? {};
  const selectedMeasurementLinks = measurementLinks.filter(link => link.equipe_id === selectedEquipeId);
  function updateMeasurementAdvance(linkId: string, field: 'executadoDelta' | 'aprovadoDelta', value: string) {
    updateState({ measurementAdvances: {
      ...currentMeasurementAdvances,
      [linkId]: {
        executadoDelta: currentMeasurementAdvances[linkId]?.executadoDelta ?? '',
        aprovadoDelta: currentMeasurementAdvances[linkId]?.aprovadoDelta ?? '',
        [field]: value,
      },
    } });
  }
  const algumNaoConforme = Object.values(itemResults).some(r => r === 'nao_conforme');
  const canManageFinancialImpact = usuario?.perfil === 'admin' || usuario?.perfil === 'gestor';
  const closingNcs = useMemo(
    () => ncsAbertas.filter(nc => {
      const result = itemResults[nc.fvs_padrao_item_id];
      return result === 'conforme' || result === 'nao_conforme';
    }),
    [itemResults, ncsAbertas],
  );
  const pendingFinancialNcs = useMemo(
    () => closingNcs.filter(nc => (
      financialRequired
      && Boolean(nc.financeiro_requerido)
      && nc.situacao_financeira !== 'sem_impacto'
      && nc.situacao_financeira !== 'confirmado'
      && !resolvedFinancialNcIds.includes(nc.nc_id)
    )),
    [closingNcs, financialRequired, resolvedFinancialNcIds],
  );
  const financialResolutionTarget = useMemo<FinancialNcTarget | null>(() => {
    const nc = pendingFinancialNcs[0];
    return nc ? { ncId: nc.nc_id, descricao: nc.descricao } : null;
  }, [pendingFinancialNcs]);
  const canConcludeCurrentFvs = canConcludeFvs(
    {
      dataVerif,
      selectedEquipeId,
      itemResults,
      ncDetails,
      observacoes,
      signaturePath,
      reinspFoto,
      generalPhotos,
      registrarAvanco,
      userTouchedItemIds,
    },
    itemIds,
    {
      isReinspection: hasOpenNCs,
      hasUnresolvedNc: hasOpenNCs,
    },
  );

  useEffect(() => {
    if (canConcludeCurrentFvs) return;
    setSaveOutcome('continue');
    setShowConclusionConfirm(false);
  }, [canConcludeCurrentFvs]);

  // Pré-preenche a equipe: quando o serviço tem medição ativa com equipe
  // executora vinculada (vínculo ativo), a equipe fica fixa — não é possível
  // trocá-la nem visualizar outras equipes. Caso contrário, prioriza a da
  // última verificação. Nunca sobrescreve escolha manual ou rascunho restaurado.
  const linkedTeamIds = useMemo(
    () => [...new Set(measurementLinks.map(link => link.equipe_id))],
    [measurementLinks],
  );
  const equipeLocked = measurementEnabled && linkedTeamIds.length > 0;
  const equipeLockedSingle = equipeLocked && linkedTeamIds.length === 1;
  const lockedTeams = useMemo<EquipeRow[]>(() => {
    const seen = new Set<string>();
    return measurementLinks.flatMap(link => {
      if (seen.has(link.equipe_id)) return [];
      seen.add(link.equipe_id);
      return [{ id: link.equipe_id, nome: link.equipe_nome, tipo: '' }];
    });
  }, [measurementLinks]);
  const pickerEquipes = equipeLocked ? lockedTeams : equipes;
  useEffect(() => {
    if (measurementLinksLoading) return;
    if (equipeLocked) {
      if (linkedTeamIds.length > 0 && !linkedTeamIds.includes(selectedEquipeId ?? '')) {
        updateState({ selectedEquipeId: linkedTeamIds[0] });
      }
      return;
    }
    if (selectedEquipeId !== null) return;
    const equipeId = lastEquipeRows[0]?.equipe_id;
    if (equipeId) {
      updateState({ selectedEquipeId: equipeId });
    }
  }, [equipeLocked, linkedTeamIds, lastEquipeRows, measurementLinksLoading, selectedEquipeId, updateState]);

  // Pré-preenche resultados da última verificação no modo de re-inspeção.
  useEffect(() => {
    if (!hasOpenNCs || !ultimaVerifItens.length) return;
    updateState(previous => {
      const nextResults = { ...previous.itemResults };
      for (const row of ultimaVerifItens) {
        if (nextResults[row.fvs_padrao_item_id] !== undefined) continue;
        const result = row.resultado as Resultado;
        if (result === 'conforme' || result === 'na') {
          nextResults[row.fvs_padrao_item_id] = result;
        }
      }
      return { ...previous, itemResults: nextResults };
    });
  }, [hasOpenNCs, ultimaVerifItens, updateState]);

  async function addNcPhoto(itemId: string) {
    const path = await captureNcPhoto();
    if (path) updateNc(itemId, { foto: path });
  }

  async function chooseNcPhoto(itemId: string) {
    const path = await pickNcPhoto();
    if (path) updateNc(itemId, { foto: path });
  }

  /** Marking an item não conforme opens its NC sheet straight away — the five
   * required fields are the reason the answer was given, so asking for them is
   * not an interruption. Every other answer just collapses the row. */
  function handleItemResult(itemId: string, value: Resultado) {
    setItemResult(itemId, value);
    if (value === 'nao_conforme' && !ncAbertoByItemId[itemId]) {
      setNcSheetItemId(itemId);
    }
  }

  /** The five RN-01 fields. The financial declaration, when required, is folded
   * in through its own validation error rather than restated here. */
  function isNcComplete(itemId: string): boolean {
    const nc = ncDetails[itemId];
    if (!nc) return false;
    const core = !!nc.descricao.trim()
      && !!nc.foto
      && !!nc.solucao_proposta.trim()
      && !!nc.data_nova_verif
      && !!nc.responsavel_id;
    return core && !errors[`nc_fin_${itemId}`];
  }

  function validate(step?: VerificationStep): boolean {
    const errs = validateFlow(step);

    if (Object.keys(errs).length > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      showToast('Revise os campos indicados antes de continuar.', 'error');
      return false;
    }
    return true;
  }

  function changeStep(targetStep: VerificationStep) {
    if (goToStep(targetStep)) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function handleNextStep() {
    if (!validate(currentStep)) return;
    if (nextStep()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function handlePreviousStep() {
    if (previousStep()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  async function handleSave(shouldConclude = false) {
    if (!userId || !usuario || usuario.id !== userId || usuarioError) {
      alertInfo(
        'Identidade indisponível',
        'Não foi possível confirmar o usuário autenticado. Entre novamente no sistema antes de salvar a verificação.',
      );
      return;
    }
    const inspectorId = userId;
    const clienteId = usuario.cliente_id;
    if (!clienteId) {
      alertInfo('Conta sem cliente', 'O usuário não está associado a um ambiente PrumoQ válido.');
      return;
    }

    if (!validate()) return;
    if (pendingFinancialNcs.length > 0) {
      if (canManageFinancialImpact) {
        setShowFinancialResolution(true);
      } else {
        showToast(
          'Esta NC precisa de uma decisão financeira de um administrador ou gestor antes de ser encerrada.',
          'error',
        );
      }
      return;
    }
    if (measurementEnabled && registrarAvanco) {
      for (const link of selectedMeasurementLinks) {
        const draft = currentMeasurementAdvances[link.id];
        const executedDelta = Number(draft?.executadoDelta || 0);
        const approvedDelta = Number(draft?.aprovadoDelta || 0);
        if (executedDelta === 0 && approvedDelta === 0) continue;
        const previousExecuted = Number(link.executado_atual);
        const previousApproved = Number(link.aprovado_atual);
        const scope = Number(link.escopo_atribuido);
        if (![executedDelta, approvedDelta, previousExecuted, previousApproved, scope].every(Number.isFinite)) {
          showToast('Informe valores numéricos válidos para o avanço físico.', 'error');
          return;
        }
        if (executedDelta < 0 || approvedDelta < 0) {
          showToast('O avanço informado não pode ser negativo.', 'error');
          return;
        }
        const executed = previousExecuted + executedDelta;
        const approved = previousApproved + approvedDelta;
        if (approved > executed || executed > scope) {
          showToast('O avanço deve respeitar: aprovado ≤ executado ≤ escopo atribuído.', 'error');
          return;
        }
        if (!link.permite_avanco_parcial && approved !== 0 && approved !== scope) {
          showToast(`A etapa ${link.etapa_nome ?? 'selecionada'} é binária e só pode ser aprovada integralmente.`, 'error');
          return;
        }
      }
    }
    if (shouldConclude && !canConcludeCurrentFvs) {
      alertInfo(
        'Conclusão indisponível',
        'A FVS só pode ser concluída em uma verificação posterior, conforme e sem NC aberta.',
      );
      return;
    }
    setIsSaving(true);

    const verificationStatus = verificationStatusFromResults(itemIds, itemResults);

    const verificacaoId = uuid();
    const now = new Date().toISOString();
    let pendingResult: ReinspResult = { type: 'idle' };

    try {
      await db.execute(`
        INSERT INTO verificacoes
          (id, cliente_id, fvs_planejada_id, numero_verif, inspetor_id, equipe_id, data_verif,
           status, observacoes, created_offline, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        verificacaoId, clienteId, fvsId, proximoNumero,
        inspectorId, selectedEquipeId, dataVerif,
        verificationStatus, observacoes, 1, now,
      ]);

      for (const item of itens) {
        const resultado = itemResults[item.id] ?? 'na';
        const itemVerifId = uuid();
        await db.execute(`
          INSERT INTO verificacao_itens
            (id, cliente_id, verificacao_id, fvs_padrao_item_id, ordem, titulo,
             metodo_verif, tolerancia, resultado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [itemVerifId, clienteId, verificacaoId, item.id, item.ordem,
            item.titulo, item.metodo_verif, item.tolerancia, resultado]);

        const ncAberta = ncAbertoByItemId[item.id];
        if (ncAberta) {
          const fotoUrl = reinspFoto ? `pending:${reinspFoto}` : null;
          if (resultado === 'conforme') {
            await approveReinspecao({ clienteId, ncId: ncAberta.nc_id, verificacaoId, inspetorId: inspectorId, fotoUrl });
            if (pendingResult.type === 'idle') {
              pendingResult = {
                type: 'aprovada',
                itemTitle: item.titulo,
                abertoEm: ncAberta.nc_data_criacao,
                resolvidoEm: now.slice(0, 10),
                responsavelNome: equipes.find(e => e.id === ncAberta.responsavel_id)?.nome ?? null,
                fotoUri: reinspFoto ?? null,
              };
            }
          } else if (resultado === 'nao_conforme') {
            const { proximaOcorrencia } = await reprovarReinspecao({
              clienteId,
              ncId: ncAberta.nc_id,
              numeroOcorrenciaAtual: ncAberta.numero_ocorrencia,
              verificacaoId,
              inspetorId: inspectorId,
              fotoUrl,
            });
            if (pendingResult.type === 'idle') {
              pendingResult = {
                type: 'reprovada',
                ocorrencia: proximaOcorrencia,
                ncAnteriorId: ncAberta.nc_id,
                ncAnteriorDescricao: ncAberta.descricao,
                ncAnteriorVerifNum: ncAberta.numero_verif,
                ncAnteriorDataCriacao: ncAberta.nc_data_criacao,
                verificacaoId,
                verificacaoItemId: itemVerifId,
              };
            }
          }
        } else if (resultado === 'nao_conforme') {
          const nc = ncDetails[item.id];
          if (nc) {
            await createNc({
              clienteId,
              verificacaoId,
              verificacaoItemId: itemVerifId,
              descricao: nc.descricao,
              solucao_proposta: nc.solucao_proposta,
              responsavel_id: nc.responsavel_id || null,
              data_nova_verif: nc.data_nova_verif,
              foto_local_path: nc.foto,
              financeiro: financialRequired ? nc.financeiro ?? null : null,
            });
          }
        }
      }

      if (measurementEnabled && registrarAvanco) {
        await recordApprovedAdvances(selectedMeasurementLinks.map(link => {
          const draft = currentMeasurementAdvances[link.id];
          return {
            clienteId,
            verificacaoId,
            vinculoId: link.id,
            etapaId: link.etapa_id,
            executadoAnterior: link.executado_atual,
            executadoAtual: String(measurementTotal(link.executado_atual, draft?.executadoDelta ?? '')),
            aprovadoAnterior: link.aprovado_atual,
            aprovadoAtual: String(measurementTotal(link.aprovado_atual, draft?.aprovadoDelta ?? '')),
            unidade: link.unidade,
            aprovadoPor: inspectorId,
          };
        }));
      }

      const verificationSignature = await signatureStore.snapshot(inspectorId, verificacaoId);
      if (!verificationSignature) throw new Error('Cadastre sua assinatura padrão no Perfil antes de concluir.');

      await Promise.all([
        ...generalPhotos.map((localPath, i) =>
          db.execute(`
            INSERT INTO verificacao_fotos
              (id, cliente_id, verificacao_id, r2_key, nome_arquivo, mime_type, ordem)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [uuid(), clienteId, verificacaoId, `pending:${localPath}`, localPath.split('/').pop() ?? 'photo.jpg', 'image/jpeg', i])
        ),
        db.execute(
          `UPDATE verificacoes SET assinatura_url = ?, assinada_em = ? WHERE id = ?`,
          [`pending:${verificationSignature.uri}`, now, verificacaoId]
        ),
      ]);

      if (Platform.OS !== 'web' && !shouldConclude && fvs?.status !== 'em_revisao') {
        await db.execute(
          `UPDATE fvs_planejadas
           SET status = ?, concluida_em = ?
           WHERE id = ?`,
          ['em_andamento', null, fvsId],
        );
      }

      if (shouldConclude) {
        const conclusionNumber = (conclusionCountRows[0]?.count ?? 0) + 1;
        const conclusionId = uuid();
        const conclusionSignature = await signatureStore.snapshot(inspectorId, conclusionId);
        if (!conclusionSignature) throw new Error('A assinatura padrão não está disponível neste dispositivo.');
        await db.execute(
          `INSERT INTO fvs_conclusoes
            (id, cliente_id, fvs_planejada_id, verificacao_id, inspetor_id, numero_conclusao,
             percentual_final, resultado, observacao_final, assinatura_url, assinada_em, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            conclusionId, clienteId, fvsId, verificacaoId, inspectorId, conclusionNumber,
            100, 'aprovado', observacoes || null, `pending:${conclusionSignature.uri}`, now, now,
          ],
        );

        if (Platform.OS !== 'web') {
          await db.execute(
            `UPDATE fvs_planejadas
             SET status = ?, concluida_em = ?, ultima_conclusao_em = ?
             WHERE id = ?`,
            ['concluida', now, now, fvsId],
          );
        }
      }

      if (draftContext) {
        try { await discardDraft(); } catch { /* saved record takes precedence */ }
      }

      if (pendingResult.type !== 'idle') {
        setReinspResult(pendingResult);
      } else {
        showToast(
          shouldConclude
            ? 'Verificação salva. A FVS foi concluída.'
            : hasOpenNCs
              ? 'Reinspeção salva com sucesso.'
              : 'Verificação salva. A FVS permanece aberta.',
          'success',
          () => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`),
        );
      }
    } catch (err) {
      console.error('[NovaVerificacao] save error:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleConclude() {
    if (!validate()) return;
    setShowConclusionConfirm(true);
  }

  async function handleFinancialResolution(
    target: FinancialNcTarget,
    declaration: Parameters<typeof resolveNcFinancialImpact>[1],
  ) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('A decisão financeira precisa de conexão. O rascunho da reinspeção foi preservado.');
    }
    const nativeConnection = (db as unknown as { currentStatus?: { connected?: boolean } }).currentStatus?.connected;
    if (Platform.OS !== 'web' && nativeConnection === false) {
      throw new Error('A decisão financeira precisa de conexão. O rascunho da reinspeção foi preservado.');
    }
    await resolveNcFinancialImpact(target.ncId, declaration);
    setResolvedFinancialNcIds(previous => [...previous, target.ncId]);
    setShowFinancialResolution(false);
    showToast(
      pendingFinancialNcs.length > 1
        ? 'Impacto financeiro resolvido. Conclua a decisão das demais NCs antes de salvar.'
        : 'Impacto financeiro resolvido. Agora você pode salvar a reinspeção.',
      'success',
    );
  }

  const conformCount = Object.values(itemResults).filter(result => result === 'conforme').length;
  const ncCount = Object.values(itemResults).filter(result => result === 'nao_conforme').length;
  const naCount = Object.values(itemResults).filter(result => result === 'na').length;
  const routePriorityId = getRoutePriorityId(sortedItens, itemResults, ncsAbertas);
  const reviewErrors = getValidationErrors();
  const draftHelper = {
    idle: hasMeaningfulProgress ? 'Rascunho local ativo' : 'O rascunho começa ao preencher',
    saving: 'Salvando rascunho…',
    saved: 'Rascunho salvo neste dispositivo',
    error: 'Não foi possível atualizar o rascunho',
  }[draftStatus];
  // Guard: FVS concluída bloqueia nova verificação (RN-FVS-01)
  if (fvs && (fvs.status === 'conforme' || fvs.status === 'concluida' || fvs.status === 'concluida_ressalva')) {
    return (
      <SafeAreaView style={st.safe}>
        <AppHeader
          title="Nova Verificação"
          subtitle={[ambienteNome, fvs.subservico].filter(Boolean).join(' · ')}
          showBack
          onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
        />
        <View style={st.lockedScreen}>
          <View style={st.lockedIcon}>
            <LockKeyhole size={28} color={Colors.brand} />
          </View>
          <Text style={st.lockedTitle}>
            Verificação bloqueada
          </Text>
          <Text style={st.lockedDescription}>
            Este serviço está concluído.{'\n'}Para registrar uma nova verificação, solicite a reabertura no histórico da FVS.
          </Text>
          <Button
            label="Voltar ao histórico"
            Icon={ArrowLeft}
            onPress={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <AppHeader
        title={hasOpenNCs ? 'Reinspeção de serviço' : 'Nova verificação'}
        subtitle={[
          ambienteNome,
          hasOpenNCs ? `Reinspeção #${proximoNumero}` : `Verificação #${proximoNumero}`,
          fvs?.subservico,
        ].filter(Boolean).join(' · ')}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      <Stepper steps={flowSteps} current={currentStep} />

      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.flowContent}
        >
          {identityUnavailable ? (
            <ErrorBanner message="Não foi possível confirmar o usuário autenticado. Entre novamente no sistema antes de salvar." />
          ) : null}

          {draftCandidate ? (
            <Card tone={draftConflict ? 'danger' : 'accent'} style={st.draftBanner}>
              <View style={st.draftBannerHeader}>
                {draftConflict
                  ? <AlertCircle size={22} color={Colors.nok} />
                  : <Save size={22} color={Colors.brand} />
                }
                <View style={st.draftBannerCopy}>
                  <Text style={st.draftBannerTitle}>
                    {draftConflict ? 'Rascunho incompatível' : 'Rascunho encontrado'}
                  </Text>
                  <Text style={st.draftBannerText}>
                    {draftConflict
                      ? 'A revisão ou os itens desta FVS mudaram. Descarte o rascunho antigo para continuar com segurança.'
                      : `Última atualização em ${new Date(draftCandidate.updatedAt).toLocaleString('pt-BR')}.`
                    }
                  </Text>
                </View>
              </View>
              <View style={st.draftBannerActions}>
                <Button
                  label="Descartar"
                  onPress={() => {
                    void (async () => {
                      try {
                        await discardDraftAndReset();
                      } finally {
                        goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`);
                      }
                    })();
                  }}
                  variant="ghost"
                />
                {!draftConflict ? <Button label="Continuar rascunho" onPress={restoreDraft} /> : null}
              </View>
            </Card>
          ) : null}

          <View style={[st.flowColumns, isTablet && st.flowColumnsTablet]}>
            <View style={st.flowMain}>
              {currentStep === 'checklist' ? (
                <View style={[st.checklistWorkspace, isTablet && st.checklistWorkspaceTablet]}>
                  {isTablet ? (
                    <ChecklistRouteRail
                      items={sortedItens}
                      itemResults={itemResults}
                      openNcs={ncsAbertas}
                      mode="rail"
                    />
                  ) : null}
                  <View style={st.checklistContent}>
                  <VerificationContextStrip
                    inspectorName={usuario?.nome ?? 'Inspetor'}
                    dataVerif={dataVerif}
                    onDataVerifChange={value => updateState({ dataVerif: value })}
                    pickerEquipes={pickerEquipes}
                    selectedEquipe={selectedEquipe}
                    onSelectEquipe={equipeId => updateState({ selectedEquipeId: equipeId })}
                    equipeLockedSingle={equipeLockedSingle}
                    equipeLocked={equipeLocked}
                    equipeError={errors.equipe}
                  />

                  {!isTablet ? (
                    <ChecklistRouteRail
                      items={sortedItens}
                      itemResults={itemResults}
                      openNcs={ncsAbertas}
                      mode="compact"
                    />
                  ) : null}

                  {sortedItens.length === 0 ? (
                    <EmptyState
                      Icon={ClipboardCheck}
                      title="Esta revisão da FVS não tem itens"
                      description="Peça ao gestor para publicar uma revisão com itens antes de inspecionar."
                    />
                  ) : (
                    <ListSurface>
                      {sortedItens.map((item, index) => {
                        const result = itemResults[item.id];
                        const openNc = ncAbertoByItemId[item.id];
                        const isNcItem = !!openNc;
                        const isLocked = hasOpenNCs && !isNcItem;
                        return (
                          <ChecklistItemRow
                            key={item.id}
                            item={item}
                            result={result}
                            onResultChange={value => handleItemResult(item.id, value)}
                            locked={isLocked}
                            isNcItem={isNcItem}
                            isPriority={item.id === routePriorityId}
                            itemError={errors[`item_${item.id}`]}
                            last={index === sortedItens.length - 1}
                            onOpenNc={() => setNcSheetItemId(item.id)}
                            ncComplete={isNcComplete(item.id)}
                            ncError={errors[`nc_desc_${item.id}`] ? 'Complete o registro da não conformidade' : undefined}
                          />
                        );
                      })}
                    </ListSurface>
                  )}
                  </View>
                </View>
              ) : (
                <>
                  {hasOpenNCs ? (
                    <DatumCard tone="info" style={st.reinspectionClosure}>
                      <Text style={st.reinspectionClosureTitle}>Fechamento da reinspeção</Text>
                      <Text style={st.reinspectionClosureText}>
                        Adicione a nova evidência, confira o resultado e assine para registrar a decisão no histórico da NC.
                      </Text>
                      <View style={st.reinspectionStages}>
                        <Text style={st.reinspectionStage}>1 · Evidência</Text>
                        <Text style={st.reinspectionStage}>2 · Resultado</Text>
                        <Text style={st.reinspectionStage}>3 · Assinatura</Text>
                      </View>
                    </DatumCard>
                  ) : null}

                  <EvidenceSection
                    isReinspection={hasOpenNCs}
                    reinspFoto={reinspFoto}
                    onCaptureReinsp={() => {
                      void (async () => {
                        const path = await captureNcPhoto();
                        if (path) updateState({ reinspFoto: path });
                      })();
                    }}
                    reinspError={errors.reinspFoto}
                    photos={generalPhotos}
                    onAddCamera={() => { void addFromCamera(); }}
                    onAddGallery={() => { void addFromGallery(); }}
                    onRemovePhoto={removePhoto}
                    observacoes={observacoes}
                    onObservacoesChange={value => updateState({ observacoes: value })}
                  />

                  <ReviewOutcome
                    conformCount={conformCount}
                    ncCount={ncCount}
                    naCount={naCount}
                    hasNonConformity={algumNaoConforme}
                    errors={reviewErrors}
                    onFixError={key => changeStep(stepForError(key))}
                  />

                  <MeasurementAdvanceSection
                    enabled={measurementEnabled && measurementLinks.length > 0}
                    links={selectedMeasurementLinks}
                    values={currentMeasurementAdvances}
                    onChange={updateMeasurementAdvance}
                    registrarAvanco={registrarAvanco}
                    onRegistrarAvancoChange={value => updateState({ registrarAvanco: value })}
                    fallbackName={fvs?.subservico}
                  />

                  <SignatureSection
                    signerName={usuario?.nome ?? '—'}
                    signaturePath={signaturePath}
                    standard
                    error={errors.assinatura}
                    onSign={path => updateState({ signaturePath: path })}
                    onRefazer={() => {
                      updateState({ signaturePath: null });
                      if (Platform.OS !== 'web') setShowSignature(true);
                    }}
                    onOpenModal={() => setShowSignature(true)}
                  />

                  {pendingFinancialNcs.length > 0 ? (
                    <DatumCard tone="warning" style={st.financialBlocker}>
                      <Text style={st.financialBlockerTitle}>Decisão financeira pendente</Text>
                      <Text style={st.financialBlockerText}>
                        {canManageFinancialImpact
                          ? 'Conclua o impacto financeiro antes de salvar esta reinspeção e encerrar a NC.'
                          : 'Um administrador ou gestor precisa concluir o impacto financeiro no painel antes que esta NC possa ser encerrada.'}
                      </Text>
                      {canManageFinancialImpact ? (
                        <Button
                          label="Resolver impacto financeiro"
                          variant="secondary"
                          onPress={() => setShowFinancialResolution(true)}
                          disabled={isSaving}
                        />
                      ) : null}
                    </DatumCard>
                  ) : null}

                  {canConcludeCurrentFvs ? (
                    <VerificationSaveOutcome
                      value={saveOutcome}
                      onChange={setSaveOutcome}
                      disabled={isSaving || !!toast || !!draftCandidate || !identityReady}
                    />
                  ) : null}
                </>
              )}
            </View>

            {isTablet ? (
              <View style={st.summaryRail}>
                <Card style={st.summaryCard}>
                  <Text style={st.summaryHeading}>Resumo</Text>
                  <View style={st.summaryDivider} />
                  <DataRow label="Equipe" value={selectedEquipe?.nome ?? 'Pendente'} align="stack" style={st.summaryRow} />
                  <DataRow label="Resultado" value={algumNaoConforme ? 'Não conforme' : 'Conforme'} align="stack" style={st.summaryRow} />
                  <DataRow label="NCs" value={`${ncCount}`} align="stack" last style={st.summaryRow} />
                  <View style={st.summaryDivider} />
                  <Text style={[st.draftStatus, draftStatus === 'error' && st.draftStatusError]}>
                    {draftHelper}
                  </Text>
                </Card>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionBar
        primaryLabel={
          currentStep === 'review'
            ? (hasOpenNCs
              ? 'Salvar reinspeção'
              : canConcludeCurrentFvs
                ? (saveOutcome === 'conclude' ? 'Salvar e concluir FVS' : 'Salvar e continuar')
                : 'Salvar verificação')
            : 'Continuar'
        }
        onPrimary={
          currentStep === 'review'
            ? (saveOutcome === 'conclude' && canConcludeCurrentFvs
              ? handleConclude
              : () => { void handleSave(false); })
            : handleNextStep
        }
        primaryLoading={currentStep === 'review' && isSaving}
        primaryDisabled={
          !!toast
          || !!draftCandidate
          || (currentStep === 'review' && !identityReady)
          || (currentStep === 'review' && pendingFinancialNcs.length > 0 && !canManageFinancialImpact)
        }
        secondaryLabel={currentStep !== 'checklist' ? 'Voltar' : undefined}
        onSecondary={currentStep !== 'checklist' ? handlePreviousStep : undefined}
        helper={!isTablet
          ? (currentStep === 'review'
            ? (hasOpenNCs
              ? draftHelper
              : canConcludeCurrentFvs
                ? undefined
                : 'A FVS permanecerá aberta para acompanhamento das NCs.')
            : draftHelper)
          : undefined}
      />

      <ModalSheet
        visible={showConclusionConfirm}
        onClose={() => setShowConclusionConfirm(false)}
        title="Concluir FVS?"
        actions={(
          <>
            <Button
              label="Salvar e concluir FVS"
              Icon={LockKeyhole}
              fullWidth
              loading={isSaving}
              disabled={!!toast || !!draftCandidate || !identityReady}
              onPress={() => {
                setShowConclusionConfirm(false);
                void handleSave(true);
              }}
            />
            <Button
              label="Continuar acompanhando"
              variant="secondary"
              fullWidth
              disabled={isSaving}
              onPress={() => {
                setSaveOutcome('continue');
                setShowConclusionConfirm(false);
              }}
            />
          </>
        )}
      >
        <Text style={st.conclusionModalText}>
          Esta verificação será salva e a FVS ficará bloqueada para novas verificações. Para registrar outra, será necessário reabrir a FVS com justificativa.
        </Text>
      </ModalSheet>

      <NcSheet
        visible={!!ncSheetItemId}
        onClose={() => setNcSheetItemId(null)}
        item={sortedItens.find(item => item.id === ncSheetItemId) ?? null}
        detail={ncDetails[ncSheetItemId ?? ''] ?? emptyNcDetail}
        onChange={patch => { if (ncSheetItemId) updateNc(ncSheetItemId, patch); }}
        onAddPhoto={() => { if (ncSheetItemId) void addNcPhoto(ncSheetItemId); }}
        onPickPhoto={() => { if (ncSheetItemId) void chooseNcPhoto(ncSheetItemId); }}
        onClearResult={() => {
          if (ncSheetItemId) clearItemResult(ncSheetItemId);
          setNcSheetItemId(null);
        }}
        equipes={equipes}
        errors={{
          descricao: errors[`nc_desc_${ncSheetItemId}`],
          foto: errors[`nc_foto_${ncSheetItemId}`],
          solucao: errors[`nc_sol_${ncSheetItemId}`],
          data: errors[`nc_data_${ncSheetItemId}`],
          responsavel: errors[`nc_resp_${ncSheetItemId}`],
          financeiro: errors[`nc_fin_${ncSheetItemId}`],
        }}
        financialRequired={financialRequired}
        managers={managers}
      />

      <NcFinancialResolutionSheet
        visible={showFinancialResolution}
        target={financialResolutionTarget}
        onClose={() => setShowFinancialResolution(false)}
        onResolve={handleFinancialResolution}
      />

      {/* Modal de assinatura — apenas nativo */}
      {Platform.OS !== 'web' && (
        <SignatureField
          visible={showSignature}
          onSign={path => {
            updateState({ signaturePath: path });
            setShowSignature(false);
          }}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {/* Re-inspeção aprovada */}
      <NCResolvedScreen
        visible={reinspResult.type === 'aprovada'}
        itemTitle={reinspResult.type === 'aprovada' ? reinspResult.itemTitle : ''}
        abertoEm={reinspResult.type === 'aprovada' ? reinspResult.abertoEm : null}
        resolvidoEm={reinspResult.type === 'aprovada' ? reinspResult.resolvidoEm : ''}
        responsavelNome={reinspResult.type === 'aprovada' ? reinspResult.responsavelNome : null}
        fotoUri={reinspResult.type === 'aprovada' ? reinspResult.fotoUri : null}
        onConcluir={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      {/* Re-inspeção reprovada */}
      <NCReprovadaPanel
        clienteId={usuario?.cliente_id ?? ''}
        visible={reinspResult.type === 'reprovada'}
        ocorrencia={reinspResult.type === 'reprovada' ? reinspResult.ocorrencia : 0}
        ncAnteriorId={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorId : ''}
        ncAnteriorDescricao={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorDescricao : ''}
        ncAnteriorVerifNum={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorVerifNum : 0}
        ncAnteriorDataCriacao={reinspResult.type === 'reprovada' ? reinspResult.ncAnteriorDataCriacao : ''}
        verificacaoId={reinspResult.type === 'reprovada' ? reinspResult.verificacaoId : ''}
        verificacaoItemId={reinspResult.type === 'reprovada' ? reinspResult.verificacaoItemId : ''}
        equipes={equipes}
        financialRequired={financialRequired}
        managers={managers}
        onSalvo={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}`)}
      />

      {/* Toast feedback */}
      {toast ? (
        <View style={st.toastWrap}>
          <Toast
            message={toast.msg}
            tone={toast.type === 'success' ? 'success' : 'danger'}
            onDismiss={() => setToast(null)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Colors.bg },
  lockedScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  lockedIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { ...Typography.heading, color: Colors.text, textAlign: 'center' },
  lockedDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 460,
  },
  flowContent: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  flowColumns: { width: '100%', gap: Spacing.xxl },
  flowColumnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  flowMain: { flex: 1, maxWidth: Breakpoints.maxForm, gap: Spacing.lg },
  checklistWorkspace: { gap: Spacing.lg },
  checklistWorkspaceTablet: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xxl },
  checklistContent: { flex: 1, minWidth: 0, gap: Spacing.lg },
  draftBanner: { gap: Spacing.md },
  draftBannerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  draftBannerCopy: { flex: 1, gap: 3 },
  draftBannerTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  draftBannerText: { ...Typography.caption, color: Colors.textSecondary },
  draftBannerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  reinspectionClosure: { gap: Spacing.sm },
  reinspectionClosureTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  reinspectionClosureText: { ...Typography.caption, color: Colors.textSecondary },
  reinspectionStages: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reinspectionStage: { ...Typography.caption, color: Colors.info, fontFamily: FontFamily.semibold },
  financialBlocker: { gap: Spacing.sm },
  financialBlockerTitle: { ...Typography.bodyMedium, color: Colors.text, fontFamily: FontFamily.semibold },
  financialBlockerText: { ...Typography.caption, color: Colors.textSecondary },
  conclusionModalText: { ...Typography.body, color: Colors.textSecondary },
  summaryRail: { width: 310 },
  summaryCard: { gap: Spacing.md },
  summaryHeading: {
    ...Typography.bodyMedium,
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
  },
  summaryDivider: { height: 1, backgroundColor: Colors.border },
  summaryRow: { paddingHorizontal: 0 },
  draftStatus: { ...Typography.caption, color: Colors.ok, fontFamily: FontFamily.medium },
  draftStatusError: { color: Colors.nok },
  toastWrap: {
    position: 'absolute',
    bottom: 96,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: ZIndex.toast,
  },
});
