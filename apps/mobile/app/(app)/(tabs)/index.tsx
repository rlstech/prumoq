import { useQuery } from '@powersync/react';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileClock,
  History,
  Plumb,
  Trash2,
} from '../../../lib/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconBox } from '../../../components/IconBox';
import { ProgressBar } from '../../../components/ProgressBar';
import { BadgeStatus, StatusBadge } from '../../../components/StatusBadge';
import { SyncStatusIndicator } from '../../../components/SyncStatusIndicator';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  Elevation,
  FontFamily,
  FontSizes,
  Palette,
  Radius,
  Spacing,
  Typography,
} from '../../../lib/constants';
import { useConta } from '../../../lib/auth/sessao';
import { VerificationDraftV1 } from '../../../lib/verification/draft.types';
import { draftStore } from '../../../lib/verification/draftStore';
import { normalizeVerificationStep, VERIFICATION_STEPS, verificationStepIndex } from '../../../lib/verification/controller';
import { getTodayIso } from '../../../lib/calendar';

const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function today(): string {
  return getTodayIso();
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getTodayIso(date);
}

function weekAgo(): string {
  return inDays(-7);
}

function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function todayLabel(date = new Date()): string {
  return `${WEEKDAY_ABBR[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')} ${MONTH_ABBR[date.getMonth()]}`;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  const current = new Date();
  const diffDays = Math.round(
    (date.setHours(0, 0, 0, 0) - current.setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (diffDays === 0) return 'Hoje';
  if (diffDays === -1) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Prazo da reinspeção, já em tom semântico: vencida é vermelha, hoje/amanhã
 *  são alerta de prazo, o resto é neutro. */
interface Deadline {
  label: string;
  /** Ícone e ladrilho da linha. */
  color: string;
  bg: string;
  /** Etiqueta: vencida em vermelho, até 3 dias em amarelo, depois só contorno. */
  chipBg: string;
  chipText: string;
  chipBorder: string;
}

function deadline(dateStr: string): Deadline {
  const target = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  const diff = Math.round(
    (target.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (diff < 0) {
    const late = Math.abs(diff);
    return {
      label: late === 1 ? 'Vencida ontem' : `Vencida há ${late} dias`,
      color: Colors.nok,
      bg: Colors.nokBg,
      chipBg: Colors.nok,
      chipText: Palette.white,
      chipBorder: Colors.nok,
    };
  }
  const soon = {
    color: Colors.warn,
    bg: Colors.warnBg,
    chipBg: Palette.accent,
    chipText: Palette.onAccent,
    chipBorder: Palette.accent,
  };
  if (diff === 0) return { label: 'Vence hoje', ...soon };
  if (diff === 1) return { label: 'Amanhã', ...soon };
  if (diff <= 3) return { label: `${diff} dias`, ...soon };
  return {
    label: `${diff} dias`,
    color: Colors.warn,
    bg: Colors.warnBg,
    chipBg: 'transparent',
    chipText: Colors.text,
    chipBorder: Colors.text,
  };
}

function formatDraftTime(updatedAt: string): string {
  return new Date(updatedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CountRow { count: number }
/** Reinspeções abertas quebradas por prazo — o dado que gera ação, no lugar
 *  do total bruto de NCs que a tela anterior repetia em três lugares. */
interface NcPrazosRow {
  nc_vencidas: number;
  nc_hoje: number;
  nc_proximos: number;
  nc_abertas: number;
}
interface SemanaRow {
  verif_total: number;
  verif_conformes: number;
}
interface ObraProgressRow {
  id: string;
  nome: string;
  status: string;
  total_ambientes: number;
  total_fvs: number;
  fvs_concluidas: number;
  ncs_abertas: number;
  progresso_percentual: number;
}
interface NcUrgentRow {
  id: string;
  item_titulo: string;
  ambiente_nome: string;
  obra_nome: string;
  data_nova_verif: string;
  prioridade: string;
}
interface VerifRecentRow {
  id: string;
  status: string;
  data_verif: string;
  created_at: string | null;
  ambiente_nome: string;
  obra_nome: string;
  fvs_nome: string;
  fvs_planejada_id: string;
  ambiente_id: string;
  obra_id: string;
}
interface FvsDraftMetaRow {
  id: string;
  status: string;
  ultima_verif_em: string | null;
}

/** Estados que travam a Nova Verificação (RN-FVS-01) — rascunho dessas FVSs
 *  nunca pode mais ser retomado. */
const CONCLUDED_FVS_STATUSES = new Set(['concluida', 'concluida_ressalva', 'conforme']);
interface UserInfo { nome: string; cargo: string }

export default function DashboardScreen() {
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  // O inset do topo entra como padding da raiz (SafeAreaView de 'react-native'
  // não faz nada no Android).
  const insets = useSafeAreaInsets();
  const conta = useConta();
  const userId = conta?.usuarioId ?? null;
  const perfil: string | null = conta?.perfil ?? null;
  // Nome e cargo vêm do banco local (sincronizado); a conta da sessão cobre o nome antes da 1ª sincronização.
  const { data: perfilRows } = useQuery<UserInfo>(
    'SELECT nome, cargo FROM usuarios WHERE id = ? LIMIT 1',
    [userId ?? ''],
  );
  const userInfo: UserInfo | null = perfilRows[0] ?? (conta ? { nome: conta.nome, cargo: '' } : null);
  const [drafts, setDrafts] = useState<VerificationDraftV1[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      draftStore.listForUser(userId).then(found => {
        if (active) setDrafts(found);
      }).catch(() => {
        if (active) setDrafts([]);
      });
      return () => { active = false; };
    }, [userId]),
  );

  // Status atual das FVSs que têm rascunho + data da última verificação
  // gravada — base para podar rascunhos obsoletos (deletar do dispositivo).
  const draftFvsIds = useMemo(() => [...new Set(drafts.map(draft => draft.fvsId))], [drafts]);
  const draftPlaceholders = draftFvsIds.map(() => '?').join(', ');
  const { data: draftFvsMeta } = useQuery<FvsDraftMetaRow>(
    draftFvsIds.length > 0
      ? `SELECT fp.id, fp.status,
           (SELECT MAX(COALESCE(v.updated_at, v.created_at)) FROM verificacoes v
            WHERE v.fvs_planejada_id = fp.id) AS ultima_verif_em
         FROM fvs_planejadas fp
         WHERE fp.id IN (${draftPlaceholders})`
      : 'SELECT 1 WHERE 0',
    draftFvsIds,
  );

  const draftMetaByFvs = useMemo(
    () => new Map(draftFvsMeta.map(row => [row.id, row])),
    [draftFvsMeta],
  );

  // Podar rascunhos que nunca mais poderão ser usados: FVS concluída ou
  // verificação gravada depois do último toque no rascunho (ex.: rascunho
  // ressuscitado pela corrida de auto-save vs discard, ou órfão do outro
  // modo). Tolerância de 5s para defasagem de relógio.
  useEffect(() => {
    if (!userId || drafts.length === 0 || draftFvsMeta.length === 0) return;
    const stale = drafts.filter(draft => {
      const meta = draftMetaByFvs.get(draft.fvsId);
      if (!meta) return false;
      if (CONCLUDED_FVS_STATUSES.has(meta.status)) return true;
      const verifMs = meta.ultima_verif_em ? Date.parse(meta.ultima_verif_em) : Number.NaN;
      if (Number.isNaN(verifMs)) return false;
      const draftMs = Date.parse(draft.updatedAt);
      return !Number.isNaN(draftMs) && verifMs - draftMs > 5_000;
    });
    if (stale.length === 0) return;
    let active = true;
    void (async () => {
      await Promise.all(stale.map(draft => draftStore.delete(draft.draftId).catch(() => { /* re-tenta no próximo foco */ })));
      if (!active) return;
      const staleIds = new Set(stale.map(draft => draft.draftId));
      setDrafts(previous => previous.filter(draft => !staleIds.has(draft.draftId)));
    })();
    return () => { active = false; };
  }, [draftFvsMeta, draftMetaByFvs, drafts, userId]);

  const ready = !!userId && !!perfil;
  const accessFilter = `(? = 'admin' OR EXISTS (SELECT 1 FROM obra_usuarios ou WHERE ou.obra_id = o.id AND ou.usuario_id = ?))`;
  const accessParams = [perfil, userId];

  const { data: obrasAtivas } = useQuery<CountRow>(
    ready ? `SELECT COUNT(*) AS count FROM obras o WHERE o.ativo = 1 AND ${accessFilter}` : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: ncPrazos } = useQuery<NcPrazosRow>(
    ready
      ? `SELECT
           COUNT(CASE WHEN date(n.data_nova_verif) < '${today()}' THEN 1 END) AS nc_vencidas,
           COUNT(CASE WHEN date(n.data_nova_verif) = '${today()}' THEN 1 END) AS nc_hoje,
           COUNT(CASE WHEN date(n.data_nova_verif) > '${today()}' AND date(n.data_nova_verif) <= '${inDays(7)}' THEN 1 END) AS nc_proximos,
           COUNT(*) AS nc_abertas
         FROM nao_conformidades n
         JOIN verificacoes v ON v.id = n.verificacao_id
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE n.status IN ('aberta','em_correcao') AND ${accessFilter}`
      : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: semana } = useQuery<SemanaRow>(
    ready
      ? `SELECT COUNT(*) AS verif_total,
                COUNT(CASE WHEN v.status = 'conforme' THEN 1 END) AS verif_conformes
         FROM verificacoes v
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE date(v.data_verif) >= '${weekAgo()}' AND ${accessFilter}`
      : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: ncsResolvidas } = useQuery<CountRow>(
    ready
      ? `SELECT COUNT(*) AS count FROM nao_conformidades n
         JOIN verificacoes v ON v.id = n.verificacao_id
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE n.status = 'resolvida' AND date(n.resolvida_em) >= '${weekAgo()}' AND ${accessFilter}`
      : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: ncsUrgentes } = useQuery<NcUrgentRow>(
    ready ? `
    SELECT n.id, vi.titulo AS item_titulo, a.nome AS ambiente_nome,
           o.nome AS obra_nome, n.data_nova_verif, n.prioridade
    FROM nao_conformidades n
    JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
    JOIN verificacoes v ON v.id = n.verificacao_id
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE n.status IN ('aberta','em_correcao') AND ${accessFilter}
    ORDER BY n.data_nova_verif ASC
    LIMIT 3
  ` : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: obrasProgresso } = useQuery<ObraProgressRow>(
    ready ? `
    SELECT o.id, o.nome, o.status,
           COUNT(DISTINCT a.id) AS total_ambientes,
           COUNT(DISTINCT f.id) AS total_fvs,
           COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
           (SELECT COUNT(*) FROM nao_conformidades n
              JOIN verificacoes v2 ON v2.id = n.verificacao_id
              JOIN fvs_planejadas fp2 ON fp2.id = v2.fvs_planejada_id
              JOIN ambientes a2 ON a2.id = fp2.ambiente_id
             WHERE a2.obra_id = o.id AND n.status IN ('aberta','em_correcao')) AS ncs_abertas,
           COALESCE(CAST(COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS REAL) * 100 / NULLIF(COUNT(DISTINCT f.id), 0), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = 1
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.ativo = 1 AND ${accessFilter}
    GROUP BY o.id
    LIMIT 3
  ` : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: verifsRecentes } = useQuery<VerifRecentRow>(
    ready ? `
    SELECT v.id, v.status, v.data_verif, v.created_at,
           a.nome AS ambiente_nome, o.nome AS obra_nome,
           fp.subservico AS fvs_nome,
           fp.id AS fvs_planejada_id,
           a.id  AS ambiente_id,
           o.id  AS obra_id
    FROM verificacoes v
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE ${accessFilter}
    ORDER BY v.data_verif DESC, v.created_at DESC
    LIMIT 1
  ` : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );

  const prazos = useMemo(() => ({
    vencidas: ncPrazos[0]?.nc_vencidas ?? 0,
    hoje: ncPrazos[0]?.nc_hoje ?? 0,
    proximos: ncPrazos[0]?.nc_proximos ?? 0,
    abertas: ncPrazos[0]?.nc_abertas ?? 0,
  }), [ncPrazos]);

  const week = useMemo(() => {
    const total = semana[0]?.verif_total ?? 0;
    const conformes = semana[0]?.verif_conformes ?? 0;
    return {
      total,
      conformes,
      resolvidas: ncsResolvidas[0]?.count ?? 0,
      taxa: total > 0 ? Math.round((conformes * 100) / total) : null,
    };
  }, [semana, ncsResolvidas]);

  const openNcs = () => router.push('/(app)/(tabs)/nc' as never);

  const resumeDraft = (draft: VerificationDraftV1) => {
    router.push(
      `/obras/${draft.obraId}/ambiente/${draft.ambienteId}/fvs/${draft.fvsId}/verificacao/nova` as never,
    );
  };

  const discardDraft = useCallback(async (draftId: string) => {
    try {
      await draftStore.delete(draftId);
      setDrafts(previous => previous.filter(draft => draft.draftId !== draftId));
    } catch (error) {
      console.warn('[Dashboard] discard draft error:', error);
      Alert.alert('Erro', 'Não foi possível descartar o rascunho. Tente novamente.');
    }
  }, []);

  const confirmDiscardDraft = useCallback((draft: VerificationDraftV1) => {
    const title = 'Descartar rascunho?';
    const message = `O preenchimento de "${draft.fvsName || 'Verificação em andamento'}" será apagado do aparelho. Esta ação não pode ser desfeita.`;
    // Alert.alert é no-op no react-native-web — usar window.confirm no PWA.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void discardDraft(draft.draftId);
      }
      return;
    }
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => { void discardDraft(draft.draftId); },
        },
      ],
    );
  }, [discardDraft]);

  const heroDraft = drafts[0];
  const otherDrafts = drafts.slice(1, 3);
  const activeWorks = obrasAtivas[0]?.count ?? 0;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, { paddingBottom: Spacing.xxl }]}
      >
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
              onPress={() => router.push('/(app)/(tabs)/perfil' as never)}
              style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
            >
              <View style={styles.plumbMark}>
                <Plumb size={34} color={Palette.accent} strokeWidth={1.7} />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.greetingSmall} numberOfLines={1}>{greetingFor()},</Text>
                <Text style={styles.greetingName} numberOfLines={1}>
                  {userInfo?.nome?.split(' ')[0] ?? 'Inspetor'}
                </Text>
              </View>
            </Pressable>
            <SyncStatusIndicator compact={false} short />
          </View>

          <WeekBlock
            verifications={week.total}
            openNcs={prazos.abertas}
            resolved={week.resolvidas}
            rate={week.taxa}
            subtitle={`${todayLabel()} · ${activeWorks} ${activeWorks === 1 ? 'obra ativa' : 'obras ativas'}`}
          />

          {heroDraft ? (
            <ResumeSection
              draft={heroDraft}
              others={otherDrafts}
              onResume={resumeDraft}
              onDiscard={confirmDiscardDraft}
            />
          ) : null}

          <View style={[styles.columns, isTablet && styles.columnsTablet]}>
            <View style={isTablet ? styles.columnWide : undefined}>
              <ReinspectionPanel
                prazos={prazos}
                ncs={ncsUrgentes.slice(0, 2)}
                onOpenQueue={openNcs}
                onOpenNc={ncId => router.push(`/nc/${ncId}` as never)}
              />
            </View>
            <View style={isTablet ? styles.columnNarrow : undefined}>
              <WorksPanel
                works={obrasProgresso.slice(0, 3)}
                onOpenAll={() => router.push('/(app)/(tabs)/obras' as never)}
                onOpenWork={workId => router.push(`/obras/${workId}` as never)}
              />
            </View>
          </View>

          <HistoryLink
            last={verifsRecentes[0] ?? null}
            onPress={() => router.push('/(app)/(tabs)/historico' as never)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function stepNumber(step: VerificationDraftV1['currentStep']): number {
  // Rascunhos v4 legados podem trazer 'context'/'evidence' — normaliza antes
  // de indexar no wizard de 2 etapas atual.
  return verificationStepIndex(normalizeVerificationStep(step)) + 1;
}

/** Cabeçalho de seção fora do cartão. */
function SectionHeader({
  title,
  actionLabel,
  actionHint,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  actionHint?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionHint ?? actionLabel}
          onPress={onPress}
          hitSlop={10}
          style={({ pressed }) => [styles.sectionLink, pressed && styles.pressed]}
        >
          <Text style={styles.sectionLinkText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A semana em um número grande, direto no concreto, com as pílulas que o
 * explicam logo abaixo (NCs abertas, resolvidas e taxa de conformidade).
 */
function WeekBlock({
  verifications,
  openNcs,
  resolved,
  rate,
  subtitle,
}: {
  verifications: number;
  openNcs: number;
  resolved: number;
  rate: number | null;
  subtitle: string;
}) {
  return (
    <View style={styles.week}>
      <Text style={styles.weekLabel} numberOfLines={1}>Sua semana · {subtitle}</Text>
      <View
        style={styles.weekNumberRow}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${verifications} ${verifications === 1 ? 'verificação' : 'verificações'} nos últimos 7 dias`}
      >
        <Text style={styles.weekNumber}>{verifications}</Text>
        <Text style={styles.weekUnit}>{verifications === 1 ? 'verificação' : 'verificações'}</Text>
      </View>
      <View style={styles.pills}>
        <StatPill
          label={`${openNcs} ${openNcs === 1 ? 'NC aberta' : 'NCs abertas'}`}
          color={openNcs > 0 ? Colors.nok : Colors.textSecondary}
          bg={openNcs > 0 ? Colors.nokBg : Colors.surface}
        />
        <StatPill
          label={`${resolved} ${resolved === 1 ? 'resolvida' : 'resolvidas'}`}
          color={resolved > 0 ? Colors.ok : Colors.textSecondary}
          bg={resolved > 0 ? Colors.okBg : Colors.surface}
        />
        {rate !== null ? (
          <StatPill label={`${rate}% conforme`} color={Colors.text} bg={Colors.surface} />
        ) : null}
      </View>
    </View>
  );
}

function StatPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * A única coisa que o inspetor pode continuar agora: o rascunho mais recente
 * vira o cartão amarelo; os demais ficam como pílulas brancas logo abaixo.
 */
function ResumeSection({
  draft,
  others,
  onResume,
  onDiscard,
}: {
  draft: VerificationDraftV1;
  others: VerificationDraftV1[];
  onResume: (draft: VerificationDraftV1) => void;
  onDiscard: (draft: VerificationDraftV1) => void;
}) {
  const step = stepNumber(draft.currentStep);
  const progress = (step / VERIFICATION_STEPS.length) * 100;
  const name = draft.fvsName || 'Verificação em andamento';

  return (
    <View style={styles.resumeGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continuar vistoria: ${name}, ${draft.ambienteName}. Etapa ${step} de ${VERIFICATION_STEPS.length}.`}
        onPress={() => onResume(draft)}
        style={({ pressed }) => [styles.resumeCard, pressed && styles.resumeCardPressed]}
      >
        <View style={styles.resumeHead}>
          <View style={styles.resumeBody}>
            <Text style={styles.resumeEyebrow} numberOfLines={1}>
              Continuar vistoria · {formatDraftTime(draft.updatedAt)}
            </Text>
            <Text style={styles.resumeTitle} numberOfLines={2}>{name}</Text>
            <Text style={styles.resumeMeta} numberOfLines={1}>{draft.ambienteName}</Text>
          </View>
          <View style={styles.resumeGo}>
            <ArrowRight size={22} color={Palette.accent} strokeWidth={2} />
          </View>
        </View>
        <View style={styles.resumeProgress}>
          <ProgressBar
            value={progress}
            height={14}
            color={Palette.brand}
            trackColor="rgba(28, 31, 34, 0.12)"
            tickColor="rgba(255, 194, 26, 0.6)"
          />
          <View style={styles.resumeFoot}>
            <Text style={styles.resumeStep}>Etapa {step} / {VERIFICATION_STEPS.length}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Descartar rascunho de ${name}`}
              onPress={() => onDiscard(draft)}
              hitSlop={8}
              style={({ pressed }) => [styles.resumeDiscard, pressed && styles.pressed]}
            >
              <Trash2 size={15} color={Palette.onAccent} />
              <Text style={styles.resumeDiscardText}>Descartar</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>

      {others.map(other => (
        <View key={other.draftId} style={styles.draftRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${other.fvsName || 'verificação em andamento'}`}
            onPress={() => onResume(other)}
            style={({ pressed }) => [styles.draftRowMain, pressed && styles.pressed]}
          >
            <View style={styles.roundTile}>
              <FileClock size={20} color={Colors.text} />
            </View>
            <View style={styles.draftRowBody}>
              <Text style={styles.draftRowTitle} numberOfLines={1}>
                {other.fvsName || 'Verificação em andamento'}
              </Text>
              <Text style={styles.draftRowMeta} numberOfLines={1}>
                {other.ambienteName} · etapa {stepNumber(other.currentStep)} de {VERIFICATION_STEPS.length}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Descartar rascunho de ${other.fvsName || 'verificação em andamento'}`}
            onPress={() => onDiscard(other)}
            hitSlop={8}
            style={({ pressed }) => [styles.draftRowDiscard, pressed && styles.pressed]}
          >
            <Trash2 size={17} color={Colors.nok} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * Reinspeções por prazo. O total de NCs sozinho não diz o que fazer hoje —
 * vencidas/hoje/próximos 7 dias diz, e as duas primeiras da fila levam direto
 * para a NC.
 */
function ReinspectionPanel({
  prazos,
  ncs,
  onOpenQueue,
  onOpenNc,
}: {
  prazos: { vencidas: number; hoje: number; proximos: number; abertas: number };
  ncs: NcUrgentRow[];
  onOpenQueue: () => void;
  onOpenNc: (ncId: string) => void;
}) {
  const remaining = prazos.abertas - ncs.length;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Reinspeções"
        actionLabel={prazos.abertas > 0 ? `Ver as ${prazos.abertas}` : 'Ver todas'}
        actionHint="Ver todas as não conformidades"
        onPress={onOpenQueue}
      />

      <View style={styles.card}>
        <View style={styles.band}>
          <DeadlineCell
            value={prazos.vencidas}
            label="Vencidas"
            color={prazos.vencidas > 0 ? Colors.nok : Colors.textSecondary}
            bg={prazos.vencidas > 0 ? Colors.nokBg : Colors.bg}
            onPress={onOpenQueue}
          />
          <DeadlineCell
            value={prazos.hoje}
            label="Vencem hoje"
            color={prazos.hoje > 0 ? Colors.warn : Colors.textSecondary}
            bg={prazos.hoje > 0 ? Colors.warnBg : Colors.bg}
            onPress={onOpenQueue}
          />
          <DeadlineCell
            value={prazos.proximos}
            label="Próx. 7 dias"
            color={Colors.text}
            bg={Colors.bg}
            onPress={onOpenQueue}
          />
        </View>

        {ncs.length === 0 ? (
          <View style={styles.emptyRow}>
            <View style={[styles.roundTile, { backgroundColor: Colors.okBg }]}>
              <CheckCircle2 size={20} color={Colors.ok} />
            </View>
            <View style={styles.emptyBody}>
              <Text style={styles.emptyTitle}>Campo em dia</Text>
              <Text style={styles.emptyText}>Nenhuma reinspeção pendente nas suas obras.</Text>
            </View>
          </View>
        ) : (
          <>
            {ncs.map((nc, index) => {
              const due = deadline(nc.data_nova_verif);
              return (
                <View key={nc.id}>
                  {index > 0 ? <View style={styles.rowDivider} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reinspecionar ${nc.item_titulo} em ${nc.obra_nome}, ${nc.ambiente_nome}. ${due.label}.`}
                    onPress={() => onOpenNc(nc.id)}
                    style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.roundTile, { backgroundColor: due.bg }]}>
                      <AlertTriangle size={20} color={due.color} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={2}>{nc.item_titulo}</Text>
                      <Text style={[styles.rowMeta, { color: due.color === Colors.warn || due.color === Colors.nok ? due.color : Colors.textSecondary }]} numberOfLines={1}>
                        {nc.ambiente_nome} · {due.label}
                      </Text>
                    </View>
                    <IconBox icon={ChevronRight} size={18} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              );
            })}
            {remaining > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir a fila de reinspeções"
                onPress={onOpenQueue}
                style={({ pressed }) => [styles.cardFoot, pressed && styles.rowPressed]}
              >
                <Text style={styles.cardFootText}>
                  Mais {remaining} {remaining === 1 ? 'reinspeção' : 'reinspeções'} na fila
                </Text>
                <IconBox icon={ChevronRight} size={16} color={Colors.textSecondary} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function DeadlineCell({
  value,
  label,
  color,
  bg,
  onPress,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label.toLowerCase()}. Abrir não conformidades.`}
      onPress={onPress}
      style={({ pressed }) => [styles.bandCell, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      <Text style={[styles.bandValue, { color }]}>{value}</Text>
      <Text style={[styles.bandLabel, { color: color === Colors.text ? Colors.textSecondary : color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function WorksPanel({
  works,
  onOpenAll,
  onOpenWork,
}: {
  works: ObraProgressRow[];
  onOpenAll: () => void;
  onOpenWork: (workId: string) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Suas obras"
        actionLabel="Todas"
        actionHint="Ver todas as obras"
        onPress={onOpenAll}
      />

      <View style={styles.card}>
        {works.length === 0 ? (
          <View style={styles.emptyRow}>
            <View style={styles.roundTile}>
              <Building2 size={20} color={Colors.textSecondary} />
            </View>
            <View style={styles.emptyBody}>
              <Text style={styles.emptyTitle}>Nenhuma obra ativa</Text>
              <Text style={styles.emptyText}>Peça acesso a uma obra ao administrador.</Text>
            </View>
          </View>
        ) : works.map((work, index) => {
          const percentage = work.progresso_percentual ?? 0;
          const ncs = work.ncs_abertas ?? 0;
          const done = percentage === 100;
          return (
            <View key={work.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${work.nome}, ${Math.round(percentage)} por cento concluída, ${ncs} não conformidades abertas.`}
                onPress={() => onOpenWork(work.id)}
                style={({ pressed }) => [styles.workRow, pressed && styles.rowPressed]}
              >
                <View style={styles.workTop}>
                  <Text style={styles.workName} numberOfLines={1}>{work.nome}</Text>
                  {work.status ? <StatusBadge status={work.status as BadgeStatus} size="sm" /> : null}
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progress}>
                    <ProgressBar value={percentage} height={10} color={done ? Colors.ok : Palette.brand} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(percentage)}%</Text>
                </View>
                <Text style={styles.workMeta} numberOfLines={1}>
                  {work.total_ambientes ?? 0} ambientes · {work.fvs_concluidas ?? 0}/{work.total_fvs ?? 0} FVS
                  {ncs > 0 ? ` · ${ncs} ${ncs === 1 ? 'NC aberta' : 'NCs abertas'}` : ''}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Atalho para o histórico completo, com a hora da última verificação. */
