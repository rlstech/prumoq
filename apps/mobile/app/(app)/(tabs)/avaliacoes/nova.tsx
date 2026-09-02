import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ClipboardCheck, LockKeyhole, PenLine } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../components/AppHeader';
import { SignatureField } from '../../../../components/SignatureField';
import { SignatureSection } from '../../../../components/verification/SignatureSection';
import { EvaluationContextStrip } from '../../../../components/evaluation/EvaluationContextStrip';
import { EvaluationCriterionRow } from '../../../../components/evaluation/EvaluationCriterionRow';
import { EvaluationOutcome } from '../../../../components/evaluation/EvaluationOutcome';
import {
  criterionIdForError,
  errorKeys,
  EvaluationResult,
  stepForError,
} from '../../../../components/evaluation/types';
import {
  Badge,
  BottomActionBar,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  ListSurface,
  ModalSheet,
  Progress,
  SectionTitle,
  SelectOption,
  Stepper,
  Toast,
} from '../../../../components/ui';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Spacing,
  Typography,
  ZIndex,
} from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import { supabase } from '../../../../lib/supabase';
import { now, today, uuid } from '../../../../lib/uuid';
import { ensureDefaultSignature } from '../../../../lib/signature-defaults';
import { signatureStore } from '../../../../lib/signature-store';

type Work = { id: string; nome: string; empresa_id: string };
type Team = { id: string; nome: string; obra_id: string };
type Model = { model_id: string; empresa_id: string | null; nome: string; revisao_id: string; numero_revisao: number };
type Criterion = { id: string; titulo: string; peso: number; ordem: number };
type Context = {
  medicao_id: string;
  obra_id: string;
  equipe_id: string;
  referencia: string;
  obra_nome: string;
  equipe_nome: string;
};
type ExistingEvaluation = {
  obra_id: string;
  equipe_id: string;
  medicao_id: string | null;
  modelo_revisao_id: string;
  data_avaliacao: string;
  status: string;
  notificacoes_ocorridas: string | null;
  providencias_tomadas: string | null;
  numero_revisao: number;
  modelo_id: string;
  modelo_nome: string;
  modelo_empresa_id: string | null;
  avaliador_id: string;
};
type ExistingItem = { id: string; criterio_origem_id: string | null; resultado: EvaluationResult | null; comentario_nao_atende: string | null };

type Step = 'avaliacao' | 'fechamento';

const steps = [
  { key: 'avaliacao' as const, label: 'Avaliação' },
  { key: 'fechamento' as const, label: 'Fechamento' },
];

