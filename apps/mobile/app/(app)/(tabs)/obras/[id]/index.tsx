import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Layers3,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppHeader } from '../../../../../components/AppHeader';
import {
  Chip,
  type DatumTone,
  EmptyState,
  ListSurface,
  OperationalRow,
  Progress,
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

  const progress = kpi.progresso_percentual ?? 0;
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.summary}>
          <View style={styles.summaryHeading}>
            <Text style={styles.summaryTitle}>Progresso da obra</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryPercent}>{Math.round(progress)}</Text>
              <Text style={styles.summarySuffix}>%</Text>
            </View>
          </View>

          <Progress
            value={progress}
            tone={kpi.ncs_abertas > 0 ? 'danger' : progress === 100 ? 'success' : 'brand'}
            height={5}
          />

          <View style={styles.summaryMeta}>
            <Text style={styles.summaryMetaText}>
              <Text style={styles.summaryMetaValue}>{kpi.fvs_concluidas}/{kpi.total_fvs}</Text>
              {' FVS concluídas'}
            </Text>
            <View style={styles.metaDot} />
            <Text style={styles.summaryMetaText}>
              {kpi.total_ambientes} {kpi.total_ambientes === 1 ? 'ambiente' : 'ambientes'}
            </Text>
            <View style={styles.metaDot} />
            <Text style={[
              styles.summaryMetaText,
              kpi.ncs_abertas > 0 && styles.summaryMetaDanger,
            ]}>
              {kpi.ncs_abertas} NC {kpi.ncs_abertas === 1 ? 'aberta' : 'abertas'}
            </Text>
          </View>

          {obra?.eng_responsavel ? (
            <View style={styles.engineer}>
              <UserRound size={14} color={Colors.textTertiary} />
              <Text style={styles.engineerText} numberOfLines={1}>
                {obra.eng_responsavel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Ambientes</Text>
          <Text style={styles.listCount}>
            {filtered.length}{filter === 'todos' ? '' : ` de ${ambientes.length}`}
          </Text>
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

        {filtered.length > 0 ? (
          <ListSurface>
            {filtered.map((item, index) => {
              const itemProgress = item.progresso_percentual ?? 0;
              const hasNc = item.ncs_abertas > 0;
              const noFvs = item.total_fvs === 0;
              const isComplete = !noFvs && item.fvs_concluidas >= item.total_fvs;
              const tone: DatumTone = hasNc
                ? 'danger'
                : isComplete
                  ? 'success'
                  : noFvs
                    ? 'neutral'
                    : 'info';
              const stateLabel = hasNc
                ? `${item.ncs_abertas} NC ${item.ncs_abertas === 1 ? 'aberta' : 'abertas'}`
                : isComplete
                  ? 'Concluído'
                  : noFvs
                    ? 'Sem serviços planejados'
                    : 'Em curso';
              const stateColor = hasNc
                ? Colors.nok
                : isComplete
                  ? Colors.ok
                  : noFvs
                    ? Colors.textTertiary
                    : Colors.info;

              return (
                <OperationalRow
                  key={item.id}
                  tone={tone}
                  last={index === filtered.length - 1}
                  accessibilityLabel={`Abrir ambiente ${item.nome}, ${stateLabel}`}
                  onPress={() => router.push(`/obras/${id}/ambiente/${item.id}` as never)}
                  trailing={<ChevronRight size={19} color={Colors.textTertiary} />}
                >
                  <View style={[styles.rowContent, isTablet && styles.rowContentTablet]}>
                    <View style={styles.identity}>
                      <Text style={styles.environmentName} numberOfLines={2}>
                        {item.nome}
                      </Text>
                      <Text style={styles.environmentMeta} numberOfLines={1}>
                        {item.tipo === 'interno' ? 'Interno' : 'Externo'}
                        {item.localizacao ? ` · ${item.localizacao}` : ''}
                      </Text>
                    </View>

                    <View style={[styles.progressColumn, isTablet && styles.progressColumnTablet]}>
                      <View style={styles.progressHeading}>
                        <Text style={styles.fvsCount}>
                          {item.fvs_concluidas}/{item.total_fvs}
                        </Text>
                        <Text style={styles.fvsLabel}> FVS</Text>
                        <Text style={styles.progressLabel}>{Math.round(itemProgress)}%</Text>
                      </View>
                      <Progress
                        value={itemProgress}
                        tone={hasNc ? 'danger' : isComplete ? 'success' : noFvs ? 'neutral' : 'info'}
                        height={4}
                      />
                    </View>

                    <View style={[styles.state, isTablet && styles.stateTablet]}>
                      {hasNc ? (
                        <AlertTriangle size={14} color={Colors.nok} />
                      ) : isComplete ? (
                        <CheckCircle2 size={14} color={Colors.ok} />
                      ) : null}
                      <Text style={[styles.stateText, { color: stateColor }]} numberOfLines={1}>
                        {stateLabel}
                      </Text>
                    </View>
                  </View>
                </OperationalRow>
              );
            })}
          </ListSurface>
        ) : (
          <View style={styles.emptySurface}>
            <EmptyState
              Icon={Layers3}
              title="Nenhum ambiente neste filtro"
              description="Selecione outro filtro para visualizar os ambientes da obra."
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: 104,
    gap: Spacing.lg,
  },
  summary: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  summaryTitle: { ...Typography.label, color: Colors.text },
  summaryValue: { flexDirection: 'row', alignItems: 'baseline' },
  summaryPercent: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xxl,
    lineHeight: 30,
    color: Colors.brand,
  },
  summarySuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xs,
    color: Colors.brand,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryMetaText: { ...Typography.caption, color: Colors.textSecondary },
  summaryMetaValue: { fontFamily: FontFamily.monoSemibold, color: Colors.text },
  summaryMetaDanger: { color: Colors.nok, fontFamily: FontFamily.medium },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderNormal,
  },
  engineer: {
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineerText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  listHeading: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  listTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xl,
    lineHeight: 28,
    color: Colors.text,
  },
  listCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  filters: { gap: Spacing.sm, paddingRight: Spacing.lg },
  rowContent: { gap: Spacing.md },
  rowContentTablet: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  environmentName: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
    lineHeight: 22,
    color: Colors.text,
  },
  environmentMeta: { ...Typography.caption, color: Colors.textSecondary },
  progressColumn: { gap: 6 },
  progressColumnTablet: { width: 230 },
  progressHeading: { flexDirection: 'row', alignItems: 'baseline' },
  fvsCount: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  fvsLabel: { ...Typography.caption, color: Colors.textSecondary },
  progressLabel: {
    marginLeft: 'auto',
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  state: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateTablet: { width: 160 },
  stateText: { ...Typography.caption, fontFamily: FontFamily.medium, flexShrink: 1 },
  emptySurface: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
