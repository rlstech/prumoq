import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Building2, CheckCircle2, ClipboardList, Clock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KPICard } from '../../../components/KPICard';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { ProgressBar } from '../../../components/ProgressBar';
import { StatusBadge } from '../../../components/StatusBadge';
import { Colors, Radius, Spacing } from '../../../lib/constants';
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

interface CountRow { count: number }
interface ObraProgressRow { id: string; nome: string; total_fvs: number; fvs_concluidas: number }
interface NcUrgentRow { id: string; item_titulo: string; ambiente_nome: string; obra_nome: string; data_nova_verif: string }
interface VerifRecentRow { id: string; status: string; data_verif: string; ambiente_nome: string; obra_nome: string; fvs_nome: string }
interface UsuarioRow { id: string; nome: string; cargo: string }

export default function DashboardScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
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
           o.nome AS obra_nome, n.data_nova_verif
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
    SELECT o.id, o.nome,
           COUNT(DISTINCT f.id) AS total_fvs,
           COUNT(DISTINCT f2.id) AS fvs_concluidas
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    LEFT JOIN fvs_planejadas f2 ON f2.ambiente_id = a.id AND f2.status = 'conforme'
    WHERE o.ativo = 1
    GROUP BY o.id
    LIMIT 5
  `);

  const { data: verifsRecentes } = useQuery<VerifRecentRow>(`
    SELECT v.id, v.status, v.data_verif,
           a.nome AS ambiente_nome, o.nome AS obra_nome,
           fp.subservico AS fvs_nome
    FROM verificacoes v
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    ORDER BY v.data_verif DESC
    LIMIT 3
  `);

  const { data: usuarioRows } = useQuery<UsuarioRow>(
    userId ? `SELECT id, nome, cargo FROM usuarios LIMIT 1` : `SELECT id, nome, cargo FROM usuarios WHERE 1=0`
  );

  const usuario = usuarioRows[0];

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Olá, {usuario?.nome?.split(' ')[0] ?? 'Inspetor'}</Text>
            <Text style={styles.headerSub}>PrumoQ · Painel do Inspetor</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{usuario ? initials(usuario.nome) : 'IN'}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <KPICard label="Obras ativas" value={kpis.obrasAtivas} Icon={Building2} color={Colors.progress} />
            <KPICard label="NCs abertas" value={kpis.ncsAbertas} Icon={AlertTriangle} color={Colors.nok} />
          </View>
          <View style={styles.kpiGrid}>
            <KPICard label="Verificações (7d)" value={kpis.verifsWeek} Icon={ClipboardList} color={Colors.ok} />
            <KPICard label="Vencendo hoje" value={kpis.ncsHoje} Icon={Clock} color={Colors.warn} />
          </View>
        </View>

        {/* Urgent NCs */}
        {ncsUrgentes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NCs URGENTES</Text>
              <Pressable onPress={() => router.push('/(app)/(tabs)/nc' as never)}>
                <Text style={styles.sectionLink}>Ver todas</Text>
              </Pressable>
            </View>
            {ncsUrgentes.map(nc => (
              <View key={nc.id} style={styles.ncCard}>
                <Text style={styles.ncItem} numberOfLines={1}>{nc.item_titulo}</Text>
                <Text style={styles.ncMeta}>{nc.obra_nome} · {nc.ambiente_nome}</Text>
                {nc.data_nova_verif && (
                  <View style={styles.ncDeadline}>
                    <Clock size={10} color={Colors.warn} />
                    <Text style={styles.ncDeadlineText}>
                      {new Date(nc.data_nova_verif).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Obras com progresso */}
        {obrasProgresso.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OBRAS ATIVAS</Text>
            {obrasProgresso.map(o => {
              const pct = o.total_fvs > 0 ? (o.fvs_concluidas / o.total_fvs) * 100 : 0;
              return (
                <Pressable
                  key={o.id}
                  style={({ pressed }) => [styles.obraCard, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push(`/obras/${o.id}` as never)}
                >
                  <View style={styles.obraCardTop}>
                    <Text style={styles.obraNome} numberOfLines={1}>{o.nome}</Text>
                    <Text style={styles.obraPct}>{Math.round(pct)}%</Text>
                  </View>
                  <ProgressBar value={pct} height={5} color={Colors.ok} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Atividade recente */}
        {verifsRecentes.length > 0 && (
          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>ATIVIDADE RECENTE</Text>
            {verifsRecentes.map(v => (
              <View key={v.id} style={styles.activityRow}>
                <View style={styles.activityLeft}>
                  <CheckCircle2 size={16} color={Colors.textTertiary} />
                </View>
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{v.fvs_nome || 'Verificação'}</Text>
                  <Text style={styles.activityMeta}>{v.obra_nome} · {v.ambiente_nome}</Text>
                </View>
                <StatusBadge status={v.status as any} size="sm" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  headerText: { flex: 1 },
  greeting: { color: '#fff', fontSize: 19, fontWeight: '500' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  lastSection: { paddingBottom: Spacing.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  sectionLink: { fontSize: 12, color: Colors.brand, fontWeight: '500' },
  kpiGrid: { flexDirection: 'row', gap: Spacing.sm },
  ncCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.nok,
    gap: 4,
  },
  ncItem: { fontSize: 13, fontWeight: '500', color: Colors.text },
  ncMeta: { fontSize: 11, color: Colors.textSecondary },
  ncDeadline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ncDeadlineText: { fontSize: 11, color: Colors.warn, fontWeight: '500' },
  obraCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  obraCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  obraNome: { fontSize: 13, fontWeight: '500', color: Colors.text, flex: 1 },
  obraPct: { fontSize: 12, color: Colors.textSecondary, marginLeft: Spacing.sm },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  activityLeft: { width: 24, alignItems: 'center' },
  activityBody: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '500', color: Colors.text },
  activityMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});
