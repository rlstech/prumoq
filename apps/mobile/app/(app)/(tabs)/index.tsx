import { useQuery } from '@powersync/react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../components/AppHeader';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { ProgressBar } from '../../../components/ProgressBar';
import { BadgeStatus, StatusBadge } from '../../../components/StatusBadge';
import { Card, Chip, SectionTitle } from '../../../components/ui';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
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

function deadline(dateStr: string): { label: string; color: string; bg: string } {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return { label: 'Vence hoje', color: Colors.nok, bg: Colors.nokBg };
  if (diff === 1) return { label: 'Amanhã', color: Colors.warn, bg: Colors.warnBg };
  return { label: `${diff} dias`, color: Colors.warn, bg: Colors.warnBg };
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
interface ObraProgressRow {
  id: string;
  nome: string;
  status: string;
  total_ambientes: number;
  total_fvs: number;
  fvs_concluidas: number;
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

  const ready = !!userId && !!perfil;
  const accessFilter = `(? = 'admin' OR EXISTS (SELECT 1 FROM obra_usuarios ou WHERE ou.obra_id = o.id AND ou.usuario_id = ?))`;
  const accessParams = [perfil, userId];

  const { data: obrasAtivas } = useQuery<CountRow>(
    ready ? `SELECT COUNT(*) AS count FROM obras o WHERE o.ativo = 1 AND ${accessFilter}` : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: ncsAbertas } = useQuery<CountRow>(
    ready
      ? `SELECT COUNT(*) AS count FROM nao_conformidades n
         JOIN verificacoes v ON v.id = n.verificacao_id
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE n.status IN ('aberta','em_correcao') AND ${accessFilter}`
      : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: verifsWeek } = useQuery<CountRow>(
    ready
      ? `SELECT COUNT(*) AS count FROM verificacoes v
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE date(v.data_verif) >= '${weekAgo()}' AND ${accessFilter}`
      : 'SELECT 1 WHERE 0',
    ready ? accessParams : [],
  );
  const { data: ncsHoje } = useQuery<CountRow>(
    ready
      ? `SELECT COUNT(*) AS count FROM nao_conformidades n
         JOIN verificacoes v ON v.id = n.verificacao_id
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         WHERE n.status IN ('aberta','em_correcao') AND date(n.data_nova_verif) = '${today()}' AND ${accessFilter}`
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
           COALESCE(CAST(COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS REAL) * 100 / NULLIF(COUNT(DISTINCT f.id), 0), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = 1
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.ativo = 1 AND ${accessFilter}
    GROUP BY o.id
    LIMIT 5
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

  const kpis = useMemo(() => ({
    obrasAtivas: obrasAtivas[0]?.count ?? 0,
    ncsAbertas: ncsAbertas[0]?.count ?? 0,
    verifsWeek: verifsWeek[0]?.count ?? 0,
    ncsHoje: ncsHoje[0]?.count ?? 0,
  }), [obrasAtivas, ncsAbertas, verifsWeek, ncsHoje]);

  const resumeDraft = (draft: VerificationDraftV1) => {
    router.push(
      `/obras/${draft.obraId}/ambiente/${draft.ambienteId}/fvs/${draft.fvsId}/verificacao/nova` as never,
    );
  };
  const hasActions = drafts.length > 0 || ncsUrgentes.length > 0;

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
            <Text style={styles.greeting}>Olá, {userInfo?.nome?.split(' ')[0] ?? 'Inspetor'}</Text>
            <Text style={styles.headerSub}>
              {userInfo?.cargo ?? 'Inspetor de Campo'} · Seu trabalho de hoje
            </Text>
          </View>
        </AppHeader>

        <View style={styles.content}>
          <View style={styles.section}>
            <SectionTitle
              eyebrow="HOJE"
              title="Panorama de campo"
              description="O que merece sua atenção antes de entrar em campo."
            />
            <OperationalSummary
              activeWorks={kpis.obrasAtivas}
              openNcs={kpis.ncsAbertas}
              weekVerifications={kpis.verifsWeek}
              dueToday={kpis.ncsHoje}
              tablet={isTablet}
              onOpenNcs={() => router.push('/(app)/(tabs)/nc' as never)}
              onOpenWorks={() => router.push('/(app)/(tabs)/obras' as never)}
            />
          </View>

          {hasActions ? (
            <View style={styles.section}>
              <SectionTitle
                eyebrow="PRÓXIMOS PASSOS"
                title="Ações necessárias"
                description="Retome preenchimentos e trate primeiro o que tem prazo."
              />
              <View style={[styles.actionsGrid, isTablet && styles.actionsGridTablet]}>
                {drafts.length > 0 ? (
                  <View style={[styles.actionGroup, isTablet && styles.actionGroupTablet]}>
                    <View style={styles.actionHeading}>
                      <Text style={styles.actionEyebrow}>RETOMAR</Text>
                      <Text style={styles.actionTitle}>Continue de onde parou</Text>
                    </View>
                    {drafts.slice(0, 2).map(draft => (
                      <Pressable
                        key={draft.draftId}
                        accessibilityRole="button"
                        accessibilityLabel={`Continuar ${draft.fvsName}`}
                        onPress={() => resumeDraft(draft)}
                        style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}
                      >
                        <View style={styles.draftIcon}>
                          <FileClock size={23} color={Colors.brandSignature} />
                        </View>
                        <View style={styles.draftBody}>
                          <Text style={styles.draftTitle} numberOfLines={1}>{draft.fvsName || 'Verificação em andamento'}</Text>
                          <Text style={styles.draftMeta} numberOfLines={1}>
                            {draft.ambienteName} · Etapa {stepNumber(draft.currentStep)} de 4
                          </Text>
                          <Text style={styles.draftTime}>Salvo em {formatDraftTime(draft.updatedAt)}</Text>
                        </View>
                        <View style={styles.continueAction}>
                          <Text style={styles.continueText}>Continuar</Text>
                          <ArrowRight size={18} color={Colors.brandSignature} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {ncsUrgentes.length > 0 ? (
                  <View style={[styles.actionGroup, isTablet && styles.actionGroupTablet]}>
                    <View style={styles.actionHeadingRow}>
                      <View style={styles.actionHeading}>
                        <Text style={styles.actionEyebrow}>PRIORIDADE</Text>
                        <Text style={styles.actionTitle}>Reinspeções pendentes</Text>
                      </View>
                      <Pressable onPress={() => router.push('/(app)/(tabs)/nc' as never)}>
                        <Text style={styles.sectionLink}>Ver todas</Text>
                      </Pressable>
                    </View>
                    {ncsUrgentes.map(nc => {
                      const badge = nc.data_nova_verif ? deadline(nc.data_nova_verif) : null;
                      return (
                        <Pressable
                          key={nc.id}
                          style={({ pressed }) => [styles.ncCard, pressed && styles.pressed]}
                          onPress={() => router.push('/(app)/(tabs)/nc' as never)}
                        >
                          <View style={styles.ncIcon}><AlertTriangle size={19} color={Colors.nok} /></View>
                          <View style={styles.ncBody}>
                            <Text style={styles.ncItem} numberOfLines={1}>{nc.item_titulo}</Text>
                            <Text style={styles.ncMeta} numberOfLines={1}>{nc.obra_nome} · {nc.ambiente_nome}</Text>
                          </View>
                          {badge ? <Chip label={badge.label} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionTitle
              eyebrow="CAMPO"
              title="Obras recentes"
              description="Acesse rapidamente os serviços em acompanhamento."
              action={(
                <Pressable onPress={() => router.push('/(app)/(tabs)/obras' as never)}>
                  <Text style={styles.sectionLink}>Todas as obras</Text>
                </Pressable>
              )}
            />
            <View style={[styles.worksGrid, isTablet && styles.worksGridTablet]}>
              {obrasProgresso.map(work => {
                const percentage = work.progresso_percentual ?? 0;
                return (
                  <Pressable
                    key={work.id}
                    style={({ pressed }) => [
                      styles.workCard,
                      isTablet && styles.workCardTablet,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => router.push(`/obras/${work.id}` as never)}
                  >
                    <View style={styles.workIcon}><Building2 size={20} color={Colors.info} /></View>
                    <View style={styles.workBody}>
                      <View style={styles.workTop}>
                        <Text style={styles.workName} numberOfLines={1}>{work.nome}</Text>
                        {work.status ? <StatusBadge status={work.status as BadgeStatus} size="sm" /> : null}
                      </View>
                      <View style={styles.progressRow}>
                        <View style={styles.progress}><ProgressBar value={percentage} height={7} color={percentage === 100 ? Colors.ok : Colors.brand} /></View>
                        <Text style={styles.progressText}>{Math.round(percentage)}%</Text>
                      </View>
                      <Text style={styles.workMeta}>
                        {work.total_ambientes ?? 0} ambientes · {work.fvs_concluidas ?? 0}/{work.total_fvs ?? 0} FVS
                      </Text>
                    </View>
                    <ArrowRight size={18} color={Colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {verifsRecentes.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle eyebrow="HISTÓRICO" title="Atividade recente" />
              <Card style={styles.activityCard}>
                {verifsRecentes.map((verification, index) => (
                  <Pressable
                    key={verification.id}
                    onPress={() => router.push(
                      `/obras/${verification.obra_id}/ambiente/${verification.ambiente_id}/fvs/${verification.fvs_planejada_id}` as never,
                    )}
                    style={({ pressed }) => [
                      styles.activityRow,
                      index < verifsRecentes.length - 1 && styles.activityBorder,
                      pressed && styles.pressed,
                    ]}
                  >
                    <CheckCircle2 size={18} color={Colors.ok} />
                    <View style={styles.activityBody}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{verification.fvs_nome || 'Verificação'}</Text>
                      <Text style={styles.activityMeta} numberOfLines={1}>
                        {verification.obra_nome} · {relativeDate(verification.data_verif)}
                      </Text>
                    </View>
                    <StatusBadge status={verification.status as BadgeStatus} size="sm" />
                  </Pressable>
                ))}
              </Card>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function stepNumber(step: VerificationDraftV1['currentStep']): number {
  return { context: 1, checklist: 2, evidence: 3, review: 4 }[step];
}

function OperationalSummary({
  activeWorks,
  openNcs,
  weekVerifications,
  dueToday,
  tablet,
  onOpenNcs,
  onOpenWorks,
}: {
  activeWorks: number;
  openNcs: number;
  weekVerifications: number;
  dueToday: number;
  tablet: boolean;
  onOpenNcs: () => void;
  onOpenWorks: () => void;
}) {
  const hasOpenNcs = openNcs > 0;
  const attentionColor = hasOpenNcs ? Colors.nok : Colors.ok;
  const attentionBackground = hasOpenNcs ? Colors.nokBg : Colors.okBg;
  const AttentionIcon = hasOpenNcs ? AlertTriangle : CheckCircle2;
  const dueTodayLabel = dueToday === 1 ? '1 vence hoje' : `${dueToday} vencem hoje`;

  return (
    <View style={[styles.summaryLayout, tablet && styles.summaryLayoutTablet]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${openNcs} não conformidades abertas, ${dueTodayLabel}. Abrir não conformidades.`}
        onPress={onOpenNcs}
        style={({ pressed }) => [
          styles.attentionPanel,
          tablet && styles.attentionPanelTablet,
          { borderLeftColor: attentionColor },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.attentionTop}>
          <View style={[styles.attentionIcon, { backgroundColor: attentionBackground }]}>
            <AttentionIcon size={20} color={attentionColor} />
          </View>
          <Text style={[styles.attentionEyebrow, { color: attentionColor }]}>
            {hasOpenNcs ? 'ATENÇÃO AGORA' : 'CAMPO EM DIA'}
          </Text>
          <ArrowRight size={19} color={Colors.textTertiary} />
        </View>

        <View style={styles.attentionMain}>
          <Text style={[styles.attentionValue, { color: attentionColor }]}>{openNcs}</Text>
          <View style={styles.attentionCopy}>
            <Text style={styles.attentionLabel}>
              {openNcs === 1 ? 'não conformidade aberta' : 'não conformidades abertas'}
            </Text>
            <View style={[styles.duePill, { backgroundColor: attentionBackground }]}>
              <Clock3 size={14} color={attentionColor} />
              <Text style={[styles.dueText, { color: attentionColor }]}>{dueTodayLabel}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={[styles.supportStrip, tablet && styles.supportStripTablet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${activeWorks} obras ativas. Abrir obras.`}
          onPress={onOpenWorks}
          style={({ pressed }) => [styles.supportMetric, pressed && styles.supportMetricPressed]}
        >
          <View style={[styles.supportIcon, { backgroundColor: Colors.progressBg }]}>
            <Building2 size={18} color={Colors.info} />
          </View>
          <Text style={styles.supportValue}>{activeWorks}</Text>
          <View style={styles.supportLabelRow}>
            <Text style={styles.supportLabel}>Obras ativas</Text>
            <ArrowRight size={16} color={Colors.textTertiary} />
          </View>
        </Pressable>

        <View style={styles.supportDivider} />

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${weekVerifications} verificações nesta semana`}
          style={styles.supportMetric}
        >
          <View style={[styles.supportIcon, { backgroundColor: Colors.surface2 }]}>
            <ClipboardCheck size={18} color={Colors.textSecondary} />
          </View>
          <Text style={styles.supportValue}>{weekVerifications}</Text>
          <Text style={styles.supportLabel}>Verificações na semana</Text>
        </View>
      </View>
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
    paddingTop: Spacing.xxl,
    gap: Spacing.xxxl,
  },
  section: { gap: Spacing.md },
  actionsGrid: { gap: Spacing.xxl },
  actionsGridTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  actionGroup: { gap: Spacing.md, minWidth: 0 },
  actionGroupTablet: { flex: 1 },
  actionHeading: { gap: 2, flex: 1 },
  actionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  actionEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  actionTitle: { ...Typography.label, color: Colors.text },
  greetingBlock: { gap: 2 },
  greeting: {
    color: Palette.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  headerSub: { ...Typography.body, color: Palette.white, opacity: 0.76 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandSignature,
    borderWidth: 1,
    borderColor: Colors.brandSignature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSizes.sm },
  pressed: { opacity: 0.72 },
  sectionLink: { ...Typography.label, color: Colors.brand },
  draftCard: {
    borderRadius: Radius.lg,
    backgroundColor: Colors.text,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Elevation.card,
  },
  draftIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(216,229,104,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBody: { flex: 1, gap: 2 },
  draftTitle: { ...Typography.bodyMedium, color: Colors.surface, fontFamily: FontFamily.semibold },
  draftMeta: { ...Typography.caption, color: Colors.borderNormal },
  draftTime: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, color: Colors.textTertiary },
  continueAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  continueText: { ...Typography.label, color: Colors.brandSignature },
  ncCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.nok,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Elevation.card,
  },
  ncIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ncBody: { flex: 1, gap: 2 },
  ncItem: { ...Typography.bodyMedium, color: Colors.text },
  ncMeta: { ...Typography.caption, color: Colors.textSecondary },
  workCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Elevation.card,
  },
  worksGrid: { gap: Spacing.md },
  worksGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  workCardTablet: { width: '48%' },
  workIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.progressBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workBody: { flex: 1, gap: 6 },
  workTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  workName: { ...Typography.bodyMedium, color: Colors.text, flex: 1, fontFamily: FontFamily.semibold },
  workMeta: { ...Typography.caption, color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progress: { flex: 1 },
  progressText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.semibold },
  summaryLayout: { gap: Spacing.md },
  summaryLayoutTablet: { flexDirection: 'row', alignItems: 'stretch' },
  attentionPanel: {
    minHeight: 148,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    gap: Spacing.lg,
    ...Elevation.card,
  },
  attentionPanelTablet: { flex: 1.25 },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  attentionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionEyebrow: { ...Typography.overline, flex: 1 },
  attentionMain: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  attentionValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.display,
    lineHeight: 46,
    letterSpacing: -1.5,
  },
  attentionCopy: { flex: 1, alignItems: 'flex-start', gap: Spacing.sm, paddingBottom: 3 },
  attentionLabel: { ...Typography.bodyMedium, color: Colors.text },
  duePill: {
    minHeight: 28,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  supportStrip: {
    minHeight: 124,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Elevation.card,
  },
  supportStripTablet: { flex: 0.9, minHeight: 148 },
  supportMetric: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 5,
  },
  supportMetricPressed: { backgroundColor: Colors.surface2 },
  supportIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  supportValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xxl,
    lineHeight: 30,
    color: Colors.text,
  },
  supportLabelRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  supportLabel: { ...Typography.caption, color: Colors.textSecondary, flexShrink: 1 },
  supportDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  activityCard: { padding: 0, overflow: 'hidden' },
  activityRow: {
    minHeight: 70,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  activityBody: { flex: 1, gap: 2 },
  activityTitle: { ...Typography.bodyMedium, color: Colors.text },
  activityMeta: { ...Typography.caption, color: Colors.textSecondary },
});
