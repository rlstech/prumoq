import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  CircleDot,
  Clock3,
  HardHat,
  History,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader } from '../../../../components/AppHeader';
import {
  Badge,
  type BadgeTone,
  Button,
  Chip,
  DatumCard,
  type DatumTone,
  EmptyState,
  ErrorBanner,
  MetricBlock,
  SectionTitle,
  SegmentedControl,
  Skeleton,
} from '../../../../components/ui';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import {
  filterAndSortNcs,
  formatNcDate,
  getNcTiming,
  groupNcs,
  isActionableNc,
  summarizeNcs,
  type NcGroup,
  type NcPriority,
  type NcTab,
  type NcUrgency,
} from '../../../../lib/nc-list';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../lib/constants';
import { supabase } from '../../../../lib/supabase';

interface NcRow {
  id: string;
  descricao: string;
  status: string;
  data_nova_verif: string | null;
  prioridade: string;
  item_titulo: string;
  ambiente_nome: string;
  obra_nome: string;
  responsavel_nome: string | null;
  fvs_planejada_id: string;
  obra_id: string;
  ambiente_id: string;
}

const NC_QUERY = `
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id,
         o.id AS obra_id, a.id AS ambiente_id
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v ON v.id = n.verificacao_id
  JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o ON o.id = a.obra_id
  LEFT JOIN equipes e ON e.id = n.responsavel_id
  WHERE n.status != 'cancelada'
    AND (? = 'admin' OR EXISTS (
      SELECT 1 FROM obra_usuarios ou
      WHERE ou.obra_id = o.id AND ou.usuario_id = ?
    ))
  ORDER BY n.data_nova_verif ASC NULLS LAST
`;

const TAB_OPTIONS = [
  { value: 'abertas' as const, label: 'Abertas' },
  { value: 'resolvidas' as const, label: 'Resolvidas' },
  { value: 'todas' as const, label: 'Todas' },
];

const URGENCY_OPTIONS: { value: NcUrgency; label: string; Icon?: typeof Clock3 }[] = [
  { value: 'all', label: 'Todos os prazos' },
  { value: 'overdue', label: 'Vencidas', Icon: AlertTriangle },
  { value: 'today', label: 'Hoje', Icon: Clock3 },
  { value: 'soon', label: 'Próx. 3 dias', Icon: CalendarClock },
  { value: 'scheduled', label: 'Programadas', Icon: CalendarClock },
  { value: 'unscheduled', label: 'Sem prazo', Icon: CalendarX },
];

