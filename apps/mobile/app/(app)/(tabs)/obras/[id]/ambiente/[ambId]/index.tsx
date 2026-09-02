import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Layers3, Search, X } from 'lucide-react-native';
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
import { AppHeader } from '../../../../../../../components/AppHeader';
import { IconBox } from '../../../../../../../components/IconBox';
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
} from '../../../../../../../components/ui';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../../../../lib/constants';
import {
  COMPLETED_FVS_STATUSES,
  IN_PROGRESS_FVS_STATUSES,
  summarizeFvsProgress,
} from '../../../../../../../lib/fvs-progress';
import { goBack } from '../../../../../../../lib/navigation';

interface AmbienteRow {
  id: string;
  nome: string;
  tipo: string;
  localizacao: string;
  obra_nome: string;
}

interface FvsRow {
  id: string;
  subservico: string;
  status: string;
  ultima_verif: string | null;
  total_verificacoes: number;
  ncs_abertas: number;
}

type ServiceFilter = 'todos' | 'atencao' | 'em_curso' | 'concluidos';

type GroupKey = 'atencao' | 'em_curso' | 'concluidos' | 'pendentes';

const SERVICE_FILTERS: { value: ServiceFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'em_curso', label: 'Em curso' },
  { value: 'concluidos', label: 'Concluídos' },
];

const STATUS_META: Record<string, { label: string; tone: BadgeTone; color: string }> = {
  conforme: { label: 'Concluído', tone: 'success', color: Colors.ok },
  concluida: { label: 'Concluído', tone: 'success', color: Colors.ok },
  concluida_ressalva: { label: 'Com ressalva', tone: 'warning', color: Colors.warn },
  nao_conforme: { label: 'NC aberta', tone: 'danger', color: Colors.nok },
  em_andamento: { label: 'Em andamento', tone: 'info', color: Colors.info },
  em_revisao: { label: 'Em revisão', tone: 'info', color: Colors.info },
  pendente: { label: 'Pendente', tone: 'neutral', color: Colors.textTertiary },
};

function getStatus(status: string) {
  return STATUS_META[status] ?? STATUS_META.pendente;
}

function grupoDoServico(item: FvsRow): GroupKey {
  if (item.ncs_abertas > 0) return 'atencao';
  if (COMPLETED_FVS_STATUSES.has(item.status)) return 'concluidos';
  if (IN_PROGRESS_FVS_STATUSES.has(item.status)) return 'em_curso';
  return 'pendentes';
}

const GRUPOS: { key: GroupKey; title: string }[] = [
  { key: 'atencao', title: 'Atenção' },
  { key: 'em_curso', title: 'Em curso' },
  { key: 'concluidos', title: 'Concluídos' },
  { key: 'pendentes', title: 'Pendentes' },
];

function estadoVisual(item: FvsRow): {
  label: string;
  color: string;
  tone: DatumTone;
} {
  const status = getStatus(item.status);
  if (item.ncs_abertas > 0) {
    const ncLabel = item.ncs_abertas === 1
      ? '1 NC aberta'
      : `${item.ncs_abertas} NC abertas`;
    return { label: ncLabel, color: Colors.nok, tone: 'danger' };
  }
  return { label: status.label, color: status.color, tone: status.tone };
}

function formatDate(value: string): string {
  const normalized = value.length === 10 ? `${value}T00:00:00` : value;
  return new Date(normalized).toLocaleDateString('pt-BR');
}

