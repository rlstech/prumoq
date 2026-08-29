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
import { AppHeader } from '../../../components/AppHeader';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { ProgressBar } from '../../../components/ProgressBar';
import { BadgeStatus, StatusBadge } from '../../../components/StatusBadge';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import {
  Breakpoints,
  Colors,
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
    <SafeAreaView style={[styles.safe, styles.safeBrand]}>
      <StatusBar style="light" backgroundColor={Colors.brand} />
      <OfflineBanner />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <AppHeader
          tone="brand"
          rightElement={(
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
              onPress={() => router.push('/(app)/(tabs)/perfil' as never)}
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            >
              <Text style={styles.avatarText}>{userInfo ? initials(userInfo.nome) : 'IN'}</Text>
            </Pressable>
          )}
        >
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>
              {greetingFor()}, {userInfo?.nome?.split(' ')[0] ?? 'Inspetor'}
            </Text>
            <Text style={styles.headerSub}>
              {todayLabel()} · {userInfo?.cargo ?? 'Inspetor de Campo'} · {activeWorks} {activeWorks === 1 ? 'obra ativa' : 'obras ativas'}
            </Text>
          </View>
        </AppHeader>

        <View style={styles.content}>
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
              <WeekPanel
                verifications={week.total}
                openNcs={prazos.abertas}
                resolved={week.resolvidas}
                rate={week.taxa}
              />
            </View>
          </View>

          <View style={[styles.columns, isTablet && styles.columnsTablet]}>
            <View style={isTablet ? styles.columnWide : undefined}>
              <WorksPanel
                works={obrasProgresso.slice(0, 3)}
                onOpenAll={() => router.push('/(app)/(tabs)/obras' as never)}
                onOpenWork={workId => router.push(`/obras/${workId}` as never)}
              />
            </View>
            {verifsRecentes.length > 0 ? (
              <View style={isTablet ? styles.columnNarrow : undefined}>
                <ActivityPanel
                  verifications={verifsRecentes}
                  onOpen={verification => router.push(
                    `/obras/${verification.obra_id}/ambiente/${verification.ambiente_id}/fvs/${verification.fvs_planejada_id}` as never,
                  )}
                />
              </View>
            ) : null}
          </View>
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

/**
 * Primeiro bloco da tela: a única coisa que o inspetor pode continuar agora.
 * O rascunho mais recente vira ação primária; os demais ficam como linhas
 * compactas logo abaixo, sem repetir o botão.
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
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <FileClock size={22} color={Colors.brandSignature} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>RASCUNHO SALVO</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {draft.fvsName || 'Verificação em andamento'}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {draft.ambienteName} · salvo em {formatDraftTime(draft.updatedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.heroStep}>
          <Text style={styles.heroStepLabel}>Etapa {step} de {VERIFICATION_STEPS.length}</Text>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${progress}%` as `${number}%` }]} />
          </View>
        </View>

        <View style={styles.heroActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${draft.fvsName || 'verificação em andamento'}`}
            onPress={() => onResume(draft)}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Continuar vistoria</Text>
            <ArrowRight size={18} color={Colors.text} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Descartar rascunho de ${draft.fvsName || 'verificação em andamento'}`}
            onPress={() => onDiscard(draft)}
            hitSlop={8}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Trash2 size={18} color={Colors.nok} />
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
            <FileClock size={18} color={Colors.brandSignature} />
            <View style={styles.draftRowBody}>
              <Text style={styles.draftRowTitle} numberOfLines={1}>
                {other.fvsName || 'Verificação em andamento'}
              </Text>
              <Text style={styles.draftRowMeta} numberOfLines={1}>
                {other.ambienteName} · etapa {stepNumber(other.currentStep)} de {VERIFICATION_STEPS.length}
              </Text>
            </View>
            <ArrowRight size={16} color={Colors.brandSignature} />
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
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Reinspeções</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas as não conformidades"
          onPress={onOpenQueue}
          hitSlop={8}
          style={({ pressed }) => [styles.panelLink, pressed && styles.pressed]}
        >
          <Text style={styles.panelLinkText}>Ver todas</Text>
          <ChevronRight size={14} color={Colors.brand} strokeWidth={2.4} />
        </Pressable>
      </View>

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
          color={Colors.textSecondary}
          Icon={CalendarDays}
          onPress={onOpenQueue}
        />
      </View>

      {ncs.length === 0 ? (
        <View style={styles.emptyRow}>
          <CheckCircle2 size={20} color={Colors.ok} strokeWidth={2.2} />
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>Campo em dia</Text>
            <Text style={styles.emptyText}>Nenhuma reinspeção pendente nas suas obras.</Text>
          </View>
        </View>
      ) : (
        <>
          {ncs.map(nc => {
            const due = deadline(nc.data_nova_verif);
            return (
              <Pressable
                key={nc.id}
                accessibilityRole="button"
                accessibilityLabel={`Reinspecionar ${nc.item_titulo} em ${nc.obra_nome}, ${nc.ambiente_nome}. ${due.label}.`}
                onPress={() => onOpenNc(nc.id)}
                style={({ pressed }) => [styles.queueRow, pressed && styles.rowPressed]}
              >
                <View style={[styles.datum, { backgroundColor: due.color }]} />
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
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir a fila de reinspeções"
            onPress={onOpenQueue}
            style={({ pressed }) => [styles.panelFoot, pressed && styles.rowPressed]}
          >
            <Text style={styles.panelFootText}>
              {remaining > 0
                ? `Mais ${remaining} ${remaining === 1 ? 'reinspeção' : 'reinspeções'} na fila`
                : 'Fila de reinspeção completa'}
            </Text>
            <View style={styles.panelLink}>
              <Text style={styles.panelLinkText}>Abrir fila</Text>
              <ChevronRight size={14} color={Colors.brand} strokeWidth={2.4} />
            </View>
          </Pressable>
        </>
      )}
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

/** Desempenho dos últimos 7 dias — o contrapeso das reinspeções. */
function WeekPanel({
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
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Sua semana</Text>
        <Text style={styles.panelCaption}>Últimos 7 dias</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{verifications}</Text>
          <Text style={styles.statLabel}>Verificações</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, openNcs > 0 && { color: Colors.nok }]}>{openNcs}</Text>
          <Text style={styles.statLabel}>NCs abertas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{resolved}</Text>
          <Text style={styles.statLabel}>NCs resolvidas</Text>
        </View>
      </View>

      <View style={styles.rateBlock}>
        <View style={styles.rateTop}>
          <Text style={styles.rateLabel}>Verificações conformes</Text>
          <Text style={[styles.rateValue, rate === null && styles.rateValueEmpty]}>
            {rate === null ? '—' : `${rate}%`}
          </Text>
        </View>
        <ProgressBar value={rate ?? 0} height={6} color={Colors.ok} />
      </View>
    </View>
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
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Obras</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas as obras"
          onPress={onOpenAll}
          hitSlop={8}
          style={({ pressed }) => [styles.panelLink, pressed && styles.pressed]}
        >
          <Text style={styles.panelLinkText}>Todas</Text>
          <ChevronRight size={14} color={Colors.brand} strokeWidth={2.4} />
        </Pressable>
      </View>

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
        return (
          <Pressable
            key={work.id}
            accessibilityRole="button"
            accessibilityLabel={`${work.nome}, ${Math.round(percentage)} por cento concluída, ${ncs} não conformidades abertas.`}
            onPress={() => onOpenWork(work.id)}
            style={({ pressed }) => [
              styles.workRow,
              index === works.length - 1 && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.workIcon}><Building2 size={20} color={Colors.info} /></View>
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
                    color={percentage === 100 ? Colors.ok : Colors.brand}
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
        );
      })}
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
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Atividade recente</Text>
      </View>
      {verifications.map((verification, index) => {
        const conforming = verification.status === 'conforme';
        return (
          <Pressable
            key={verification.id}
            accessibilityRole="button"
            accessibilityLabel={`${verification.fvs_nome || 'Verificação'} em ${verification.obra_nome}, ${relativeDate(verification.data_verif)}.`}
            onPress={() => onOpen(verification)}
            style={({ pressed }) => [
              styles.activityRow,
              index === verifications.length - 1 && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
          >
            {conforming
              ? <CheckCircle2 size={18} color={Colors.ok} strokeWidth={2.2} />
              : <XCircle size={18} color={Colors.nok} strokeWidth={2.2} />}
            <View style={styles.activityBody}>
              <Text style={styles.activityTitle} numberOfLines={1}>{verification.fvs_nome || 'Verificação'}</Text>
              <Text style={styles.activityMeta} numberOfLines={1}>
                {verification.obra_nome} · {relativeDate(verification.data_verif)}
              </Text>
            </View>
            <StatusBadge status={verification.status as BadgeStatus} size="sm" />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  safeBrand: { backgroundColor: Colors.brand },
  scroll: { backgroundColor: Colors.bg },
  page: { paddingBottom: Spacing.xxxl },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.xl,
  },
  columns: { gap: Spacing.xl },
  columnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  columnWide: { flex: 1.25, minWidth: 0 },
  columnNarrow: { flex: 1, minWidth: 0 },

  greetingBlock: { gap: 2 },
  greeting: {
    color: Palette.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  headerSub: { ...Typography.label, fontFamily: FontFamily.regular, color: Palette.white, opacity: 0.76 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandSignature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSizes.sm },
  pressed: { opacity: 0.72 },
  rowPressed: { backgroundColor: Colors.surface2 },

  // ── Retomar ────────────────────────────────────────────
  resumeGroup: { gap: Spacing.sm },
  hero: {
    backgroundColor: Colors.text,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Elevation.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(216,229,104,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1, minWidth: 0, gap: 3 },
  heroEyebrow: { ...Typography.overline, color: Colors.brandSignature },
  heroTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.lg,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: Colors.surface,
  },
  heroMeta: { ...Typography.caption, color: Colors.borderNormal },
  heroStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  heroStepLabel: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.borderNormal },
  heroTrack: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  heroFill: { height: 4, borderRadius: Radius.full, backgroundColor: Colors.brandSignature },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cta: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.brandSignature,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaPressed: { opacity: 0.82 },
  ctaText: { ...Typography.button, color: Colors.text },
  ghostButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftRow: {
    borderRadius: Radius.md,
    backgroundColor: Colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  draftRowMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  draftRowBody: { flex: 1, minWidth: 0, gap: 1 },
  draftRowTitle: { ...Typography.label, color: Colors.surface },
  draftRowMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textTertiary },
  draftRowDiscard: {
    alignSelf: 'stretch',
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },

  // ── Painéis ────────────────────────────────────────────
  panel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Elevation.card,
  },
  panelHead: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  panelTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.lg,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  panelCaption: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textTertiary },
  panelLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  panelLinkText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, lineHeight: 18, color: Colors.brand },
  panelFoot: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  panelFootText: { ...Typography.caption, color: Colors.textSecondary, flexShrink: 1 },

  band: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  bandDivider: { width: 1, backgroundColor: Colors.border },
  bandCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  bandValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xxl,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  bandLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bandLabel: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textSecondary, flexShrink: 1 },

  queueRow: {
    minHeight: 64,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datum: { width: 3, alignSelf: 'stretch', borderRadius: Radius.full },
  queueBody: { flex: 1, minWidth: 0, gap: 2 },
  queueTitle: { ...Typography.label, fontFamily: FontFamily.medium, fontSize: FontSizes.base, color: Colors.text },
  queueMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textSecondary },
  chip: {
    minHeight: 24,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipDot: { width: 6, height: 6, borderRadius: Radius.full },
  chipText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, lineHeight: 16 },

  emptyRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyBody: { flex: 1, minWidth: 0, gap: 2 },
  emptyTitle: { ...Typography.label, color: Colors.text },
  emptyText: { ...Typography.caption, color: Colors.textSecondary },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  statValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xl,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: Colors.text,
  },
  statLabel: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textSecondary },
  rateBlock: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 6,
  },
  rateTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  rateLabel: { ...Typography.caption, color: Colors.textSecondary },
  rateValue: { fontFamily: FontFamily.monoSemibold, fontSize: FontSizes.sm, lineHeight: 20, color: Colors.ok },
  rateValueEmpty: { color: Colors.textTertiary },

  workRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  workIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.progressBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workBody: { flex: 1, minWidth: 0, gap: 6 },
  workTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  workName: { ...Typography.label, fontSize: FontSizes.base, color: Colors.text, flex: 1, minWidth: 0 },
  workMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progress: { flex: 1 },
  progressText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    lineHeight: 16,
    color: Colors.textSecondary,
    width: 36,
    textAlign: 'right',
  },

  activityRow: {
    minHeight: 62,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityBody: { flex: 1, minWidth: 0, gap: 2 },
  activityTitle: { ...Typography.label, fontFamily: FontFamily.medium, fontSize: FontSizes.base, color: Colors.text },
  activityMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, lineHeight: 16, color: Colors.textSecondary },
});
