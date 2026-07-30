import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Layers3,
  MapPin,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppHeader } from '../../../../../components/AppHeader';
import {
  Badge,
  Chip,
  DatumCard,
  EmptyState,
  MetricBlock,
  Progress,
  SectionTitle,
  type DatumTone,
} from '../../../../../components/ui';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../../lib/constants';
import { goBack } from '../../../../../lib/navigation';

type FilterKey = 'todos' | 'interno' | 'externo' | 'com_nc';

interface ObraRow {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  eng_responsavel: string;
}

interface KpiRow {
  total_ambientes: number;
  total_fvs: number;
  fvs_concluidas: number;
  ncs_abertas: number;
  progresso_percentual: number;
}

interface AmbienteRow {
  id: string;
  nome: string;
  tipo: string;
  localizacao: string;
  total_fvs: number;
  fvs_concluidas: number;
  ncs_abertas: number;
  progresso_percentual: number;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'interno', label: 'Internos' },
  { key: 'externo', label: 'Externos' },
  { key: 'com_nc', label: 'Com NC' },
];

export default function ObraDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const columns = isTablet ? 2 : 1;
  const [filter, setFilter] = useState<FilterKey>('todos');

  const { data: obraRows } = useQuery<ObraRow>(
    'SELECT id, nome, municipio, uf, eng_responsavel FROM obras WHERE id = ?',
    [id]
  );
  const obra = obraRows[0];

  const { data: kpiRows } = useQuery<KpiRow>(`
    SELECT
      COUNT(DISTINCT a.id) AS total_ambientes,
      COUNT(DISTINCT f.id) AS total_fvs,
      COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
      (SELECT COUNT(*) FROM nao_conformidades n
       WHERE n.status IN ('aberta','em_correcao') AND n.verificacao_id IN (
         SELECT v.id FROM verificacoes v
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a2 ON a2.id = fp.ambiente_id
         WHERE a2.obra_id = o.id
           AND a2.ativo = 1
       )) AS ncs_abertas,
      COALESCE(CAST(COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS REAL) * 100
        / NULLIF(COUNT(DISTINCT f.id), 0), 0) AS progresso_percentual
    FROM obras o
    LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = 1
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE o.id = ?
  `, [id]);

  const kpi = kpiRows[0] ?? {
    total_ambientes: 0,
    total_fvs: 0,
    fvs_concluidas: 0,
    ncs_abertas: 0,
    progresso_percentual: 0,
  };

  const { data: ambientes } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao,
      COUNT(DISTINCT f.id) AS total_fvs,
      COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
      (SELECT COUNT(*) FROM nao_conformidades n
       WHERE n.status IN ('aberta','em_correcao') AND n.verificacao_id IN (
         SELECT v.id FROM verificacoes v
         WHERE v.fvs_planejada_id IN (SELECT id FROM fvs_planejadas WHERE ambiente_id = a.id)
       )) AS ncs_abertas,
      COALESCE(CAST(COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS REAL) * 100
        / NULLIF(COUNT(DISTINCT f.id), 0), 0) AS progresso_percentual
    FROM ambientes a
    LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
    WHERE a.obra_id = ? AND a.ativo = 1
    GROUP BY a.id
    ORDER BY a.nome
  `, [id]);

  const filtered = useMemo(() => {
    if (filter === 'interno') return ambientes.filter(ambiente => ambiente.tipo === 'interno');
    if (filter === 'externo') return ambientes.filter(ambiente => ambiente.tipo === 'externo');
    if (filter === 'com_nc') return ambientes.filter(ambiente => ambiente.ncs_abertas > 0);
    return ambientes;
  }, [ambientes, filter]);

  const totalProgress = kpi.progresso_percentual ?? 0;
  const location = obra?.municipio
    ? `${obra.municipio}${obra.uf ? `, ${obra.uf}` : ''}`
    : 'Local não informado';

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={obra?.nome ?? 'Obra'}
        subtitle={location}
        showBack
        onBack={() => goBack('/(app)/(tabs)/obras')}
      />

      <FlatList
        key={columns}
        data={filtered}
        numColumns={columns}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={[styles.overviewGrid, isTablet && styles.overviewGridTablet]}>
              <View style={[styles.hero, isTablet && styles.heroTablet]}>
                <Text style={styles.heroEyebrow}>PRANCHA OPERACIONAL</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{Math.round(totalProgress)}</Text>
                  <Text style={styles.heroSuffix}>%</Text>
                </View>
                <Text style={styles.heroCaption}>avanço ponderado da obra</Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(totalProgress) }}
                  style={styles.heroProgressTrack}
                >
                  <View
                    style={[
                      styles.heroProgressFill,
                      { width: `${Math.min(Math.max(totalProgress, 0), 100)}%` as `${number}%` },
                    ]}
                  />
                </View>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <MapPin size={15} color={Colors.brandSignature} style={styles.heroMetaIcon} />
                    <View style={styles.heroMetaField}>
                      <Text style={styles.heroMetaLabel}>LOCALIDADE</Text>
                      <Text style={styles.heroMetaText} numberOfLines={1}>{location}</Text>
                    </View>
                  </View>
                  {obra?.eng_responsavel ? (
                    <View style={styles.heroMetaItem}>
                      <UserRound size={15} color={Colors.brandSignature} style={styles.heroMetaIcon} />
                      <View style={styles.heroMetaField}>
                        <Text style={styles.heroMetaLabel}>ENGENHEIRO RESPONSÁVEL</Text>
                        <Text style={styles.heroMetaText} numberOfLines={1}>
                          {obra.eng_responsavel}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              <DatumCard
                tone={kpi.ncs_abertas > 0 ? 'danger' : 'accent'}
                style={[styles.operationCard, isTablet && styles.operationCardTablet]}
              >
                <Text style={styles.operationEyebrow}>CONTROLE DE QUALIDADE</Text>
                <View style={styles.metricsRow}>
                  <MetricBlock label="AMBIENTES" value={kpi.total_ambientes} />
                  <View style={styles.metricDivider} />
                  <MetricBlock label="FVS PLANEJADAS" value={kpi.total_fvs} />
                  <View style={styles.metricDivider} />
                  <MetricBlock
                    label="CONCLUÍDAS"
                    value={kpi.fvs_concluidas}
                    tone="success"
                  />
                </View>
                <View style={[
                  styles.ncSummary,
                  kpi.ncs_abertas > 0 ? styles.ncSummaryDanger : styles.ncSummaryOk,
                ]}>
                  {kpi.ncs_abertas > 0 ? (
                    <AlertTriangle size={18} color={Colors.nok} />
                  ) : (
                    <CheckCircle2 size={18} color={Colors.ok} />
                  )}
                  <View style={styles.ncSummaryText}>
                    <Text style={[
                      styles.ncSummaryTitle,
                      { color: kpi.ncs_abertas > 0 ? Colors.nok : Colors.ok },
                    ]}>
                      {kpi.ncs_abertas > 0
                        ? `${kpi.ncs_abertas} NC ${kpi.ncs_abertas === 1 ? 'aberta' : 'abertas'}`
                        : 'Nenhuma NC aberta'}
                    </Text>
                    <Text style={styles.ncSummaryCaption}>
                      {kpi.ncs_abertas > 0
                        ? 'Priorize os ambientes sinalizados abaixo.'
                        : 'A obra está sem pendências de conformidade.'}
                    </Text>
                  </View>
                </View>
              </DatumCard>
            </View>

            <View style={styles.sectionHeading}>
              <SectionTitle
                eyebrow="PLANO DE INSPEÇÃO"
                title="Ambientes"
                description={`${filtered.length} de ${ambientes.length} ambientes exibidos`}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map(option => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={filter === option.key}
                  onPress={() => setFilter(option.key)}
                  Icon={option.key === 'com_nc' ? AlertTriangle : undefined}
                />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const progress = item.progresso_percentual ?? 0;
          const hasNc = item.ncs_abertas > 0;
          const noFvs = item.total_fvs === 0;
          const isComplete = !noFvs && item.fvs_concluidas >= item.total_fvs;
          const tone: DatumTone = hasNc ? 'danger' : isComplete ? 'success' : noFvs ? 'neutral' : 'info';
          const progressTone = hasNc ? 'danger' : isComplete ? 'success' : noFvs ? 'neutral' : 'info';
          const stateLabel = hasNc
            ? `${item.ncs_abertas} NC ${item.ncs_abertas === 1 ? 'aberta' : 'abertas'}`
            : isComplete
              ? 'Concluído'
              : noFvs
                ? 'Sem FVS'
                : 'Em curso';

          return (
            <DatumCard
              tone={tone}
              style={styles.ambienteCard}
              accessibilityLabel={`Abrir ambiente ${item.nome}`}
              onPress={() => router.push(`/obras/${id}/ambiente/${item.id}` as never)}
            >
              <View style={styles.ambienteTop}>
                <View style={styles.ambienteIdentity}>
                  <Text style={styles.ambienteName} numberOfLines={2}>{item.nome}</Text>
                  <View style={styles.ambienteMeta}>
                    <Badge
                      label={item.tipo === 'interno' ? 'Interno' : 'Externo'}
                      tone={item.tipo === 'interno' ? 'info' : 'success'}
                      size="sm"
                    />
                    {item.localizacao ? (
                      <Text style={styles.ambienteLocation} numberOfLines={1}>
                        {item.localizacao}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.ambienteProgressValue}>
                  <Text style={styles.ambientePercent}>{Math.round(progress)}</Text>
                  <Text style={styles.ambientePercentSuffix}>%</Text>
                </View>
              </View>

              <Progress value={progress} tone={progressTone} height={6} />

              <View style={styles.ambienteFooter}>
                <View style={styles.ambienteState}>
                  {hasNc ? <AlertTriangle size={14} color={Colors.nok} /> : null}
                  <Text style={[
                    styles.ambienteStateText,
                    { color: hasNc ? Colors.nok : isComplete ? Colors.ok : Colors.textSecondary },
                  ]}>
                    {stateLabel}
                  </Text>
                </View>
                <View style={styles.ambienteCount}>
                  <Text style={styles.ambienteCountValue}>{item.fvs_concluidas}</Text>
                  <Text style={styles.ambienteCountText}> / {item.total_fvs} FVS</Text>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </View>
              </View>
            </DatumCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            Icon={Layers3}
            title="Nenhum ambiente neste filtro"
            description="Selecione outro filtro para visualizar os ambientes da obra."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 104,
  },
  columns: { gap: Spacing.md },
  headerContent: { gap: Spacing.xxl, marginBottom: Spacing.xs },
  overviewGrid: { gap: Spacing.md },
  overviewGridTablet: { flexDirection: 'row', alignItems: 'stretch' },
  hero: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.brand,
    padding: Spacing.xxl,
    gap: Spacing.xs,
  },
  heroTablet: { flex: 0.9, minWidth: 280 },
  heroEyebrow: { ...Typography.overline, color: Colors.brandSignature },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroValue: {
    color: Colors.surface,
    fontFamily: FontFamily.monoSemibold,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.8,
  },
  heroSuffix: {
    color: Colors.brandSignature,
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.lg,
  },
  heroCaption: { ...Typography.caption, color: Colors.surface, opacity: 0.72 },
  heroProgressTrack: {
    height: 8,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.brandSignature,
  },
  heroMeta: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    gap: Spacing.sm,
  },
  heroMetaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  heroMetaIcon: { marginTop: 1 },
  heroMetaField: { flex: 1, gap: 1 },
  heroMetaLabel: { ...Typography.overline, color: Colors.brandSignature },
  heroMetaText: { ...Typography.caption, color: Colors.surface },
  operationCard: { minWidth: 0 },
  operationCardTablet: { flex: 1.35 },
  operationEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  metricsRow: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  metricDivider: { width: 1, height: 48, backgroundColor: Colors.border },
  ncSummary: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  ncSummaryDanger: { backgroundColor: Colors.nokBg, borderColor: Colors.nok },
  ncSummaryOk: { backgroundColor: Colors.okBg, borderColor: Colors.ok },
  ncSummaryText: { flex: 1, gap: 2 },
  ncSummaryTitle: { ...Typography.label },
  ncSummaryCaption: { ...Typography.caption, color: Colors.textSecondary },
  sectionHeading: { paddingTop: Spacing.sm },
  filters: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  ambienteCard: { flex: 1 },
  ambienteTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  ambienteIdentity: { flex: 1, gap: Spacing.sm },
  ambienteName: { ...Typography.heading, color: Colors.text },
  ambienteMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ambienteLocation: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  ambienteProgressValue: { flexDirection: 'row', alignItems: 'baseline' },
  ambientePercent: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xxl,
    lineHeight: 34,
    color: Colors.brand,
  },
  ambientePercentSuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.brand,
  },
  ambienteFooter: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  ambienteState: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  ambienteStateText: { ...Typography.caption, fontFamily: FontFamily.medium },
  ambienteCount: { flexDirection: 'row', alignItems: 'center' },
  ambienteCountValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  ambienteCountText: { ...Typography.caption, color: Colors.textSecondary },
});