function HistoryLink({ last, onPress }: { last: VerifRecentRow | null; onPress: () => void }) {
  const meta = last
    ? `Última: ${last.fvs_nome || 'Verificação'} · ${relativeDate(last.created_at || last.data_verif)}${last.created_at ? ` às ${formatTime(last.created_at)}` : ''}`
    : 'Nenhuma verificação ainda';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Últimas verificações. ${meta}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.historyLink, pressed && styles.rowPressed]}
    >
      <View style={styles.roundTile}>
        <History size={22} color={Colors.text} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>Últimas verificações</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <IconBox icon={ChevronRight} size={18} color={Colors.textSecondary} />
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { backgroundColor: Colors.bg },
  page: { backgroundColor: Colors.bg },

  // ── Topo ────────────────────────────────────────────────────────────
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1, minWidth: 0 },
  plumbMark: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flexShrink: 1, minWidth: 0 },
  greetingSmall: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  greetingName: { fontFamily: FontFamily.bold, fontSize: 17, lineHeight: 22, color: Colors.text },

  // ── Semana ──────────────────────────────────────────────────────────
  week: { gap: 4 },
  weekLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },
  weekNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  weekNumber: {
    fontFamily: FontFamily.display,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2.5,
    color: Colors.text,
  },
  weekUnit: { fontFamily: FontFamily.medium, fontSize: 17, color: Colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  pill: {
    height: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillDot: { width: 6, height: 6, borderRadius: Radius.full },
  pillText: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs },

  // ── Estrutura ───────────────────────────────────────────────────────
  columns: { gap: Spacing.xxl },
  columnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  columnWide: { flex: 1.25, minWidth: 0 },
  columnNarrow: { flex: 1, minWidth: 0 },
  section: { gap: Spacing.sm + 2 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: { ...Typography.heading, color: Colors.text, flex: 1, minWidth: 0 },
  sectionLink: { flexShrink: 0, minHeight: 32, justifyContent: 'center' },
  sectionLinkText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 6,
    overflow: 'hidden',
    ...Elevation.card,
  },
  rowDivider: { height: 1, backgroundColor: Colors.bg, marginLeft: 70, marginRight: Spacing.lg },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  cardFootText: { fontFamily: FontFamily.medium, fontSize: FontSizes.xs, color: Colors.textSecondary },
  roundTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: FontFamily.semibold, fontSize: FontSizes.base, lineHeight: 20, color: Colors.text },
  rowMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  pressed: { opacity: 0.72 },
  rowPressed: { backgroundColor: Colors.surface2 },

  // ── Rascunho ────────────────────────────────────────────────────────
  resumeGroup: { gap: Spacing.sm },
  resumeCard: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.xl,
    padding: 22,
    gap: 18,
  },
  resumeCardPressed: { backgroundColor: Palette.accentPressed },
  resumeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  resumeBody: { flex: 1, minWidth: 0, gap: 4 },
  resumeEyebrow: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs, color: Palette.onAccent, opacity: 0.75 },
  resumeTitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: Palette.onAccent },
  resumeMeta: { fontFamily: FontFamily.medium, fontSize: FontSizes.sm, color: Palette.onAccent },
  resumeGo: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeProgress: { gap: Spacing.sm },
  resumeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resumeStep: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Palette.onAccent },
  resumeDiscard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(28, 31, 34, 0.1)',
  },
  resumeDiscardText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Palette.onAccent },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingRight: Spacing.sm,
  },
  draftRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 10,
    paddingLeft: 10,
  },
  draftRowBody: { flex: 1, minWidth: 0, gap: 2 },
  draftRowTitle: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, color: Colors.text },
  draftRowMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  draftRowDiscard: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Reinspeções ─────────────────────────────────────────────────────
  band: { flexDirection: 'row', gap: 6, paddingBottom: 6 },
  bandCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
  },
  bandValue: { fontFamily: FontFamily.monoBold, fontSize: 24, lineHeight: 30 },
  bandLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, lineHeight: 16 },

  // ── Obras ───────────────────────────────────────────────────────────
  workRow: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  workTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  workName: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    lineHeight: 20,
    color: Colors.text,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progress: { flex: 1 },
  progressText: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSizes.xs,
    minWidth: 38,
    textAlign: 'right',
    color: Colors.text,
  },
  workMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },

  // ── Histórico ───────────────────────────────────────────────────────
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingLeft: 10,
    paddingRight: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },

  // ── Estados vazios ──────────────────────────────────────────────────
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md },
  emptyBody: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, color: Colors.text },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, lineHeight: 18, color: Colors.textSecondary },
});