export default function AmbienteScreen() {
  const { id, ambId } = useLocalSearchParams<{ id: string; ambId: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<ServiceFilter>('todos');
  const [search, setSearch] = useState('');

  const { data: ambienteRows } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao, o.nome AS obra_nome
    FROM ambientes a
    JOIN obras o ON o.id = a.obra_id
    WHERE a.id = ?
  `, [ambId]);
  const ambiente = ambienteRows[0];

  const {
    data: fvsList,
    isLoading,
    error,
  } = useQuery<FvsRow>(`
    SELECT fp.id, fp.subservico, fp.status,
      COUNT(v.id) AS total_verificacoes,
      MAX(v.data_verif) AS ultima_verif,
      (SELECT COUNT(*)
       FROM nao_conformidades nc
       JOIN verificacoes vn ON vn.id = nc.verificacao_id
       WHERE vn.fvs_planejada_id = fp.id
         AND nc.status IN ('aberta', 'em_correcao')) AS ncs_abertas
    FROM fvs_planejadas fp
    LEFT JOIN verificacoes v ON v.fvs_planejada_id = fp.id
    WHERE fp.ambiente_id = ?
    GROUP BY fp.id
    ORDER BY fp.subservico
  `, [ambId]);

  const summary = useMemo(() => {
    const progressSummary = summarizeFvsProgress(fvsList);
    const attention = fvsList.filter(item => item.ncs_abertas > 0).length;
    const inProgress = fvsList.filter(item => IN_PROGRESS_FVS_STATUSES.has(item.status)).length;
    return {
      total: progressSummary.total,
      completed: progressSummary.completed,
      attention,
      inProgress,
      progress: progressSummary.percentage,
    };
  }, [fvsList]);

  const filtered = useMemo(() => {
    let list = fvsList;
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(item => item.subservico?.toLowerCase().includes(query));
    }
    if (filter === 'atencao') return list.filter(item => item.ncs_abertas > 0);
    if (filter === 'em_curso') return list.filter(item => IN_PROGRESS_FVS_STATUSES.has(item.status));
    if (filter === 'concluidos') return list.filter(item => COMPLETED_FVS_STATUSES.has(item.status));
    return list;
  }, [filter, fvsList, search]);

  const groups = useMemo(
    () =>
      GRUPOS.map(group => ({
        ...group,
        items: filtered.filter(item => grupoDoServico(item) === group.key),
      })).filter(group => group.items.length > 0),
    [filtered]
  );

  const hasRefinements = Boolean(search.trim());

  function clearAllFilters() {
    setSearch('');
  }

  const emptyTitle = hasRefinements
    ? 'Nenhum serviço corresponde aos filtros'
    : filter === 'atencao'
      ? 'Nenhum serviço com atenção'
      : filter === 'em_curso'
        ? 'Nenhum serviço em curso'
        : filter === 'concluidos'
          ? 'Nenhum serviço concluído'
          : 'Nenhum serviço encontrado';

  const subtitle = [
    ambiente?.tipo === 'interno' ? 'Interno' : 'Externo',
    ambiente?.localizacao || null,
    ambiente?.obra_nome || null,
  ].filter(Boolean).join(' · ');

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title={ambiente?.nome ?? 'Ambiente'}
        subtitle={subtitle}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}`)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.summary}>
          <View style={styles.summaryPrimary}>
            <Text style={styles.summaryEyebrow}>PROGRESSO DO AMBIENTE</Text>
            <Text style={styles.summaryValue}>{Math.round(summary.progress)}%</Text>
            <Text style={styles.summaryLabel}>avanço ponderado dos serviços</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFacts}>
            <SummaryFact
              value={`${summary.completed}/${summary.total}`}
              label="serviços concluídos"
              tone={Colors.text}
            />
            <SummaryFact
              value={summary.attention}
              label="com atenção"
              tone={summary.attention > 0 ? Colors.nok : Colors.text}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <SegmentedControl
            value={filter}
            options={SERVICE_FILTERS}
            onChange={setFilter}
            accessibilityLabel="Filtrar serviços por situação"
          />

          <View style={styles.searchBox}>
            <IconBox icon={Search} size={18} color={Colors.textTertiary} />
            <TextInput
              accessibilityLabel="Buscar serviços"
              style={styles.searchInput}
              placeholder="Buscar por nome do serviço"
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
          <ErrorBanner message="Não foi possível carregar os serviços." />
        ) : null}

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Serviços</Text>
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
                  <ServicoRowItem
                    key={item.id}
                    item={item}
                    last={index === group.items.length - 1}
                    onOpen={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
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
                : fvsList.length === 0
                  ? 'Este ambiente ainda não possui FVS planejadas.'
                  : 'Nenhum serviço atende ao filtro selecionado.'
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

function ServicoRowItem({
  item,
  last,
  onOpen,
}: {
  item: FvsRow;
  last: boolean;
  onOpen: () => void;
}) {
  const status = getStatus(item.status);
  const estado = estadoVisual(item);
  const hasOpenNc = item.ncs_abertas > 0;
  const countLabel = item.total_verificacoes === 1
    ? 'verificação'
    : 'verificações';

  return (
    <OperationalRow
      tone={estado.tone}
      last={last}
      onPress={onOpen}
      accessibilityLabel={`Abrir serviço ${item.subservico || 'sem nome'}, ${estado.label}`}
      trailing={<IconBox icon={ChevronRight} size={19} color={Colors.textTertiary} />}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.subservico || 'Serviço'}
        </Text>
        <Badge label={status.label} tone={status.tone} size="sm" />
      </View>
      <Text style={styles.rowContext} numberOfLines={1}>
        {item.ultima_verif
          ? `Última verificação em ${formatDate(item.ultima_verif)}`
          : 'Não iniciado'}
      </Text>
      <Text style={styles.rowDescription} numberOfLines={1}>
        {item.total_verificacoes} {countLabel}
        {hasOpenNc ? ` · ${item.ncs_abertas} NC ${item.ncs_abertas === 1 ? 'aberta' : 'abertas'}` : ''}
      </Text>
      <View style={styles.rowFooter}>
        <Text style={[styles.footerLabel, { color: estado.color }]} numberOfLines={1}>
          {estado.label}
        </Text>
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  summaryPrimary: { flex: 1.5, justifyContent: 'center' },
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
  loading: { gap: Spacing.md },
  skeletonGroup: { width: 140, height: 20, borderRadius: Radius.sm },
  skeletonRows: { width: '100%', height: 132, borderRadius: Radius.lg },
});
