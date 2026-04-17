import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '../../../../../components/AppHeader';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../../../../../lib/constants';

type FilterKey = 'todos' | 'interno' | 'externo' | 'com_nc';

interface ObraRow {
  id: string; nome: string; municipio: string; uf: string; eng_responsavel: string;
}
interface KpiRow {
  total_ambientes: number; total_fvs: number; fvs_concluidas: number;
  ncs_abertas: number; progresso_percentual: number;
}
interface AmbienteRow {
  id: string; nome: string; tipo: string; localizacao: string;
  total_fvs: number; fvs_concluidas: number; ncs_abertas: number; progresso_percentual: number;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos',   label: 'Todos' },
  { key: 'interno', label: 'Internos' },
  { key: 'externo', label: 'Externos' },
  { key: 'com_nc',  label: 'Com NC' },
];

function ProgRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={pr.row}>
      <Text style={pr.lbl}>{label}</Text>
      <View style={pr.track}>
        <View style={[pr.fill, { width: `${Math.min(Math.max(value, 0), 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={pr.val}>{Math.round(value)}%</Text>
    </View>
  );
}
const pr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  lbl:   { fontSize: FontSizes.tiny - 1, color: Colors.textSecondary, width: 72 },
  track: { flex: 1, height: 6, backgroundColor: '#F1EFE8', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
  val:   { fontSize: FontSizes.tiny - 1, fontWeight: '500', color: Colors.text, width: 32, textAlign: 'right' },
});

function KpiMini({
  label, value, bg, color,
}: { label: string; value: number; bg: string; color: string }) {
  return (
    <View style={[km.card, { backgroundColor: bg }]}>
      <Text style={[km.val, { color }]}>{value}</Text>
      <Text style={[km.lbl, { color }]}>{label}</Text>
    </View>
  );
}
const km = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', borderRadius: Radius.sm, paddingVertical: 9, paddingHorizontal: 4 },
  val:  { fontSize: FontSizes.lg, fontWeight: '500' },
  lbl:  { fontSize: FontSizes.tiny - 1, marginTop: 2 },
});

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
      CAST(SUM(CASE f.status
        WHEN 'conforme'    THEN 100
        WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
        ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.id = ?
  `, [id]);
  const kpi = kpiRows[0] ?? {
    total_ambientes: 0, total_fvs: 0, fvs_concluidas: 0, ncs_abertas: 0, progresso_percentual: 0,
  };

  const { data: ambientes } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao,
      COUNT(DISTINCT f.id) AS total_fvs,
      COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
      (SELECT COUNT(*) FROM nao_conformidades n
       WHERE n.status = 'aberta' AND n.verificacao_id IN (
         SELECT v.id FROM verificacoes v
         WHERE v.fvs_planejada_id IN (SELECT id FROM fvs_planejadas WHERE ambiente_id = a.id)
       )) AS ncs_abertas,
      CAST(SUM(CASE f.status
        WHEN 'conforme'    THEN 100
        WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0)
        ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual
    FROM ambientes a
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE a.obra_id = ? AND a.ativo = 1
    GROUP BY a.id
    ORDER BY a.nome
  `, [id]);

  const filtered = useMemo(() => {
    if (filter === 'todos')   return ambientes;
    if (filter === 'interno') return ambientes.filter(a => a.tipo === 'interno');
    if (filter === 'externo') return ambientes.filter(a => a.tipo === 'externo');
    if (filter === 'com_nc')  return ambientes.filter(a => a.ncs_abertas > 0);
    return ambientes;
  }, [ambientes, filter]);

  const totalPct    = kpi.progresso_percentual ?? 0;
  const conformesPct = kpi.total_fvs > 0 ? (kpi.fvs_concluidas / kpi.total_fvs * 100) : 0;
  const ncPct       = Math.min((kpi.ncs_abertas / Math.max(kpi.total_ambientes, 1)) * 50, 100);

  const locationText = obra?.municipio
    ? `${obra.municipio}${obra.uf ? `, ${obra.uf}` : ''}`
    : null;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <AppHeader
        title={obra?.nome ?? '—'}
        subtitle={locationText || undefined}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Info panel (.oh) */}
        <View style={s.infoPanel}>
          <Text style={s.infoPanelTitle}>{obra?.nome ?? '—'}</Text>
          {locationText ? <Text style={s.infoPanelLocation}>{locationText}</Text> : null}
          <ProgRow label="FVS totais"  value={totalPct}     color={Colors.brand} />
          <ProgRow label="Conformes"   value={conformesPct} color={Colors.ok} />
          <ProgRow label="NC abertas"  value={ncPct}        color={Colors.nok} />
        </View>

        {/* KPI row — 4 columns */}
        <View style={s.kpiRow}>
          <KpiMini label="Ambientes"  value={kpi.total_ambientes}  bg={Colors.surface2} color={Colors.text} />
          <KpiMini label="FVS plan."  value={kpi.total_fvs}        bg={Colors.surface2} color={Colors.text} />
          <KpiMini label="Concluídas" value={kpi.fvs_concluidas}   bg={Colors.okBg}     color={Colors.ok} />
          <KpiMini label="NC abertas" value={kpi.ncs_abertas}      bg={Colors.nokBg}    color={Colors.nok} />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
          contentContainerStyle={s.filterContent}
        >
          {FILTERS.map(f => {
            const isActive = filter === f.key;
            const isNcFilter = f.key === 'com_nc';
            return (
              <Pressable
                key={f.key}
                style={[
                  s.chip,
                  isActive && (isNcFilter ? s.chipNok : s.chipActive),
                ]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.chipText, isActive && s.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section header */}
        <Text style={s.sectionLabel}>AMBIENTES</Text>

        {/* Ambiente list */}
        <View style={s.ambList}>
          {filtered.map(amb => {
            const pct      = amb.progresso_percentual ?? 0;
            const hasNc    = amb.ncs_abertas > 0;
            const isDone   = amb.total_fvs > 0 && amb.fvs_concluidas >= amb.total_fvs;
            const noFvs    = amb.total_fvs === 0;

            const borderColor = hasNc
              ? Colors.nok
              : amb.tipo === 'interno' ? Colors.progress : Colors.ok;

            const barColor = hasNc ? Colors.nok : (isDone ? Colors.ok : Colors.progress);

            const badgeBg = hasNc  ? Colors.nokBg
              : isDone             ? Colors.okBg
              : noFvs              ? Colors.naBg
              :                      Colors.progressBg;
            const badgeColor = hasNc ? Colors.nok
              : isDone               ? Colors.ok
              : noFvs                ? Colors.na
              :                        Colors.progress;
            const badgeText = hasNc
              ? `${amb.fvs_concluidas}/${amb.total_fvs} · NC`
              : `${amb.fvs_concluidas}/${amb.total_fvs} FVS`;

            const isInterno = amb.tipo === 'interno';

            return (
              <Pressable
                key={amb.id}
                style={({ pressed }) => [
                  s.ambCard,
                  { borderLeftColor: borderColor },
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => router.push(`/obras/${id}/ambiente/${amb.id}` as never)}
              >
                {/* Top row */}
                <View style={s.ambTop}>
                  <View style={s.ambLeft}>
                    <Text style={s.ambNome} numberOfLines={1}>{amb.nome}</Text>
                    <View style={s.ambMeta}>
                      <View style={[s.tipoTag, isInterno ? s.tipoInt : s.tipoExt]}>
                        <Text style={[s.tipoText, isInterno ? s.tipoIntText : s.tipoExtText]}>
                          {isInterno ? 'Interno' : 'Externo'}
                        </Text>
                      </View>
                      {amb.localizacao ? (
                        <Text style={s.locText} numberOfLines={1}>{amb.localizacao}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[s.fvsBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[s.fvsBadgeText, { color: badgeColor }]}>{badgeText}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.min(Math.max(pct, 0), 100)}%` as any, backgroundColor: barColor }]} />
                </View>
              </Pressable>
            );
          })}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhum ambiente encontrado</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },


  // Info panel
  infoPanel: {
    backgroundColor: Colors.brandLight,
    borderRadius: Radius.lg,
    padding: 13,
    margin: Spacing.lg,
    marginBottom: 0,
  },
  infoPanelTitle:    { fontSize: FontSizes.base, fontWeight: '500', color: Colors.brand },
  infoPanelLocation: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },

  // KPI row
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },

  // Filter chips
  filterScroll:  { marginTop: Spacing.md, paddingLeft: Spacing.lg },
  filterContent: { gap: Spacing.xs, paddingRight: Spacing.lg, paddingBottom: 4 },
  chip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
  },
  chipActive:     { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipNok:        { backgroundColor: Colors.nok, borderColor: Colors.nok },
  chipText:       { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  // Section label
  sectionLabel: {
    fontSize: FontSizes.tiny - 1,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Ambiente list
  ambList: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  ambCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  ambTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  ambLeft: { flex: 1, marginRight: Spacing.sm },
  ambNome: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text },
  ambMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },

  tipoTag:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  tipoInt:      { backgroundColor: Colors.progressBg },
  tipoExt:      { backgroundColor: Colors.okBg },
  tipoText:     { fontSize: FontSizes.tiny - 1, fontWeight: '500' },
  tipoIntText:  { color: Colors.progress },
  tipoExtText:  { color: Colors.ok },

  locText: { fontSize: FontSizes.tiny, color: Colors.textSecondary },

  fvsBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  fvsBadgeText: { fontSize: FontSizes.tiny - 1, fontWeight: '600' },

  barTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 2 },

  empty:     { paddingVertical: Spacing.xxl, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.base, color: Colors.textTertiary },
});
