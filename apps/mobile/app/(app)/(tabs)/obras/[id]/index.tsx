import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Layers3, Search, UserRound, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../../components/AppHeader';
import { IconBox } from '../../../../../components/IconBox';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  ListSurface,
  OperationalRow,
  SegmentedControl,
  Skeleton,
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

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'interno', label: 'Internos' },
  { value: 'externo', label: 'Externos' },
  { value: 'com_nc', label: 'Com NC' },
];

function grupoTipo(tipo: string): 'interno' | 'externo' {
  return tipo === 'interno' ? 'interno' : 'externo';
}

const GRUPOS: { key: 'interno' | 'externo'; title: string }[] = [
  { key: 'interno', title: 'Internos' },
  { key: 'externo', title: 'Externos' },
];

const TIPO_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  interno: { label: 'Interno', tone: 'info' },
  externo: { label: 'Externo', tone: 'neutral' },
};

function estadoDoAmbiente(item: AmbienteRow): {
  label: string;
  color: string;
  tone: DatumTone;
} {
  const hasNc = item.ncs_abertas > 0;
  const noFvs = (item.total_fvs ?? 0) === 0;
  const isComplete = !noFvs && (item.fvs_concluidas ?? 0) >= item.total_fvs;

  if (hasNc) {
    return {
      label: `${item.ncs_abertas} NC ${item.ncs_abertas === 1 ? 'aberta' : 'abertas'}`,
      color: Colors.nok,
      tone: 'danger',
    };
  }
  if (isComplete) return { label: 'Concluído', color: Colors.ok, tone: 'success' };
  if (noFvs) {
    return { label: 'Sem serviços planejados', color: Colors.textTertiary, tone: 'neutral' };
  }
  return { label: 'Em curso', color: Colors.info, tone: 'info' };
}