export default function NewEvaluationScreen() {
  const router = useRouter();
  const { medicaoId, avaliacaoId } = useLocalSearchParams<{ medicaoId?: string; avaliacaoId?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  /** Scroll targets for the "Corrigir" links. Every offset is measured against
   * the single column that holds the whole step, so the absolute position is
   * the column's own top padding plus the block's Y plus the row's Y. */
  const rowOffsets = useRef<Record<string, number>>({});
  const blockOffsets = useRef<Record<string, number>>({});

  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('avaliacao');
  const [workId, setWorkId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [modelId, setModelId] = useState('');
  const [date, setDate] = useState(() => today());
  const [answers, setAnswers] = useState<Record<string, EvaluationResult>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState('');
  const [actions, setActions] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  // ── Edição de avaliação existente ──────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);
  const [itemIdByCriterion, setItemIdByCriterion] = useState<Record<string, string>>({});
  const [reopenStatus, setReopenStatus] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenMotivo, setReopenMotivo] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);
  const isEditing = !!avaliacaoId;

  useEffect(() => {
    void supabase.auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null))
      .catch(err => console.warn('[NovaAvaliacao] getUser failed', err));
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────
  // The SQL text below is matched fragment-by-fragment by powersync-web-shim.ts
  // so the PWA can serve the same screens — keep the wording in sync with it.
  const { data: existingEval, isLoading: existingEvalLoading } = useQuery<ExistingEvaluation>(
    `SELECT a.obra_id,a.equipe_id,a.medicao_id,a.modelo_revisao_id,a.data_avaliacao,a.status,a.avaliador_id,a.notificacoes_ocorridas,a.providencias_tomadas,r.numero_revisao,r.modelo_id,mo.nome modelo_nome,mo.empresa_id modelo_empresa_id FROM avaliacoes_empreiteiro a JOIN modelo_avaliacao_empreiteiro_revisoes r ON r.id=a.modelo_revisao_id JOIN modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id WHERE a.id=?`,
    [avaliacaoId ?? ''],
  );
  const existing = existingEval[0];
  // Editing an avaliação tied to a medição re-derives the same locked "de onde veio"
  // context as the create flow — the route just doesn't carry medicaoId in that case.
  const effectiveMedicaoId = medicaoId || existing?.medicao_id || '';

  const { data: contextRows } = useQuery<Context>(
    `SELECT m.id medicao_id,m.obra_id,m.equipe_id,m.referencia,o.nome obra_nome,e.nome equipe_nome FROM medicoes_servico m JOIN obras o ON o.id=m.obra_id JOIN equipes e ON e.id=m.equipe_id WHERE m.id=?`,
    [effectiveMedicaoId],
  );
  const { data: works } = useQuery<Work>(
    'SELECT id,nome,empresa_id FROM obras WHERE status <> \'arquivada\' ORDER BY nome',
    [],
  );
  const { data: teams } = useQuery<Team>(
    `SELECT e.id,e.nome,oe.obra_id FROM equipes e JOIN obra_equipes oe ON oe.equipe_id=e.id WHERE e.tipo='terceirizado' AND e.ativo=1 ORDER BY e.nome`,
    [],
  );
  const { data: models } = useQuery<Model>(
    `SELECT m.id model_id,m.empresa_id,m.nome,r.id revisao_id,r.numero_revisao FROM modelos_avaliacao_empreiteiro m JOIN modelo_avaliacao_empreiteiro_revisoes r ON r.modelo_id=m.id AND r.numero_revisao=m.revisao_atual WHERE m.ativo=1 ORDER BY m.nome`,
    [],
  );
  const { data: existingItems, isLoading: existingItemsLoading } = useQuery<ExistingItem>(
    'SELECT id,criterio_origem_id,resultado,comentario_nao_atende FROM avaliacao_empreiteiro_itens WHERE avaliacao_id=? ORDER BY ordem',
    [avaliacaoId ?? ''],
  );

  const context = contextRows[0];
  const effectiveWorkId = workId || context?.obra_id || '';
  const effectiveTeamId = teamId || context?.equipe_id || '';
  const selectedWork = works.find(work => work.id === effectiveWorkId);
  const availableModels = models.filter(model => !model.empresa_id || model.empresa_id === selectedWork?.empresa_id);
  // Editing pins the exact revision the avaliação was answered against — `models`
  // only lists each model's *current* revision, which may have moved on since. The
  // model field is locked in edit mode (below), so there is nothing to resolve here
  // from `modelId`/`availableModels` at all.
  const selectedModel = isEditing && existing
    ? {
        model_id: existing.modelo_id,
        empresa_id: existing.modelo_empresa_id,
        nome: existing.modelo_nome,
        revisao_id: existing.modelo_revisao_id,
        numero_revisao: existing.numero_revisao,
      }
    : models.find(model => model.model_id === modelId) ?? availableModels[0];

  const { data: criteria } = useQuery<Criterion>(
    'SELECT id,titulo,peso,ordem FROM modelo_avaliacao_empreiteiro_criterios WHERE revisao_id=? ORDER BY ordem',
    [selectedModel?.revisao_id ?? ''],
  );
  const { data: identity } = useQuery<{ cliente_id: string; nome: string; perfil: string; assinatura_padrao_url: string | null }>(
    'SELECT cliente_id, nome, perfil, assinatura_padrao_url FROM usuarios WHERE id = ? LIMIT 1',
    [userId ?? ''],
  );
  const profile = identity[0]?.perfil;

  useEffect(() => {
    if (!userId || signature) return;
    void ensureDefaultSignature(userId, identity[0]?.assinatura_padrao_url).then(path => {
      if (path) setSignature(path);
    }).catch(() => {});
  }, [identity, signature, userId]);

  const canManageExisting = !!existing && (existing.avaliador_id === userId || profile === 'admin' || profile === 'gestor');
  const needsReopen = reopenStatus === 'concluida' && canManageExisting;

  // ── Context sync-back ───────────────────────────────────────────────────────
  useEffect(() => {
    if (context) {
      setWorkId(context.obra_id);
      setTeamId(context.equipe_id);
    }
  }, [context?.medicao_id]);

  useEffect(() => {
    if (!context && teamId && !teams.some(team => team.id === teamId && team.obra_id === effectiveWorkId)) {
      setTeamId('');
    }
  }, [effectiveWorkId, teamId, teams.length, context?.medicao_id]);

  useEffect(() => {
    if (isEditing) return; // Model is pinned to the loaded revision, not re-derived.
    const valid = models.filter(model => !model.empresa_id || model.empresa_id === selectedWork?.empresa_id);
    if (!valid.some(model => model.model_id === modelId)) setModelId(valid[0]?.model_id ?? '');
  }, [isEditing, selectedWork?.empresa_id, models.length]);

  // Loads an existing avaliação exactly once: obra/equipe (when avulsa — a medição
  // link re-derives them via `context` above instead), date, notes, and every
  // criterion's prior answer keyed by criterio_origem_id so EvaluationCriterionRow
  // finds it regardless of edits made afterward. Waits for both queries to actually
  // finish (not just their initial empty tick) so a real empty checklist is never
  // mistaken for "not loaded yet".
  useEffect(() => {
    if (!isEditing || loaded || !existing || existingEvalLoading || existingItemsLoading) return;
    if (!context) {
      setWorkId(existing.obra_id);
      setTeamId(existing.equipe_id);
    }
    setDate(existing.data_avaliacao);
    setNotifications(existing.notificacoes_ocorridas ?? '');
    setActions(existing.providencias_tomadas ?? '');
    const nextAnswers: Record<string, EvaluationResult> = {};
    const nextComments: Record<string, string> = {};
    const nextItemIds: Record<string, string> = {};
    for (const item of existingItems) {
      if (!item.criterio_origem_id) continue;
      if (item.resultado === 'atende' || item.resultado === 'nao_atende') nextAnswers[item.criterio_origem_id] = item.resultado;
      if (item.comentario_nao_atende) nextComments[item.criterio_origem_id] = item.comentario_nao_atende;
      nextItemIds[item.criterio_origem_id] = item.id;
    }
    setAnswers(nextAnswers);
    setComments(nextComments);
    setItemIdByCriterion(nextItemIds);
    setReopenStatus(existing.status);
    setLoaded(true);
  }, [isEditing, loaded, existing, existingItems, existingEvalLoading, existingItemsLoading, context]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const availableTeams = teams.filter(team => team.obra_id === effectiveWorkId);
  const total = useMemo(() => criteria.reduce((sum, criterion) => sum + criterion.peso, 0), [criteria]);
  const score = useMemo(
    () => criteria.reduce((sum, criterion) => sum + (answers[criterion.id] === 'atende' ? criterion.peso : 0), 0),
    [criteria, answers],
  );
  const negatives = criteria.filter(criterion => answers[criterion.id] === 'nao_atende');
  const answeredCount = criteria.filter(criterion => !!answers[criterion.id]).length;
  const metCount = answeredCount - negatives.length;
  const nextCriterionId = criteria.find(criterion => !answers[criterion.id])?.id;

  // A medição names the obra and the contractor even when the roster queries
  // have not synced them yet — seed the options so the locked rows always read
  // the real name instead of falling back to the placeholder.
  const workOptions: SelectOption[] = works.map(work => ({ id: work.id, label: work.nome }));
  if (context && !workOptions.some(option => option.id === context.obra_id)) {
    workOptions.unshift({ id: context.obra_id, label: context.obra_nome });
  }
  const teamOptions: SelectOption[] = availableTeams.map(team => ({ id: team.id, label: team.nome }));
  if (context && !teamOptions.some(option => option.id === context.equipe_id)) {
    teamOptions.unshift({ id: context.equipe_id, label: context.equipe_nome });
  }
  // Locked in edit mode (see selectedModel above) — the option list is just the
  // pinned revision, so the field reads as a confirmation, never a picker.
  const modelOptions: SelectOption[] = isEditing && selectedModel
    ? [{ id: selectedModel.model_id, label: selectedModel.nome, meta: `Revisão ${selectedModel.numero_revisao}` }]
    : availableModels.map(model => ({
        id: model.model_id,
        label: model.nome,
        meta: `Revisão ${model.numero_revisao}`,
      }));

  const signerName = identity[0]?.nome ?? 'Avaliador';
  const identityReady = !!userId && !!identity[0]?.cliente_id;

  // ── Validation ──────────────────────────────────────────────────────────────
  function collectErrors(scope: Step | 'all'): Record<string, string> {
    const found: Record<string, string> = {};

    if (!effectiveWorkId) found[errorKeys.obra] = 'Selecione a obra avaliada.';
    if (!effectiveTeamId) found[errorKeys.equipe] = 'Selecione o empreiteiro avaliado.';
    if (!selectedModel) found[errorKeys.modelo] = 'Selecione o modelo de avaliação.';
    else if (criteria.length === 0) found[errorKeys.modelo] = 'Este modelo não tem critérios publicados.';

    for (const criterion of criteria) {
      const ordinal = String(criterion.ordem).padStart(2, '0');
      if (!answers[criterion.id]) {
        found[errorKeys.criterio(criterion.id)] = `Responda o critério ${ordinal} · ${criterion.titulo}`;
      } else if (answers[criterion.id] === 'nao_atende' && !comments[criterion.id]?.trim()) {
        found[errorKeys.justificativa(criterion.id)] = `Justifique o critério ${ordinal} · ${criterion.titulo}`;
      }
    }

    if (negatives.length && !actions.trim()) {
      found[errorKeys.providencias] = 'Informe as providências tomadas.';
    }
    if (!signature) {
      found[errorKeys.assinatura] = 'Assine a avaliação para concluir o registro.';
    }
    if (!identityReady) {
      found[errorKeys.identidade] = 'Seu perfil ainda está sendo sincronizado. Aguarde alguns segundos.';
    }

    if (scope === 'all') return found;
    return Object.fromEntries(Object.entries(found).filter(([key]) => stepForError(key) === scope));
  }

  function goToStep(target: Step) {
    setStep(target);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleNext() {
    const found = collectErrors('avaliacao');
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setToast('Revise os critérios indicados antes de continuar.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    goToStep('fechamento');
  }

  function scrollToOffset(offset: number) {
    scrollRef.current?.scrollTo({
      y: Math.max(0, Spacing.xxl + offset - Spacing.huge),
      animated: true,
    });
  }

  function handleFixError(key: string) {
    const target = stepForError(key);
    if (target !== step) setStep(target);

    const criterionId = criterionIdForError(key);
    // Wait for the step swap to lay the target out before measuring against it.
    requestAnimationFrame(() => {
      if (criterionId) {
        const list = blockOffsets.current.criterios;
        const row = rowOffsets.current[criterionId];
        if (list === undefined || row === undefined) return;
        scrollToOffset(list + row);
        return;
      }
      const block = key === errorKeys.assinatura
        ? blockOffsets.current.assinatura
        : key === errorKeys.providencias
          ? blockOffsets.current.registros
          : blockOffsets.current.contexto;
      if (block === undefined) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      scrollToOffset(block);
    });
  }

  function setAnswer(criterionId: string, result: EvaluationResult) {
    setAnswers(current => ({ ...current, [criterionId]: result }));
    setErrors(current => {
      const next = { ...current };
      delete next[errorKeys.criterio(criterionId)];
      if (result === 'atende') delete next[errorKeys.justificativa(criterionId)];
      return next;
    });
  }

  function setComment(criterionId: string, value: string) {
    setComments(current => ({ ...current, [criterionId]: value }));
    if (value.trim()) {
      setErrors(current => {
        const next = { ...current };
        delete next[errorKeys.justificativa(criterionId)];
        return next;
      });
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function requestSave() {
    const found = collectErrors('all');
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstStep = stepForError(Object.keys(found)[0]);
      if (firstStep !== step) setStep(firstStep);
      setToast('Existem informações obrigatórias pendentes.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setConfirming(true);
  }

  async function save() {
    if (!selectedModel || !signature) return;
    const clientId = identity[0]?.cliente_id;
    if (!userId || !clientId) return;

    try {
      setSaving(true);
      const at = now();
      let assessmentId: string;

      if (isEditing && avaliacaoId) {
        assessmentId = avaliacaoId;
        await db.execute(
          `UPDATE avaliacoes_empreiteiro SET medicao_id=?,obra_id=?,equipe_id=?,data_avaliacao=?,notificacoes_ocorridas=?,providencias_tomadas=?,updated_at=? WHERE id = ?`,
          [
            effectiveMedicaoId || null,
            effectiveWorkId,
            effectiveTeamId,
            date || at.slice(0, 10),
            notifications.trim() || null,
            actions.trim() || null,
            at,
            assessmentId,
          ],
        );

        for (const criterion of criteria) {
          const existingItemId = itemIdByCriterion[criterion.id];
          if (existingItemId) {
            await db.execute(
              'UPDATE avaliacao_empreiteiro_itens SET resultado=?,comentario_nao_atende=? WHERE id = ?',
              [answers[criterion.id], comments[criterion.id]?.trim() || null, existingItemId],
            );
          } else {
            await db.execute(
              `INSERT INTO avaliacao_empreiteiro_itens (id,cliente_id,avaliacao_id,criterio_origem_id,titulo,peso,resultado,comentario_nao_atende,ordem,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
              [
                uuid(),
                clientId,
                assessmentId,
                criterion.id,
                criterion.titulo,
                criterion.peso,
                answers[criterion.id],
                comments[criterion.id]?.trim() || null,
                criterion.ordem,
                at,
              ],
            );
          }
        }
      } else {
        assessmentId = uuid();
        await db.execute(
          `INSERT INTO avaliacoes_empreiteiro (id,cliente_id,medicao_id,obra_id,equipe_id,modelo_revisao_id,avaliador_id,data_avaliacao,status,pontos_obtidos,pontos_possiveis,percentual,notificacoes_ocorridas,providencias_tomadas,created_offline,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            assessmentId,
            clientId,
            medicaoId ?? null,
            effectiveWorkId,
            effectiveTeamId,
            selectedModel.revisao_id,
            userId,
            date || at.slice(0, 10),
            'rascunho',
            0,
            total,
            0,
            notifications.trim() || null,
            actions.trim() || null,
            1,
            at,
            at,
          ],
        );

        for (const criterion of criteria) {
          await db.execute(
            `INSERT INTO avaliacao_empreiteiro_itens (id,cliente_id,avaliacao_id,criterio_origem_id,titulo,peso,resultado,comentario_nao_atende,ordem,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              uuid(),
              clientId,
              assessmentId,
              criterion.id,
              criterion.titulo,
              criterion.peso,
              answers[criterion.id],
              comments[criterion.id]?.trim() || null,
              criterion.ordem,
              at,
            ],
          );
        }
      }

      // The rascunho → concluida transition is what makes the server trigger
      // recompute pontos/percentual and stamp concluida_em — same for a first
      // conclusion and a reconclusion after reabertura.
      await ensureDefaultSignature(userId, identity[0]?.assinatura_padrao_url);
      const signatureSnapshot = await signatureStore.snapshot(userId, assessmentId);
      if (!signatureSnapshot) throw new Error('Cadastre sua assinatura padrão no Perfil antes de concluir.');
      await db.execute(
        'UPDATE avaliacoes_empreiteiro SET assinatura_url=?, assinada_em=?, status=?, avaliador_id=?, updated_at=? WHERE id = ?',
        [`pending:${signatureSnapshot.uri}`, at, 'concluida', userId, at, assessmentId],
      );

      router.replace('/avaliacoes' as never);
    } catch (error) {
      setErrors({
        salvamento: error instanceof Error ? error.message : 'Não foi possível salvar a avaliação.',
      });
      setToast('Não foi possível salvar a avaliação.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    if (!avaliacaoId) return;
    if (reopenMotivo.trim().length < 3) {
      setReopenError('Explique o motivo da reabertura (mínimo 3 caracteres).');
      return;
    }
    try {
      setReopening(true);
      setReopenError(null);
      const at = now();
      await db.execute(
        'UPDATE avaliacoes_empreiteiro SET status=?, ultimo_motivo_reabertura=?, assinatura_url=?, assinada_em=?, concluida_em=?, pontos_obtidos=?, pontos_possiveis=?, percentual=?, updated_at=? WHERE id = ?',
        ['rascunho', reopenMotivo.trim(), null, null, null, 0, 0, 0, at, avaliacaoId],
      );
      setReopenStatus('rascunho');
    } catch (error) {
      setReopenError(error instanceof Error ? error.message : 'Não foi possível reabrir a avaliação.');
    } finally {
      setReopening(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (medicaoId && !context) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title="Avaliação" showBack onBack={() => router.back()} />
        <EmptyState
          Icon={PenLine}
          title="Medição não encontrada"
          description="Atualize os dados e tente novamente."
        />
      </SafeAreaView>
    );
  }

  if (isEditing && !existingEvalLoading && !existing) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title="Avaliação" showBack onBack={() => router.back()} />
        <EmptyState
          Icon={PenLine}
          title="Avaliação não encontrada"
          description="Ela pode ter sido removida. Volte para o histórico e tente novamente."
        />
      </SafeAreaView>
    );
  }

  if (isEditing && !loaded) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title="Avaliação" showBack onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (isEditing && (!canManageExisting || reopenStatus === 'aprovada' || reopenStatus === 'invalidada')) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title="Avaliação" showBack onBack={() => router.back()} />
        <EmptyState
          Icon={LockKeyhole}
          title="Avaliação somente para consulta"
          description={canManageExisting ? 'Avaliações aprovadas ou invalidadas não podem ser alteradas.' : 'Você não tem permissão para alterar esta avaliação.'}
        />
      </SafeAreaView>
    );
  }

  if (isEditing && needsReopen) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title="Reabrir avaliação" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <View style={styles.section}>
              <Badge tone="warning" size="sm" label="Assinada · aguardando aprovação" Icon={LockKeyhole} />
              <SectionTitle
                eyebrow="AGUARDANDO APROVAÇÃO"
                title="Esta avaliação já foi assinada"
                description="Reabrir volta ela para rascunho — as respostas atuais ficam preservadas, só a assinatura é desfeita. Será preciso assinar de novo para concluir."
              />
              {reopenError ? <ErrorBanner message={reopenError} /> : null}
              <Field
                label="Motivo da reabertura *"
                value={reopenMotivo}
                onChangeText={value => {
                  setReopenMotivo(value);
                  if (value.trim().length >= 3) setReopenError(null);
                }}
                placeholder="O que precisa ser corrigido"
                multiline
              />
            </View>
          </View>
        </ScrollView>
        <BottomActionBar
          primaryLabel="Reabrir para editar"
          onPrimary={() => void handleReopen()}
          primaryLoading={reopening}
          primaryDisabled={reopening}
        />
      </SafeAreaView>
    );
  }

  const saveError = errors.salvamento;
  // The closing step's pending list is live, not a snapshot of the last submit:
  // it has to keep listing the signature until the inspector actually signs.
  const pendingErrors = step === 'fechamento' ? collectErrors('all') : {};

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title={isEditing ? 'Editar avaliação' : 'Nova avaliação'}
        subtitle={context ? `Medição ${context.referencia}` : 'Avaliação avulsa'}
        showBack
        onBack={() => router.back()}
      />
      <Stepper steps={steps} current={step} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {saveError ? <ErrorBanner message={saveError} /> : null}
            {!identityReady && userId ? (
              <ErrorBanner message="Seu perfil ainda está sendo sincronizado. Aguarde alguns segundos antes de concluir." />
            ) : null}

            {step === 'avaliacao' ? (
              <>
                <View onLayout={event => { blockOffsets.current.contexto = event.nativeEvent.layout.y; }}>
                  <EvaluationContextStrip
                    fromMeasurement={!!context}
                    measurementReference={context?.referencia}
                    works={workOptions}
                    workId={effectiveWorkId}
                    onWorkChange={setWorkId}
                    workError={errors[errorKeys.obra]}
                    teams={teamOptions}
                    teamId={effectiveTeamId}
                    onTeamChange={setTeamId}
                    teamError={errors[errorKeys.equipe]}
                    models={modelOptions}
                    modelId={selectedModel?.model_id ?? ''}
                    onModelChange={setModelId}
                    modelError={errors[errorKeys.modelo]}
                    modelLocked={isEditing}
                    date={date}
                    onDateChange={setDate}
                  />
                </View>

                {selectedModel && criteria.length ? (
                  <>
                    <View style={styles.section}>
                      <SectionTitle
                        eyebrow="CRITÉRIOS"
                        title={selectedModel.nome}
                        description={`Revisão ${selectedModel.numero_revisao} · peso total ${total} pontos`}
                      />
                      <View style={styles.scoreRow}>
                        <Progress
                          value={criteria.length ? (answeredCount / criteria.length) * 100 : 0}
                          tone={answeredCount === criteria.length ? 'success' : 'brand'}
                          showValue
                        />
                        <Text style={styles.scoreText}>
                          <Text style={styles.scoreMono}>{answeredCount}</Text>
                          {` de ${criteria.length} respondidos · `}
                          <Text style={styles.scoreMono}>{`${score}/${total}`}</Text>
                          {' pts'}
                        </Text>
                      </View>
                    </View>

                    <View onLayout={event => { blockOffsets.current.criterios = event.nativeEvent.layout.y; }}>
                      <ListSurface>
                        {criteria.map((criterion, index) => (
                          <View
                            key={criterion.id}
                            onLayout={event => { rowOffsets.current[criterion.id] = event.nativeEvent.layout.y; }}
                          >
                            <EvaluationCriterionRow
                              criterion={criterion}
                              result={answers[criterion.id]}
                              onResultChange={result => setAnswer(criterion.id, result)}
                              comment={comments[criterion.id] ?? ''}
                              onCommentChange={value => setComment(criterion.id, value)}
                              resultError={errors[errorKeys.criterio(criterion.id)]}
                              commentError={errors[errorKeys.justificativa(criterion.id)]}
                              isNext={criterion.id === nextCriterionId}
                              last={index === criteria.length - 1}
                            />
                          </View>
                        ))}
                      </ListSurface>
                    </View>
                  </>
                ) : (
                  <EmptyState
                    Icon={ClipboardCheck}
                    title="Nenhum critério disponível"
                    description="Selecione um modelo de avaliação ativo para esta empresa e revise os critérios publicados."
                  />
                )}
              </>
            ) : (
              <>
                <EvaluationOutcome
                  score={score}
                  total={total}
                  metCount={metCount}
                  unmetCount={negatives.length}
                  errors={pendingErrors}
                  onFixError={handleFixError}
                />

                <View
                  style={styles.section}
                  onLayout={event => { blockOffsets.current.registros = event.nativeEvent.layout.y; }}
                >
                  <SectionTitle
                    eyebrow="REGISTROS"
                    title="Ocorrências e providências"
                    description="Fica anexado ao documento assinado."
                  />
                  <Field
                    label="Notificações ocorridas"
                    value={notifications}
                    onChangeText={setNotifications}
                    placeholder="Descreva, se houver"
                    hint="Opcional"
                    multiline
                  />
                  <Field
                    label="Providências tomadas *"
                    value={actions}
                    onChangeText={value => {
                      setActions(value);
                      if (value.trim()) {
                        setErrors(current => {
                          const next = { ...current };
                          delete next[errorKeys.providencias];
                          return next;
                        });
                      }
                    }}
                    placeholder="O que foi combinado com o empreiteiro"
                    error={errors[errorKeys.providencias]}
                    hint={negatives.length
                      ? `Obrigatório: ${negatives.length} ${negatives.length === 1 ? 'critério não atendido' : 'critérios não atendidos'}.`
                      : 'Sem critérios não atendidos — preencha apenas se houver algo a registrar.'}
                    multiline
                  />
                </View>

                <View
                  style={styles.section}
                  onLayout={event => { blockOffsets.current.assinatura = event.nativeEvent.layout.y; }}
                >
                  <SignatureSection
                    signerName={signerName}
                    signaturePath={signature}
                    standard
                    error={errors[errorKeys.assinatura]}
                    onSign={value => {
                      setSignature(value);
                      setErrors(current => {
                        const next = { ...current };
                        delete next[errorKeys.assinatura];
                        return next;
                      });
                    }}
                    onRefazer={() => {
                      setSignature(null);
                      if (Platform.OS !== 'web') setSigning(true);
                    }}
                    onOpenModal={() => setSigning(true)}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomActionBar
        primaryLabel={step === 'avaliacao' ? 'Revisar e assinar' : 'Concluir avaliação'}
        onPrimary={step === 'avaliacao' ? handleNext : requestSave}
        primaryLoading={saving}
        primaryDisabled={saving || !selectedModel || criteria.length === 0}
        secondaryLabel={step === 'fechamento' ? 'Voltar' : undefined}
        onSecondary={step === 'fechamento' ? () => goToStep('avaliacao') : undefined}
        helper={step === 'avaliacao'
          ? `${answeredCount} de ${criteria.length} critérios respondidos`
          : 'Após assinar, a avaliação segue para aprovação do gestor.'}
      />

      <ModalSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Concluir avaliação?"
        actions={(
          <>
            <Button
              label="Concluir avaliação"
              Icon={Check}
              fullWidth
              loading={saving}
              onPress={() => {
                setConfirming(false);
                void save();
              }}
            />
            <Button
              label="Revisar antes"
              variant="secondary"
              fullWidth
              disabled={saving}
              onPress={() => setConfirming(false)}
            />
          </>
        )}
      >
        <Text style={styles.modalText}>
          A avaliação será registrada com sua assinatura e não poderá mais ser editada. Ela ainda precisa da aprovação de um gestor antes que a medição deste empreiteiro possa ser aprovada.
        </Text>
      </ModalSheet>

      {Platform.OS !== 'web' ? (
        <SignatureField
          visible={signing}
          onSign={value => {
            setSignature(value);
            setSigning(false);
            setErrors(current => {
              const next = { ...current };
              delete next[errorKeys.assinatura];
              return next;
            });
          }}
          onCancel={() => setSigning(false)}
        />
      ) : null}

      {toast ? (
        <View style={styles.toastWrap}>
          <Toast message={toast} tone="danger" onDismiss={() => setToast(null)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },
  column: { width: '100%', maxWidth: Breakpoints.maxForm, alignSelf: 'center', gap: Spacing.lg },
  section: { gap: Spacing.md },
  scoreRow: { gap: Spacing.xs },
  scoreText: { ...Typography.caption, color: Colors.textSecondary },
  scoreMono: { fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.xs, color: Colors.text },
  modalText: { ...Typography.body, color: Colors.textSecondary },
  toastWrap: {
    position: 'absolute',
    bottom: 96,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: ZIndex.toast,
  },
});
