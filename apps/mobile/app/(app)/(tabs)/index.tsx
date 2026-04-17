import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../components/AppHeader';
import { KPICard } from '../../../components/KPICard';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { ProgressBar } from '../../../components/ProgressBar';
import { StatusBadge } from '../../../components/StatusBadge';
import { Colors, FontSizes, Radius, Spacing } from '../../../lib/constants';
import { supabase } from '../../../lib/supabase';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function tempoRelativo(dateStr: string): string {
  const d = new Date(dateStr);
  const t = new Date();
  const diffDays = Math.round((d.setHours(0,0,0,0) - t.setHours(0,0,0,0)) / 86_400_000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === -1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ncBadge(dateStr: string): { label: string; color: string; bg: string } {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return { label: 'Vence hoje', color: Colors.nok,  bg: Colors.nokBg };
  if (diff === 1) return { label: 'Amanhã',     color: Colors.warn, bg: Colors.warnBg };
  return              { label: `${diff} dias`,  color: Colors.warn, bg: Colors.warnBg };
}

interface CountRow { count: number }
interface ObraProgressRow {
  id: string; nome: string; empresa_nome: string; status: string;
  total_ambientes: number; total_fvs: number;
  fvs_concluidas: number; progresso_percentual: number;
}
interface NcUrgentRow {
  id: string; item_titulo: string; ambiente_nome: string;
  obra_nome: string; data_nova_verif: string; prioridade: string;
}
interface VerifRecentRow {
  id: string; status: string; data_verif: string;
  ambiente_nome: string; obra_nome: string; fvs_nome: string;
  fvs_planejada_id: string; ambiente_id: string; obra_id: string;
}

interface UserInfo { nome: string; cargo: string; empresa_nome: string }

export default function DashboardScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: u } = await supabase
        .from('usuarios')
        .select('nome, cargo, empresas(nome)')
        .eq('id', data.user.id)
        .single();
      if (u) {
        setUserInfo({
          nome: u.nome as string,
          cargo: u.cargo as string,
          empresa_nome: (u.empresas as { nome: string } | null)?.nome ?? '',
        });
      }
    });
  }, []);

  const { data: obrasAtivas } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM obras WHERE ativo = 1"
  );
  const { data: ncsAbertas } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM nao_conformidades WHERE status = 'aberta'"
  );
  const { data: verifsWeek } = useQuery<CountRow>(
    `SELECT COUNT(*) AS count FROM verificacoes WHERE date(data_verif) >= '${weekAgo()}'`
  );
  const { data: ncsHoje } = useQuery<CountRow>(
    `SELECT COUNT(*) AS count FROM nao_conformidades WHERE status = 'aberta' AND date(data_nova_verif) = '${today()}'`
  );

  const { data: ncsUrgentes } = useQuery<NcUrgentRow>(`
    SELECT n.id, vi.titulo AS item_titulo, a.nome AS ambiente_nome,
           o.nome AS obra_nome, n.data_nova_verif, n.prioridade
    FROM nao_conformidades n
    JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
    JOIN verificacoes v ON v.id = n.verificacao_id
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE n.status = 'aberta'
    ORDER BY n.data_nova_verif ASC
    LIMIT 3
  `);

  const { data: obrasProgresso } = useQuery<ObraProgressRow>(`
    SELECT o.id, o.nome, o.status,
           e.nome AS empresa_nome,
           COUNT(DISTINCT a.id) AS total_ambientes,
           COUNT(DISTINCT f.id) AS total_fvs,
           COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
           CAST(SUM(CASE f.status WHEN 'conforme' THEN 100 WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0) ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN empresas e ON e.id = o.empresa_id
    LEFT JOIN ambientes a ON a.obra_id = o.id
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.ativo = 1
    GROUP BY o.id, e.nome
    LIMIT 5
  `);

  const { data: verifsRecentes } = useQuery<VerifRecentRow>(`
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
    ORDER BY v.data_verif DESC
    LIMIT 3
  `);

  const kpis = useMemo(() => ({
    obrasAtivas: obrasAtivas[0]?.count ?? 0,
    ncsAbertas: ncsAbertas[0]?.count ?? 0,
    verifsWeek: verifsWeek[0]?.count ?? 0,
    ncsHoje: ncsHoje[0]?.count ?? 0,
  }), [obrasAtivas, ncsAbertas, verifsWeek, ncsHoje]);

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <AppHeader>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Olá, {userInfo?.nome?.split(' ')[0] ?? 'Inspetor'}</Text>
              <Text style={styles.headerSub}>
                {userInfo?.cargo ?? 'Inspetor de Campo'}
                {userInfo?.empresa_nome ? ` · ${userInfo.empresa_nome}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(app)/(tabs)/perfil' as never)} style={styles.avatar}>
              <Text style={styles.avatarText}>{userInfo ? initials(userInfo.nome) : 'IN'}</Text>
            </Pressable>
          </View>
        </AppHeader>

        {/* ── KPIs ── */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <KPICard label="Obras ativas"       value={kpis.obrasAtivas} color={Colors.progress}     bgColor={Colors.progressBg} />
            <KPICard label="NCs abertas"        value={kpis.ncsAbertas}  color={Colors.nok}          bgColor={Colors.nokBg} />
          </View>
          <View style={styles.kpiGrid}>
            <KPICard label="Verif. esta semana" value={kpis.verifsWeek}  color={Colors.textSecondary} bgColor={Colors.surface2} />
            <KPICard label="Vencendo hoje"      value={kpis.ncsHoje}     color={Colors.warn}         bgColor={Colors.warnBg} />
          </View>
        </View>

        {/* ── NCs Urgentes ── */}
        {ncsUrgentes.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>NÃO CONFORMIDADES URGENTES</Text>
                <Pressable onPress={() => router.push('/(app)/(tabs)/nc' as never)}>
                  <Text style={styles.sectionLink}>Ver todas</Text>
                </Pressable>
              </View>
              {ncsUrgentes.map(nc => {
                const badge = nc.data_nova_verif ? ncBadge(nc.data_nova_verif) : null;
                return (
                  <Pressable
                    key={nc.id}
                    style={({ pressed }) => [styles.ncCard, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push('/(app)/(tabs)/nc' as never)}
                  >
                    <View style={styles.ncCardTop}>
                      <Text style={styles.ncItem} numberOfLines={1}>{nc.item_titulo}</Text>
                      {badge && (
                        <View style={[styles.ncBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.ncBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.ncMeta}>
                      {nc.obra_nome}{nc.data_nova_verif ? ` · Prazo: ${new Date(nc.data_nova_verif).toLocaleDateString('pt-BR')}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── Minhas Obras ── */}
        {obrasProgresso.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MINHAS OBRAS</Text>
              {obrasProgresso.map(o => {
                const total = o.total_fvs ?? 0;
                const pctDone = o.progresso_percentual ?? 0;
                return (
                  <Pressable
                    key={o.id}
                    style={({ pressed }) => [styles.obraCard, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push(`/obras/${o.id}` as never)}
                  >
                    <View style={styles.obraCardTop}>
                      <Text style={styles.obraNome} numberOfLines={1}>{o.nome}</Text>
                      {o.status && <StatusBadge status={o.status as any} size="sm" />}
                    </View>
                    {(o.empresa_nome || (o.total_ambientes ?? 0) > 0) && (
                      <Text style={styles.obraMeta}>
                        {[o.empresa_nome, (o.total_ambientes ?? 0) > 0 ? `${o.total_ambientes} amb.` : null].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <View style={styles.obraProgressRow}>
                      <View style={{ flex: 1 }}>
                        <ProgressBar
                          value={pctDone}
                          height={7}
                          color={pctDone === 100 ? Colors.ok : Colors.brand}
                        />
                      </View>
                      <Text style={styles.obraFvs}>
                        {Math.round(pctDone)}% · {o.fvs_concluidas ?? 0}/{total} FVS
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── Atividade Recente ── */}
        {verifsRecentes.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={[styles.section, styles.lastSection]}>
              <Text style={styles.sectionTitle}>ATIVIDADE RECENTE</Text>
              {verifsRecentes.map(v => (
                <Pressable
                  key={v.id}
                  style={({ pressed }) => [styles.activityRow, pressed && { opacity: 0.75 }]}
                  onPress={() =>
                    router.push(
                      `/obras/${v.obra_id}/ambiente/${v.ambiente_id}/fvs/${v.fvs_planejada_id}` as never
                    )
                  }
                >
                  <View style={styles.activityLeft}>
                    <CheckCircle2 size={16} color={Colors.textTertiary} />
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{v.fvs_nome || 'Verificação'}</Text>
                    <Text style={styles.activityMeta}>
                      {v.obra_nome} · {v.ambiente_nome}
                      {'  •  '}{v.data_verif ? tempoRelativo(v.data_verif) : ''}
                    </Text>
                  </View>
                  <StatusBadge status={v.status as any} size="sm" />
                </Pressable>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerText: { flex: 1 },
  greeting:   { color: '#fff', fontSize: FontSizes.xl, fontWeight: '500' },
  headerSub:  { color: 'rgba(255,255,255,0.7)', fontSize: FontSizes.sm, marginTop: 2 },
  avatar: {
    width: 40, height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: FontSizes.base, fontWeight: '600' },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  lastSection: { paddingBottom: Spacing.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5 },
  sectionLink:   { fontSize: FontSizes.sm, color: Colors.brand, fontWeight: '500' },
  kpiGrid:       { flexDirection: 'row', gap: Spacing.sm },

  // NC cards
  ncCard: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(198,40,40,0.3)',
    gap: 4,
  },
  ncCardTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ncItem:        { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text, flex: 1 },
  ncBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  ncBadgeText:   { fontSize: FontSizes.tiny, fontWeight: '600' },
  ncMeta:        { fontSize: FontSizes.xs, color: Colors.textSecondary },

  // Obra cards
  obraCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  obraCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  obraNome:       { fontSize: FontSizes.base, fontWeight: '600', color: Colors.text, flex: 1 },
  obraMeta:       { fontSize: FontSizes.xs, color: Colors.textSecondary },
  obraProgressRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  obraFvs:        { fontSize: FontSizes.xs, color: Colors.textSecondary, whiteSpace: 'nowrap' as any },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  activityLeft:  { width: 24, alignItems: 'center' },
  activityBody:  { flex: 1 },
  activityTitle: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text },
  activityMeta:  { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
});