export default function ObraDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');

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

  const {
    data: ambientes,
    isLoading,
    error,
  } = useQuery<AmbienteRow>(`
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
    let list = ambientes;
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        ambiente =>
          ambiente.nome.toLowerCase().includes(query) ||
          ambiente.localizacao?.toLowerCase().includes(query)
      );
    }
    if (filter === 'interno') return list.filter(ambiente => ambiente.tipo === 'interno');
    if (filter === 'externo') return list.filter(ambiente => ambiente.tipo !== 'interno');
    if (filter === 'com_nc') return list.filter(ambiente => ambiente.ncs_abertas > 0);
    return list;
  }, [ambientes, filter, search]);

  const groups = useMemo(
    () =>
      GRUPOS.map(group => ({
        ...group,
        items: filtered.filter(ambiente => grupoTipo(ambiente.tipo) === group.key),
      })).filter(group => group.items.length > 0),
    [filtered]
  );

  const hasRefinements = Boolean(search.trim());

  function clearAllFilters() {
    setSearch('');
  }

  const emptyTitle = hasRefinements
    ? 'Nenhum ambiente corresponde aos filtros'
    : filter === 'com_nc'
      ? 'Nenhum ambiente com NC'
      : filter === 'interno'
        ? 'Nenhum ambiente interno'
        : filter === 'externo'
          ? 'Nenhum ambiente externo'
          : 'Nenhum ambiente encontrado';

  const progress = kpi.progresso_percentual ?? 0;
  const location = obra?.municipio
    ? `${obra.municipio}${obra.uf ? `, ${obra.uf}` : ''}`
    : 'Local não informado';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
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
          <View style={styles.summaryPrimary}>
            <Text style={styles.summaryEyebrow}>PROGRESSO DA OBRA</Text>
            <Text style={styles.summaryValue}>{Math.round(progress)}%</Text>
            <Text style={styles.summaryLabel}>avanço ponderado das FVS</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFacts}>
            <SummaryFact
              value={`${kpi.fvs_concluidas}/${kpi.total_fvs}`}
              label="FVS concluídas"
              tone={Colors.text}
            />
            <SummaryFact
              value={kpi.ncs_abertas}
              label="NC abertas"
              tone={kpi.ncs_abertas > 0 ? Colors.nok : Colors.text}
            />
          </View>

          {obra?.eng_responsavel ? (
            <View style={styles.engineer}>
              <IconBox icon={UserRound} size={14} color={Colors.textTertiary} />
              <Text style={styles.engineerText} numberOfLines={1}>
                {obra.eng_responsavel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.controls}>
          <SegmentedControl
            value={filter}
            options={FILTERS}
            onChange={setFilter}
            accessibilityLabel="Filtrar ambientes por tipo ou não conformidade"
          />

          <View style={styles.searchBox}>
            <IconBox icon={Search} size={18} color={Colors.textTertiary} />
            <TextInput
              accessibilityLabel="Buscar ambientes"
              style={styles.searchInput}
              placeholder="Buscar por nome ou localização"
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Limpar busca"
                onPress={() => setSearch('')}
                style={styles.clearSearch}
              >
                <X size={17} color={Colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? (
          <ErrorBanner message="Não foi possível carregar os ambientes." />
        ) : null}

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Ambientes</Text>
          <Text style={styles.listCount}>{String(filtered.length).padStart(2, '0')}</Text>
          {hasRefinements ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar todos os filtros"
              onPress={clearAllFilters}
              style={styles.clearFilters}
            >
              <Text style={styles.clearFiltersText}>Limpar filtros</Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonGroup} />
            <Skeleton style={styles.skeletonRows} />
            <Skeleton style={styles.skeletonRows} />
          </View>
        ) : groups.length ? (
          groups.map(group => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>{group.items.length}</Text>
                </View>
              </View>
              <ListSurface>
                {group.items.map((item, index) => (
                  <AmbienteRowItem
                    key={item.id}
                    item={item}
                    last={index === group.items.length - 1}
                    onOpen={() => router.push(`/obras/${id}/ambiente/${item.id}` as never)}
                  />
                ))}
              </ListSurface>
            </View>
          ))
        ) : (
          <EmptyState
            Icon={hasRefinements ? Search : Layers3}
            title={emptyTitle}
            description={
              hasRefinements
                ? 'Ajuste a busca ou o filtro para ampliar os resultados.'
                : filter === 'com_nc'
                  ? 'Nenhum ambiente possui não conformidades abertas.'
                  : 'Esta obra ainda não possui ambientes ativos.'
            }
            actionLabel={hasRefinements ? 'Limpar filtros' : undefined}
            onAction={hasRefinements ? clearAllFilters : undefined}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryFact({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: string;
}) {
  return (
    <View style={styles.summaryFact}>
      <Text style={[styles.summaryFactValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryFactLabel}>{label}</Text>
    </View>
  );
}

function AmbienteRowItem({
  item,
  last,
  onOpen,
}: {
  item: AmbienteRow;
  last: boolean;
  onOpen: () => void;
}) {
  const tipo = TIPO_BADGE[item.tipo] ?? TIPO_BADGE.externo;
  const estado = estadoDoAmbiente(item);
  const hasNc = item.ncs_abertas > 0;
  const progress = item.progresso_percentual ?? 0;

  return (
    <OperationalRow
      tone={estado.tone}
      last={last}
      onPress={onOpen}
      accessibilityLabel={`Abrir ambiente ${item.nome}, ${estado.label}`}
      trailing={<IconBox icon={ChevronRight} size={19} color={Colors.textTertiary} />}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.nome}</Text>
        <Badge label={tipo.label} tone={tipo.tone} size="sm" />
      </View>
      <Text style={styles.rowContext} numberOfLines={1}>
        {item.localizacao || 'Local não informado'}
      </Text>
      <Text style={styles.rowDescription} numberOfLines={1}>
        {item.fvs_concluidas ?? 0} de {item.total_fvs ?? 0} FVS concluídas
        {hasNc ? ` · ${item.ncs_abertas} NC ${item.ncs_abertas === 1 ? 'aberta' : 'abertas'}` : ''}
      </Text>
      <View style={styles.rowFooter}>
        <Text style={[styles.footerLabel, { color: estado.color }]} numberOfLines={1}>
          {estado.label}
        </Text>
        <Text style={styles.footerProgress}>{Math.round(progress)}%</Text>
      </View>
    </OperationalRow>
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
    gap: Spacing.xl,
  },
  summary: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryPrimary: { flex: 1.5, minWidth: 180, justifyContent: 'center' },
  summaryEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  summaryValue: {
    marginTop: 2,
    color: Colors.brand,
    fontFamily: FontFamily.monoSemibold,
    fontSize: 34,
    lineHeight: 39,
  },
  summaryLabel: { ...Typography.caption, color: Colors.textSecondary },
  summaryDivider: {
    width: 1,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.border,
  },
  summaryFacts: {
    flex: 1,
    minWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: Spacing.md,
  },
  summaryFact: { alignItems: 'center', gap: 1 },
  summaryFactValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xl,
    lineHeight: 28,
  },
  summaryFactLabel: { ...Typography.caption, color: Colors.textTertiary },
  engineer: {
    width: '100%',
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineerText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  controls: { gap: Spacing.md },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.base,
  },
  clearSearch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: -Spacing.sm,
  },
  listTitle: { ...Typography.heading, color: Colors.text },
  listCount: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  clearFilters: {
    marginLeft: 'auto',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  clearFiltersText: {
    ...Typography.caption,
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
  },
  group: { gap: Spacing.sm },
  groupHeader: { paddingHorizontal: 2, gap: 1 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  groupTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  groupCount: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowTitle: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  rowContext: {
    marginTop: 3,
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  rowDescription: {
    marginTop: 3,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  rowFooter: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerLabel: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  footerProgress: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  loading: { gap: Spacing.md },
  skeletonGroup: { width: 140, height: 20, borderRadius: Radius.sm },
  skeletonRows: { width: '100%', height: 132, borderRadius: Radius.lg },
});