const PRIORITY_OPTIONS: { value: NcPriority; label: string }[] = [
  { value: 'all', label: 'Toda prioridade' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

const PRIORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  alta: { label: 'Prioridade alta', tone: 'danger' },
  media: { label: 'Prioridade média', tone: 'warning' },
  baixa: { label: 'Prioridade baixa', tone: 'neutral' },
};

const STATUS_META: Record<string, { label: string; tone: BadgeTone; Icon: typeof CircleDot }> = {
  aberta: { label: 'Aberta', tone: 'danger', Icon: AlertTriangle },
  em_correcao: { label: 'Em correção', tone: 'info', Icon: Clock3 },
  resolvida: { label: 'Resolvida', tone: 'success', Icon: CheckCircle2 },
  encerrada_sem_resolucao: { label: 'Encerrada sem resolução', tone: 'neutral', Icon: History },
};

function datumToneFor(item: NcRow): DatumTone {
  if (item.status === 'resolvida') return 'success';
  if (!isActionableNc(item.status)) return 'neutral';
  const bucket = getNcTiming(item.data_nova_verif).bucket;
  if (bucket === 'overdue' || bucket === 'today') return 'danger';
  if (bucket === 'soon') return 'warning';
  return item.status === 'em_correcao' ? 'info' : 'accent';
}

function deadlineTone(item: NcRow): BadgeTone {
  const bucket = getNcTiming(item.data_nova_verif).bucket;
  if (bucket === 'overdue' || bucket === 'today') return 'danger';
  if (bucket === 'soon') return 'warning';
  return 'neutral';
}

export default function NcScreen() {
  const router = useRouter();
  const { isTablet } = useResponsiveLayout();
  const [activeTab, setActiveTab] = useState<NcTab>('abertas');
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<NcUrgency>('all');
  const [priority, setPriority] = useState<NcPriority>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: usuario } = await supabase
        .from('usuarios' as never)
        .select('perfil')
        .eq('id', data.user.id)
        .single();
      if (usuario) setPerfil((usuario as { perfil: string }).perfil);
    });
  }, []);

  const ready = Boolean(userId && perfil);
  const {
    data: ncs,
    isLoading,
    error,
  } = useQuery<NcRow>(
    ready ? NC_QUERY : 'SELECT 1 WHERE 0',
    ready ? [perfil, userId] : [],
  );

  const summary = useMemo(() => summarizeNcs(ncs), [ncs]);
  const filters = useMemo(
    () => ({ tab: activeTab, search, urgency, priority }),
    [activeTab, search, urgency, priority],
  );
  const filtered = useMemo(() => filterAndSortNcs(ncs, filters), [ncs, filters]);
  const groups = useMemo(() => groupNcs(filtered), [filtered]);
  const hasRefinements = Boolean(search.trim() || urgency !== 'all' || priority !== 'all');

  function clearFilters() {
    setSearch('');
    setUrgency('all');
    setPriority('all');
  }

  function changeTab(tab: NcTab) {
    setActiveTab(tab);
    if (tab === 'resolvidas') setUrgency('all');
  }

  function goReinspect(nc: NcRow) {
    router.push(
      (
        `/obras/${nc.obra_id}/ambiente/${nc.ambiente_id}/fvs/${nc.fvs_planejada_id}/verificacao/nova`
      ) as never,
    );
  }

  const emptyTitle = hasRefinements
    ? 'Nenhuma NC corresponde aos filtros'
    : activeTab === 'abertas'
      ? 'Nenhuma ação pendente'
      : activeTab === 'resolvidas'
        ? 'Nenhuma NC resolvida'
        : 'Nenhuma NC encontrada';

  const emptyDescription = hasRefinements
    ? 'Ajuste a busca, o prazo ou a prioridade para ampliar os resultados.'
    : activeTab === 'abertas'
      ? 'As próximas correções e reinspeções aparecerão aqui.'
      : 'Os registros aparecerão assim que houver movimentação nas inspeções.';

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Não Conformidades"
        subtitle="Priorize correções e reinspeções em campo"
      />

      <FlatList
        data={groups}
        keyExtractor={group => group.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.overview}>
              <View style={styles.overviewLead}>
                <Text style={styles.overviewEyebrow}>AÇÃO REQUERIDA</Text>
                <View style={styles.overviewValueRow}>
                  <Text style={styles.overviewValue}>{summary.actionable}</Text>
                  <Text style={styles.overviewUnit}>
                    {summary.actionable === 1 ? 'NC aberta' : 'NCs abertas'}
                  </Text>
                </View>
                <Text style={styles.overviewCaption}>
                  Ordenadas pelo prazo mais crítico
                </Text>
              </View>
              <View style={styles.overviewMetrics}>
                <MetricBlock
                  label="VENCIDAS"
                  value={summary.overdue}
                  tone={summary.overdue > 0 ? 'danger' : 'neutral'}
                  style={styles.overviewMetric}
                />
                <View style={styles.metricDivider} />
                <MetricBlock
                  label="HOJE"
                  value={summary.today}
                  tone={summary.today > 0 ? 'warning' : 'neutral'}
                  style={styles.overviewMetric}
                />
                <View style={styles.metricDivider} />
                <MetricBlock
                  label="RESOLVIDAS"
                  value={summary.resolved}
                  tone="success"
                  style={styles.overviewMetric}
                />
              </View>
            </View>

            <View style={styles.controls}>
              <SegmentedControl
                value={activeTab}
                options={TAB_OPTIONS}
                onChange={changeTab}
                accessibilityLabel="Filtrar por situação da não conformidade"
              />

              <View style={styles.searchBox}>
                <Search size={18} color={Colors.textTertiary} />
                <TextInput
                  accessibilityLabel="Buscar não conformidades"
                  style={styles.searchInput}
                  placeholder="Buscar item, obra, ambiente ou responsável"
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

              {activeTab !== 'resolvidas' ? (
                <View style={styles.filterBlock}>
                  <View style={styles.filterLabelRow}>
                    <SlidersHorizontal size={15} color={Colors.textTertiary} />
                    <Text style={styles.filterLabel}>PRAZO</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {URGENCY_OPTIONS.map(option => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        Icon={option.Icon}
                        selected={urgency === option.value}
                        onPress={() => setUrgency(option.value)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>PRIORIDADE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {PRIORITY_OPTIONS.map(option => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={priority === option.value}
                      onPress={() => setPriority(option.value)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>

            {error ? (
              <ErrorBanner message="Não foi possível carregar as não conformidades." />
            ) : null}

            <SectionTitle
              eyebrow="CENTRAL DE AÇÃO"
              title={`${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`}
              description={
                activeTab === 'abertas'
                  ? 'Prazos críticos aparecem primeiro.'
                  : activeTab === 'resolvidas'
                    ? 'Itens aprovados em reinspeção.'
                    : 'Visão completa do ciclo das não conformidades.'
              }
              action={hasRefinements ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpar todos os filtros"
                  onPress={clearFilters}
                  style={styles.clearFilters}
                >
                  <X size={15} color={Colors.brand} />
                  <Text style={styles.clearFiltersText}>Limpar filtros</Text>
                </Pressable>
              ) : undefined}
            />
          </View>
        }
        renderItem={({ item: group }) => (
          <NcGroupBlock
            group={group}
            twoColumns={isTablet}
            onReinspect={goReinspect}
          />
        )}
        ListEmptyComponent={
          !ready || isLoading ? (
            <View style={styles.loading}>
              <Skeleton style={styles.skeletonTitle} />
              <Skeleton style={styles.skeletonCard} />
              <Skeleton style={styles.skeletonCard} />
            </View>
          ) : (
            <EmptyState
              Icon={hasRefinements ? Search : CheckCircle2}
              title={emptyTitle}
              description={emptyDescription}
              actionLabel={hasRefinements ? 'Limpar filtros' : undefined}
              onAction={hasRefinements ? clearFilters : undefined}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function NcGroupBlock({
  group,
  twoColumns,
  onReinspect,
}: {
  group: NcGroup<NcRow>;
  twoColumns: boolean;
  onReinspect: (item: NcRow) => void;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.groupCount}>{String(group.items.length).padStart(2, '0')}</Text>
        </View>
        <Text style={styles.groupDescription}>{group.description}</Text>
      </View>
      <View style={styles.groupGrid}>
        {group.items.map(item => (
          <NcCard
            key={item.id}
            item={item}
            twoColumns={twoColumns}
            onReinspect={() => onReinspect(item)}
          />
        ))}
      </View>
    </View>
  );
}

function NcCard({
  item,
  twoColumns,
  onReinspect,
}: {
  item: NcRow;
  twoColumns: boolean;
  onReinspect: () => void;
}) {
  const actionable = isActionableNc(item.status);
  const timing = getNcTiming(item.data_nova_verif);
  const status = STATUS_META[item.status] ?? {
    label: item.status.replaceAll('_', ' '),
    tone: 'neutral' as BadgeTone,
    Icon: CircleDot,
  };
  const priority = PRIORITY_META[item.prioridade] ?? {
    label: 'Prioridade não informada',
    tone: 'neutral' as BadgeTone,
  };
  const StatusIcon = status.Icon;

  return (
    <DatumCard
      tone={datumToneFor(item)}
      style={[styles.card, twoColumns && styles.cardTwoColumns]}
    >
      <View style={styles.cardTopline}>
        <View style={styles.deadlineGroup}>
          {actionable ? (
            <>
              <Text style={[
                styles.deadlineLabel,
                (timing.bucket === 'overdue' || timing.bucket === 'today') && styles.deadlineCritical,
                timing.bucket === 'soon' && styles.deadlineWarning,
              ]}>
                {timing.label.toUpperCase()}
              </Text>
              {timing.dateLabel ? (
                <Text style={styles.deadlineDate}>{timing.dateLabel}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.deadlineLabel}>
              {item.status === 'resolvida' ? 'REINSPEÇÃO CONCLUÍDA' : 'REGISTRO HISTÓRICO'}
            </Text>
          )}
        </View>
        <Badge label={priority.label} tone={priority.tone} size="sm" />
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{item.item_titulo}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>{item.descricao}</Text>

      <View style={styles.context}>
        <View style={styles.contextRow}>
          <HardHat size={15} color={Colors.textTertiary} />
          <Text style={styles.contextText} numberOfLines={1}>{item.obra_nome}</Text>
        </View>
        <View style={styles.contextRow}>
          <MapPin size={15} color={Colors.textTertiary} />
          <Text style={styles.contextText} numberOfLines={1}>{item.ambiente_nome}</Text>
        </View>
        <View style={styles.contextRow}>
          <UserRound size={15} color={Colors.textTertiary} />
          <Text style={styles.contextText} numberOfLines={1}>
            {item.responsavel_nome ?? 'Responsável não informado'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Badge
          label={status.label}
          tone={status.tone}
          Icon={StatusIcon}
          size="sm"
        />
        {actionable ? (
          <Button
            label="Reinspecionar"
            Icon={RotateCcw}
            onPress={onReinspect}
            accessibilityHint={`Abre uma nova verificação para ${item.item_titulo}`}
            style={styles.reinspectButton}
          />
        ) : (
          <View style={styles.closedMeta}>
            <CheckCircle2
              size={15}
              color={item.status === 'resolvida' ? Colors.ok : Colors.textTertiary}
            />
            <Text style={styles.closedMetaText}>
              {item.status === 'resolvida'
                ? 'Ciclo concluído'
                : `Prazo original ${formatNcDate(item.data_nova_verif) ?? 'não informado'}`}
            </Text>
          </View>
        )}
      </View>
    </DatumCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: 104,
    gap: Spacing.xxl,
  },
  headerContent: { gap: Spacing.xxl, marginBottom: Spacing.xs },
  overview: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xxl,
    overflow: 'hidden',
  },
  overviewLead: { flex: 0.85, minWidth: 220, gap: Spacing.xs },
  overviewEyebrow: { ...Typography.overline, color: Colors.brandSignature },
  overviewValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  overviewValue: {
    color: Colors.surface,
    fontFamily: FontFamily.monoSemibold,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  overviewUnit: {
    color: Colors.surface,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
  },
  overviewCaption: { ...Typography.caption, color: Colors.surface, opacity: 0.72 },
  overviewMetrics: {
    flex: 1.4,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  overviewMetric: { flex: 1, minWidth: 0 },
  metricDivider: { width: 1, height: 48, backgroundColor: Colors.border },
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
  filterBlock: { gap: Spacing.sm },
  filterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel: { ...Typography.overline, color: Colors.textTertiary },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.lg },
  clearFilters: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
  },
  clearFiltersText: { ...Typography.caption, color: Colors.brand, fontFamily: FontFamily.semibold },
  group: { gap: Spacing.md },
  groupHeader: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 2,
  },
  groupTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  groupTitle: { ...Typography.heading, color: Colors.text },
  groupCount: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  groupDescription: { ...Typography.caption, color: Colors.textSecondary },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: { width: '100%' },
  cardTwoColumns: { flexBasis: '48%', flexGrow: 1, maxWidth: '50%' },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  deadlineGroup: { flex: 1, gap: 2 },
  deadlineLabel: { ...Typography.overline, color: Colors.textTertiary },
  deadlineCritical: { color: Colors.nok },
  deadlineWarning: { color: Colors.warn },
  deadlineDate: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.textSecondary,
  },
  cardTitle: { ...Typography.heading, color: Colors.text, marginTop: Spacing.md },
  cardDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    minHeight: 48,
  },
  context: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  contextText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  cardFooter: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  reinspectButton: { minHeight: 44, paddingHorizontal: Spacing.md },
  closedMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flex: 1 },
  closedMetaText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },
  loading: { gap: Spacing.md },
  skeletonTitle: { width: 150, height: 24 },
  skeletonCard: { width: '100%', height: 220, borderRadius: Radius.lg },
});
