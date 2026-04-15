import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Layers } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KPICard } from '../../../../../components/KPICard';
import { ProgressBar } from '../../../../../components/ProgressBar';
import { Colors, FontSizes, Radius, Spacing } from '../../../../../lib/constants';

type FilterKey = 'todos' | 'interno' | 'externo' | 'com_nc';

interface ObraRow { id: string; nome: string; municipio: string; uf: string; eng_responsavel: string }
interface KpiRow { total_ambientes: number; total_fvs: number; fvs_concluidas: number; ncs_abertas: number; progresso_percentual: number }
interface AmbienteRow {
  id: string; nome: string; tipo: string; localizacao: string;
  total_fvs: number; fvs_concluidas: number; ncs_abertas: number; progresso_percentual: number;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos',   label: 'Todos' },
  { key: 'interno', label: 'Interno' },
  { key: 'externo', label: 'Externo' },
  { key: 'com_nc',  label: 'Com NC' },
];

export default function ObraDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('todos');

  const { data: obraRows } = useQuery<ObraRow>(
    `SELECT id, nome, municipio, uf, eng_responsavel FROM obras WHERE id = ?`, [id]
  );
  const obra = obraRows[0];

  const { data: kpiRows } = useQuery<KpiRow>(`
    SELECT
      COUNT(DISTINCT a.id) AS total_ambientes,
      COUNT(DISTINCT f.id) AS total_fvs,
      COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
      (SELECT COUNT(*) FROM nao_conformidades n
       WHERE n.status = 'aberta' AND n.verificacao_id IN (
         SELECT v.id FROM verificacoes v
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a2 ON a2.id = fp.ambiente_id
         WHERE a2.obra_id = o.id
       )) AS ncs_abertas,
      CAST(SUM(CASE f.status WHEN 'conforme' THEN 100 WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0) ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.id = ?
  `, [id]);
  const kpi = kpiRows[0] ?? { total_ambientes: 0, total_fvs: 0, fvs_concluidas: 0, ncs_abertas: 0, progresso_percentual: 0 };

  const { data: ambientes } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao,
      COUNT(DISTINCT f.id) AS total_fvs,
      COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
      (SELECT COUNT(*) FROM nao_conformidades n
       WHERE n.status = 'aberta' AND n.verificacao_id IN (
         SELECT v.id FROM verificacoes v
         WHERE v.fvs_planejada_id IN (SELECT id FROM fvs_planejadas WHERE ambiente_id = a.id)
       )) AS ncs_abertas,
      CAST(SUM(CASE f.status WHEN 'conforme' THEN 100 WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0) ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
    FROM ambientes a
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE a.obra_id = ? AND a.ativo = 1
    GROUP BY a.id
    ORDER BY a.nome
  `, [id]);

  const filtered = useMemo(() => {
    if (filter === 'todos') return ambientes;
    if (filter === 'interno') return ambientes.filter(a => a.tipo === 'interno');
    if (filter === 'externo') return ambientes.filter(a => a.tipo === 'externo');
    if (filter === 'com_nc')  return ambientes.filter(a => a.ncs_abertas > 0);
    return ambientes;
  }, [ambientes, filter]);

  const totalProgress = kpi.progresso_percentual ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{obra?.nome ?? '—'}</Text>
          {obra?.municipio && (
            <Text style={styles.subtitle}>{obra.municipio}{obra.uf ? `, ${obra.uf}` : ''}</Text>
          )}
        </View>
      </View>

      {/* Progress panel */}
      <View style={styles.progressPanel}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progresso geral</Text>
          <Text style={styles.progressPct}>{Math.round(totalProgress)}%</Text>
        </View>
        <ProgressBar value={totalProgress} height={8} color={Colors.ok} />
        {obra?.eng_responsavel && (
          <Text style={styles.engText}>Resp.: {obra.eng_responsavel}</Text>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={styles.kpiSection}>
          <View style={styles.kpiGrid}>
            <KPICard label="Ambientes" value={kpi.total_ambientes} Icon={Layers} color={Colors.progress} />
            <KPICard label="FVS planejadas" value={kpi.total_fvs} color={Colors.na} />
          </View>
          <View style={styles.kpiGrid}>
            <KPICard label="Concluídas" value={kpi.fvs_concluidas} color={Colors.ok} />
            <KPICard label="NCs abertas" value={kpi.ncs_abertas} color={Colors.nok} />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Ambientes grid */}
        <View style={styles.grid}>
          {filtered.map(amb => {
            const pct = amb.progresso_percentual ?? 0;
            const borderColor = amb.tipo === 'interno' ? Colors.progress : Colors.ok;
            return (
              <Pressable
                key={amb.id}
                style={({ pressed }) => [styles.ambCard, { borderTopColor: borderColor }, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/obras/${id}/ambiente/${amb.id}` as never)}
              >
                <View style={styles.ambCardTop}>
                  <Text style={styles.ambNome} numberOfLines={2}>{amb.nome}</Text>
                  {amb.ncs_abertas > 0 && (
                    <View style={styles.ncPill}>
                      <Text style={styles.ncPillText}>{amb.ncs_abertas}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.ambTipo}>{amb.tipo === 'interno' ? 'Interno' : 'Externo'}</Text>
                {amb.localizacao ? <Text style={styles.ambLoc} numberOfLines={1}>{amb.localizacao}</Text> : null}
                <View style={styles.ambProgress}>
                  <ProgressBar value={pct} height={4} color={borderColor} />
                  <Text style={styles.ambPct}>{Math.round(pct)}%</Text>
                </View>
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum ambiente encontrado</Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  backBtn: { padding: 2 },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: FontSizes.xl, fontWeight: '500' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: FontSizes.sm, marginTop: 2 },
  progressPanel: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.textSecondary },
  progressPct: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.ok },
  engText: { fontSize: FontSizes.xs, color: Colors.textTertiary, marginTop: 2 },
  kpiSection: { padding: Spacing.lg, gap: Spacing.sm },
  kpiGrid: { flexDirection: 'row', gap: Spacing.sm },
  filterRow: { paddingLeft: Spacing.lg },
  filterContent: { gap: Spacing.xs, paddingRight: Spacing.lg, paddingBottom: Spacing.md },
  chip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { fontSize: FontSizes.base, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  ambCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderTopWidth: 3,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ambCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ambNome: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text, flex: 1 },
  ncPill: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  ncPillText: { fontSize: FontSizes.tiny, fontWeight: '700', color: Colors.nok },
  ambTipo: { fontSize: FontSizes.tiny, color: Colors.textTertiary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  ambLoc: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  ambProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  ambPct: { fontSize: FontSizes.tiny, color: Colors.textSecondary, minWidth: 24 },
  empty: { flex: 1, paddingVertical: Spacing.xxl, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.base, color: Colors.textTertiary },
});
