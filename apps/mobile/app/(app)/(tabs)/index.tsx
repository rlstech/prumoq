import { useQuery } from '@powersync/react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileClock,
  Trash2,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../../components/BrandMark';
import { BrandWordmark } from '../../../components/BrandWordmark';
import { ConformityRing } from '../../../components/ConformityRing';
import { CanopyBackdrop } from '../../../components/DashboardCanopy';
import { OfflineBanner } from '../../../components/OfflineBanner';
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
import { supabase } from '../../../lib/supabase';
import { VerificationDraftV1 } from '../../../lib/verification/draft.types';
import { draftStore } from '../../../lib/verification/draftStore';
import { normalizeVerificationStep, VERIFICATION_STEPS, verificationStepIndex } from '../../../lib/verification/controller';

const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
function deadline(dateStr: string): { label: string; color: string; bg: string } {
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
    };
  }
  if (diff === 0) return { label: 'Vence hoje', color: Colors.warn, bg: Colors.warnBg };
  if (diff === 1) return { label: 'Amanhã', color: Colors.warn, bg: Colors.warnBg };
  return { label: `${diff} dias`, color: Colors.textSecondary, bg: Colors.surface2 };
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
interface UserProfile extends UserInfo { perfil: string }

export default function DashboardScreen() {
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [drafts, setDrafts] = useState<VerificationDraftV1[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: rawProfile } = await supabase
        .from('usuarios')
        .select('nome, cargo, perfil')
        .eq('id', data.user.id)
        .single();
      if (!rawProfile) return;
      const profile = rawProfile as UserProfile;
      setPerfil(profile.perfil);
      setUserInfo({ nome: profile.nome, cargo: profile.cargo });
    }).catch(err => {
      console.warn('[Dashboard] getUser failed', err);
    });
  }, []);

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
    SELECT v.id, v.status, v.data_verif,
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
    ORDER BY v.data_verif DESC
    LIMIT 3
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor={Colors.brand} />
      <OfflineBanner />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.canopy}>
          <CanopyBackdrop />
          <View style={styles.canopyInner}>
            <View style={styles.topRow}>
              <View style={styles.brandRow}>
                <BrandMark size={34} variant="onBrand" tile />
                <BrandWordmark fontSize={FontSizes.md} variant="onBrand" />
              </View>
              <View style={styles.headerActions}>
                <SyncStatusIndicator tone="onBrand" compact={false} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir perfil"
                  onPress={() => router.push('/(app)/(tabs)/perfil' as never)}
                  style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
                >
                  <Text style={styles.avatarText}>{userInfo ? initials(userInfo.nome) : 'IN'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.greetingBlock}>
              <Text style={styles.greeting} numberOfLines={1}>
                {greetingFor()}, {userInfo?.nome?.split(' ')[0] ?? 'Inspetor'}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {todayLabel()} · {activeWorks} {activeWorks === 1 ? 'obra ativa' : 'obras ativas'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <WeekCard
            verifications={week.total}
            openNcs={prazos.abertas}
            resolved={week.resolvidas}
            rate={week.taxa}
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

          {verifsRecentes.length > 0 ? (
            <ActivityPanel
              verifications={verifsRecentes}
              onOpen={verification => router.push(
                `/obras/${verification.obra_id}/ambiente/${verification.ambiente_id}/fvs/${verification.fvs_planejada_id}` as never,
              )}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function stepNumber(step: VerificationDraftV1['currentStep']): number {
  // Rascunhos v4 legados podem trazer 'context'/'evidence' — normaliza antes
  // de indexar no wizard de 2 etapas atual.
  return verificationStepIndex(normalizeVerificationStep(step)) + 1;
}

/** Cabeçalho de seção fora do cartão, no padrão de lista agrupada do iOS. */
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
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionHint ?? actionLabel}
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => [styles.sectionLink, pressed && styles.pressed]}
        >
          <Text style={styles.sectionLinkText}>{actionLabel}</Text>
          <ChevronRight size={14} color={Colors.brand} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Cartão-herói: flutua sobre a capa e responde à única pergunta que abre o
 * dia — como está o trabalho da semana. O anel carrega a taxa de conformidade
 * e a faixa inferior os três números que a explicam.
 */
function WeekCard({
  verifications,
  openNcs,
  resolved,
  rate,
}: {
  verifications: number;
  openNcs: number;
  resolved: number;
  rate: number | null;
}) {
  const headline = verifications === 0
    ? 'Nenhuma verificação'
    : `${verifications} ${verifications === 1 ? 'verificação' : 'verificações'}`;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroRow}>
        <ConformityRing value={rate} />
        <View style={styles.heroBody}>
          <Text style={styles.overline}>SUA SEMANA</Text>
          <Text style={styles.heroHeadline} numberOfLines={2}>{headline}</Text>
          <Text style={styles.heroCaption}>nos últimos 7 dias</Text>
        </View>
      </View>

      <View style={[styles.cardDivider, styles.heroDivider]} />

      <View style={styles.statsRow}>
        <View style={[styles.stat, styles.statFirst]}>
          <Text style={styles.statValue}>{verifications}</Text>
          <Text style={styles.statLabel}>Verificações</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, openNcs > 0 && { color: Colors.nok }]}>{openNcs}</Text>
          <Text style={styles.statLabel}>NCs abertas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, resolved > 0 && { color: Colors.ok }]}>{resolved}</Text>
          <Text style={styles.statLabel}>Resolvidas</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A única coisa que o inspetor pode continuar agora. O rascunho mais recente
 * vira ação primária; os demais ficam como linhas compactas logo abaixo, sem
 * repetir o botão.
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

  return (
    <View style={styles.resumeGroup}>
      <View style={styles.card}>
        <View style={styles.draftHead}>
          <View style={styles.draftIcon}>
            <FileClock size={19} color={Colors.brand} strokeWidth={2} />
          </View>
          <View style={styles.draftBody}>
            <Text style={styles.draftEyebrow} numberOfLines={1}>
              RASCUNHO · {formatDraftTime(draft.updatedAt)}
            </Text>
            <Text style={styles.draftTitle} numberOfLines={2}>
              {draft.fvsName || 'Verificação em andamento'}
            </Text>
            <Text style={styles.draftMeta} numberOfLines={1}>{draft.ambienteName}</Text>
          </View>
          <View style={styles.stepChip}>
            <Text style={styles.stepChipText}>
              Etapa {step}/{VERIFICATION_STEPS.length}
            </Text>
          </View>
        </View>

        <View style={styles.draftTrack}>
          <View style={[styles.draftFill, { width: `${progress}%` as `${number}%` }]} />
        </View>

        <View style={styles.draftActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${draft.fvsName || 'verificação em andamento'}`}
            onPress={() => onResume(draft)}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Continuar vistoria</Text>
            <ArrowRight size={17} color={Colors.text} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Descartar rascunho de ${draft.fvsName || 'verificação em andamento'}`}
            onPress={() => onDiscard(draft)}
            hitSlop={8}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.rowPressed]}
          >
            <Trash2 size={17} color={Colors.nok} />
          </Pressable>
        </View>
      </View>

      {others.map(other => (
        <View key={other.draftId} style={styles.draftRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${other.fvsName || 'verificação em andamento'}`}
            onPress={() => onResume(other)}
            style={({ pressed }) => [styles.draftRowMain, pressed && styles.pressed]}
          >
            <FileClock size={17} color={Colors.brand} />
            <View style={styles.draftRowBody}>
              <Text style={styles.draftRowTitle} numberOfLines={1}>
                {other.fvsName || 'Verificação em andamento'}
              </Text>
              <Text style={styles.draftRowMeta} numberOfLines={1}>
                {other.ambienteName} · etapa {stepNumber(other.currentStep)} de {VERIFICATION_STEPS.length}
              </Text>
            </View>
            <ArrowRight size={16} color={Colors.brand} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Descartar rascunho de ${other.fvsName || 'verificação em andamento'}`}
            onPress={() => onDiscard(other)}
            hitSlop={8}
            style={({ pressed }) => [styles.draftRowDiscard, pressed && styles.pressed]}
          >
            <Trash2 size={16} color={Colors.nok} />
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
        title="REINSPEÇÕES"
        actionLabel={prazos.abertas > 0 ? `Ver as ${prazos.abertas}` : 'Ver todas'}
        actionHint="Ver todas as não conformidades"
        onPress={onOpenQueue}
      />

      <View style={styles.card}>
        <View style={styles.band}>
          <DeadlineCell
            value={prazos.vencidas}
            label="Vencidas"
            color={prazos.vencidas > 0 ? Colors.nok : Colors.textTertiary}
            Icon={AlertTriangle}
            onPress={onOpenQueue}
          />
          <View style={styles.bandDivider} />
          <DeadlineCell
            value={prazos.hoje}
            label="Vencem hoje"
            color={prazos.hoje > 0 ? Colors.warn : Colors.textTertiary}
            Icon={Clock3}
            onPress={onOpenQueue}
          />
          <View style={styles.bandDivider} />
          <DeadlineCell
            value={prazos.proximos}
            label="Próx. 7 dias"
            color={Colors.text}
            Icon={CalendarDays}
            onPress={onOpenQueue}
          />
        </View>

        {ncs.length === 0 ? (
          <>
            <View style={styles.cardDivider} />
            <View style={styles.emptyRow}>
              <CheckCircle2 size={20} color={Colors.ok} strokeWidth={2.2} />
              <View style={styles.emptyBody}>
                <Text style={styles.emptyTitle}>Campo em dia</Text>
                <Text style={styles.emptyText}>Nenhuma reinspeção pendente nas suas obras.</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {ncs.map(nc => {
              const due = deadline(nc.data_nova_verif);
              return (
                <View key={nc.id}>
                  <View style={styles.cardDivider} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reinspecionar ${nc.item_titulo} em ${nc.obra_nome}, ${nc.ambiente_nome}. ${due.label}.`}
                    onPress={() => onOpenNc(nc.id)}
                    style={({ pressed }) => [styles.queueRow, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.tile, { backgroundColor: due.bg }]}>
                      <AlertTriangle size={17} color={due.color} strokeWidth={2.1} />
                    </View>
                    <View style={styles.queueBody}>
                      <Text style={styles.queueTitle} numberOfLines={2}>{nc.item_titulo}</Text>
                      <Text style={styles.queueMeta} numberOfLines={1}>
                        {nc.obra_nome} · {nc.ambiente_nome}
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: due.bg }]}>
                      <View style={[styles.chipDot, { backgroundColor: due.color }]} />
                      <Text style={[styles.chipText, { color: due.color }]}>{due.label}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {remaining > 0 ? (
              <>
                <View style={styles.cardDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir a fila de reinspeções"
                  onPress={onOpenQueue}
                  style={({ pressed }) => [styles.cardFoot, pressed && styles.rowPressed]}
                >
                  <Text style={styles.cardFootText}>
                    Mais {remaining} {remaining === 1 ? 'reinspeção' : 'reinspeções'} na fila
                  </Text>
                  <ChevronRight size={15} color={Colors.brand} strokeWidth={2.4} />
                </Pressable>
              </>
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
  Icon,
  onPress,
}: {
  value: number;
  label: string;
  color: string;
  Icon: typeof AlertTriangle;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label.toLowerCase()}. Abrir não conformidades.`}
      onPress={onPress}
      style={({ pressed }) => [styles.bandCell, pressed && styles.rowPressed]}
    >
      <Text style={[styles.bandValue, { color }]}>{value}</Text>
      <View style={styles.bandLabelRow}>
        <Icon size={13} color={color} strokeWidth={2.2} />
        <Text style={styles.bandLabel} numberOfLines={1}>{label}</Text>
      </View>
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
        title="SUAS OBRAS"
        actionLabel="Todas"
        actionHint="Ver todas as obras"
        onPress={onOpenAll}
      />

      <View style={styles.card}>
        {works.length === 0 ? (
          <View style={styles.emptyRow}>
            <Building2 size={20} color={Colors.textSecondary} />
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
                <View style={[styles.tile, { backgroundColor: done ? Colors.okBg : Colors.infoBg }]}>
                  <Building2 size={19} color={done ? Colors.ok : Colors.info} strokeWidth={1.9} />
                </View>
                <View style={styles.workBody}>
                  <View style={styles.workTop}>
                    <Text style={styles.workName} numberOfLines={1}>{work.nome}</Text>
                    {work.status ? <StatusBadge status={work.status as BadgeStatus} size="sm" /> : null}
                  </View>
                  <View style={styles.progressRow}>
                    <View style={styles.progress}>
                      <ProgressBar
                        value={percentage}
                        height={6}
                        color={done ? Colors.ok : Colors.brand}
                      />
                    </View>
                    <Text style={styles.progressText}>{Math.round(percentage)}%</Text>
                  </View>
                  <Text style={styles.workMeta} numberOfLines={1}>
                    {work.total_ambientes ?? 0} ambientes · {work.fvs_concluidas ?? 0}/{work.total_fvs ?? 0} FVS
                    {ncs > 0 ? ` · ${ncs} ${ncs === 1 ? 'NC aberta' : 'NCs abertas'}` : ''}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ActivityPanel({
  verifications,
  onOpen,
}: {
  verifications: VerifRecentRow[];
  onOpen: (verification: VerifRecentRow) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title="ATIVIDADE RECENTE" />

      <View style={styles.card}>
        {verifications.map((verification, index) => {
          const conforming = verification.status === 'conforme';
          return (
            <View key={verification.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${verification.fvs_nome || 'Verificação'} em ${verification.obra_nome}, ${relativeDate(verification.data_verif)}.`}
                onPress={() => onOpen(verification)}
                style={({ pressed }) => [styles.activityRow, pressed && styles.rowPressed]}
              >
                <View style={[styles.avatarDot, { backgroundColor: conforming ? Colors.okBg : Colors.nokBg }]}>
                  {conforming
                    ? <CheckCircle2 size={17} color={Colors.ok} strokeWidth={2.3} />
                    : <XCircle size={17} color={Colors.nok} strokeWidth={2.3} />}
                </View>
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {verification.fvs_nome || 'Verificação'}
                  </Text>
                  <Text style={styles.activityMeta} numberOfLines={1}>
                    {verification.obra_nome} · {verification.ambiente_nome}
                  </Text>
                </View>
                <Text style={styles.activityDate}>{relativeDate(verification.data_verif)}</Text>
                <ChevronRight size={15} color={Colors.borderNormal} strokeWidth={2.4} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Raio da capa — maior que Radius.xl de propósito: é a única superfície de
 *  tela cheia do app e acompanha o arredondamento do aparelho. */
const CANOPY_RADIUS = 28;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.brand },
  scroll: { backgroundColor: Colors.bg },
  page: { paddingBottom: Spacing.huge, backgroundColor: Colors.bg },

  // ── Capa ────────────────────────────────────────────────────────────
  canopy: {
    backgroundColor: Colors.brand,
    borderBottomLeftRadius: CANOPY_RADIUS,
    borderBottomRightRadius: CANOPY_RADIUS,
    overflow: 'hidden',
    paddingBottom: 64,
  },
  canopyInner: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  topRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(216,229,104,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(216,229,104,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.brandSignature,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
  },
  greetingBlock: { gap: 6 },
  greeting: { ...Typography.title, color: Palette.white },
  headerSub: { ...Typography.overline, color: Palette.white, opacity: 0.6 },

  // ── Estrutura ───────────────────────────────────────────────────────
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  columns: { gap: Spacing.xl },
  columnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  columnWide: { flex: 1.25, minWidth: 0 },
  columnNarrow: { flex: 1, minWidth: 0 },
  section: { gap: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  sectionTitle: { ...Typography.overline, color: Colors.textTertiary },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionLinkText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
    color: Colors.brand,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Elevation.card,
  },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 68 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cardFootText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: { ...Typography.overline, color: Colors.textTertiary },
  pressed: { opacity: 0.72 },
  rowPressed: { backgroundColor: Colors.surface2 },

  // ── Cartão da semana ────────────────────────────────────────────────
  heroCard: {
    marginTop: -52,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Elevation.floating,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  heroBody: { flex: 1, minWidth: 0, gap: 4 },
  heroHeadline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.lg,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: Colors.text,
  },
  heroCaption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md },
  heroDivider: { marginHorizontal: -Spacing.lg },
  stat: { flex: 1, gap: 2, paddingLeft: Spacing.md },
  statFirst: { paddingLeft: 0 },
  statDivider: { width: 1, height: 26, backgroundColor: Colors.border },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },

  // ── Rascunho ────────────────────────────────────────────────────────
  resumeGroup: { gap: Spacing.sm },
  draftHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  draftIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBody: { flex: 1, minWidth: 0, gap: 3 },
  draftEyebrow: { ...Typography.overline, color: Colors.warn },
  draftTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.base,
    lineHeight: 21,
    letterSpacing: -0.25,
    color: Colors.text,
  },
  draftMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  stepChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.naBg,
  },
  stepChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  draftTrack: {
    height: 5,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  draftFill: { height: 5, borderRadius: Radius.full, backgroundColor: Colors.brand },
  draftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cta: {
    flex: 1,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandSignature,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  ghostButton: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingRight: Spacing.sm,
  },
  draftRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.lg,
  },
  draftRowBody: { flex: 1, minWidth: 0, gap: 2 },
  draftRowTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  draftRowMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  draftRowDiscard: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Reinspeções ─────────────────────────────────────────────────────
  band: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: Spacing.md },
  bandCell: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  bandDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },
  bandValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 30,
    letterSpacing: -1,
  },
  bandLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bandLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  queueBody: { flex: 1, minWidth: 0, gap: 2 },
  queueTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    lineHeight: 19,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  queueMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  chipDot: { width: 5, height: 5, borderRadius: Radius.full },
  chipText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny },

  // ── Obras ───────────────────────────────────────────────────────────
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  workBody: { flex: 1, minWidth: 0, gap: 6 },
  workTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  workName: {
    flexShrink: 1,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progress: { flex: 1 },
  progressText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.tiny,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  workMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },

  // ── Atividade ───────────────────────────────────────────────────────
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  avatarDot: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: { flex: 1, minWidth: 0, gap: 2 },
  activityTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
    letterSpacing: -0.15,
    color: Colors.text,
  },
  activityMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  activityDate: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },

  // ── Estados vazios ──────────────────────────────────────────────────
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  emptyBody: { flex: 1, gap: 2 },
  emptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
