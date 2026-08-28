import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
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
  EmptyState,
  ErrorBanner,
  ListSurface,
  ModalSheet,
  OperationalRow,
  SegmentedControl,
  Skeleton,
  type DatumTone,
} from '../../../../components/ui';
import {
  filterAndSortNcs,
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

const URGENCY_OPTIONS: {
  value: NcUrgency;
  label: string;
  description: string;
  Icon: typeof Clock3;
}[] = [
  { value: 'all', label: 'Todos os prazos', description: 'Sem restrição de prazo', Icon: CalendarClock },
  { value: 'overdue', label: 'Vencidas', description: 'Prazo de correção ultrapassado', Icon: AlertTriangle },
  { value: 'today', label: 'Vencem hoje', description: 'Ação necessária hoje', Icon: Clock3 },
  { value: 'soon', label: 'Próximos 3 dias', description: 'Prazos mais próximos', Icon: CalendarClock },
  { value: 'scheduled', label: 'Programadas', description: 'Prazo após os próximos 3 dias', Icon: CalendarClock },
  { value: 'unscheduled', label: 'Sem prazo', description: 'Ainda precisam de programação', Icon: CalendarX },
];

const PRIORITY_OPTIONS: { value: NcPriority; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

const PRIORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  alta: { label: 'Alta', tone: 'danger' },
  media: { label: 'Média', tone: 'warning' },
  baixa: { label: 'Baixa', tone: 'neutral' },
};

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  aberta: { label: 'Aberta', tone: 'danger' },
  em_correcao: { label: 'Em correção', tone: 'info' },
  resolvida: { label: 'Resolvida', tone: 'success' },
  encerrada_sem_resolucao: { label: 'Encerrada', tone: 'neutral' },
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
  if (!isActionableNc(item.status)) {
    return item.status === 'resolvida' ? 'success' : 'neutral';
  }
  const bucket = getNcTiming(item.data_nova_verif).bucket;
  if (bucket === 'overdue' || bucket === 'today') return 'danger';
  if (bucket === 'soon') return 'warning';
  return 'neutral';
}

export default function NcScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NcTab>('abertas');
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<NcUrgency>('all');
  const [priority, setPriority] = useState<NcPriority>('all');
  const [draftUrgency, setDraftUrgency] = useState<NcUrgency>('all');
  const [draftPriority, setDraftPriority] = useState<NcPriority>('all');
  const [filtersVisible, setFiltersVisible] = useState(false);
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
    }).catch(err => {
      console.warn('[NC] getUser failed', err);
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
  const activeFilterCount = Number(urgency !== 'all') + Number(priority !== 'all');
  const hasRefinements = Boolean(search.trim() || activeFilterCount);

  function openFilters() {
    setDraftUrgency(urgency);
    setDraftPriority(priority);
    setFiltersVisible(true);
  }

  function applyFilters() {
    setUrgency(activeTab === 'resolvidas' ? 'all' : draftUrgency);
    setPriority(draftPriority);
    setFiltersVisible(false);
  }

  function clearAdvancedFilters() {
    setDraftUrgency('all');
    setDraftPriority('all');
  }

  function clearAllFilters() {
    setSearch('');
    setUrgency('all');
    setPriority('all');
    setDraftUrgency('all');
    setDraftPriority('all');
  }

  function changeTab(tab: NcTab) {
    setActiveTab(tab);
    if (tab === 'resolvidas') setUrgency('all');
  }

  const emptyTitle = hasRefinements
    ? 'Nenhuma NC corresponde aos filtros'
    : activeTab === 'abertas'
      ? 'Nenhuma ação pendente'
      : activeTab === 'resolvidas'
        ? 'Nenhuma NC resolvida'
        : 'Nenhuma NC encontrada';

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Não Conformidades"
        subtitle={`${summary.actionable} abertas · ${summary.resolved} resolvidas`}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.summary}>
          <View style={styles.summaryPrimary}>
            <Text style={styles.summaryTitle}>Pendências em campo</Text>
            <Text style={styles.summaryValue}>{summary.actionable}</Text>
            <Text style={styles.summaryLabel}>
              {summary.actionable === 1 ? 'ocorrência em acompanhamento' : 'ocorrências em acompanhamento'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFacts}>
            <SummaryFact
              value={summary.overdue}
              label="vencidas"
              tone={summary.overdue > 0 ? Colors.nok : Colors.text}
            />
            <SummaryFact
              value={summary.today}
              label="para hoje"
              tone={summary.today > 0 ? Colors.warn : Colors.text}
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

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={18} color={Colors.textTertiary} />
              <TextInput
                accessibilityLabel="Buscar não conformidades"
                style={styles.searchInput}
                placeholder="Buscar item, obra ou ambiente"
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filtros avançados${activeFilterCount ? `, ${activeFilterCount} ativos` : ''}`}
              onPress={openFilters}
              style={({ pressed }) => [
                styles.filterButton,
                activeFilterCount > 0 && styles.filterButtonActive,
                pressed && styles.filterButtonPressed,
              ]}
            >
              <SlidersHorizontal
                size={18}
                color={activeFilterCount > 0 ? Colors.surface : Colors.brand}
              />
              {activeFilterCount > 0 ? (
                <Text style={styles.filterCount}>{activeFilterCount}</Text>
              ) : null}
            </Pressable>
          </View>
        </View>

        {error ? (
          <ErrorBanner message="Não foi possível carregar as não conformidades." />
        ) : null}

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Registros</Text>
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

        {!ready || isLoading ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonGroup} />
            <Skeleton style={styles.skeletonRows} />
            <Skeleton style={styles.skeletonRows} />
          </View>
        ) : groups.length ? (
          groups.map(group => (
            <NcGroupBlock
              key={group.key}
              group={group}
              onOpen={ncId => router.push(`/nc/${ncId}` as never)}
            />
          ))
        ) : (
          <EmptyState
            Icon={hasRefinements ? Search : CheckCircle2}
            title={emptyTitle}
            description={
              hasRefinements
                ? 'Ajuste a busca, o prazo ou a prioridade para ampliar os resultados.'
                : 'Os registros aparecerão aqui quando houver movimentação nas inspeções.'
            }
            actionLabel={hasRefinements ? 'Limpar filtros' : undefined}
            onAction={hasRefinements ? clearAllFilters : undefined}
          />
        )}
      </ScrollView>

      <ModalSheet
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        title="Filtrar registros"
        actions={(
          <View style={styles.sheetActions}>
            <Button
              label="Limpar"
              variant="secondary"
              onPress={clearAdvancedFilters}
              style={styles.sheetAction}
            />
            <Button
              label="Aplicar filtros"
              onPress={applyFilters}
              style={styles.sheetAction}
            />
          </View>
        )}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeTab !== 'resolvidas' ? (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetLabel}>PRAZO</Text>
              <View style={styles.optionList}>
                {URGENCY_OPTIONS.map(option => {
                  const Icon = option.Icon;
                  const selected = draftUrgency === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDraftUrgency(option.value)}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <Icon size={17} color={selected ? Colors.brand : Colors.textSecondary} />
                      </View>
                      <View style={styles.optionBody}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                          {option.label}
                        </Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.sheetSection}>
            <Text style={styles.sheetLabel}>PRIORIDADE</Text>
            <View style={styles.priorityGrid}>
              {PRIORITY_OPTIONS.map(option => {
                const selected = draftPriority === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setDraftPriority(option.value)}
                    style={[styles.priorityOption, selected && styles.priorityOptionSelected]}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      selected && styles.priorityOptionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </ModalSheet>
    </SafeAreaView>
  );
}

function SummaryFact({
  value,
  label,
  tone,
}: {
  value: number;
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

function NcGroupBlock({
  group,
  onOpen,
}: {
  group: NcGroup<NcRow>;
  onOpen: (ncId: string) => void;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.groupCount}>{group.items.length}</Text>
        </View>
        <Text style={styles.groupDescription}>{group.description}</Text>
      </View>
      <ListSurface>
        {group.items.map((item, index) => (
          <NcRowItem
            key={item.id}
            item={item}
            last={index === group.items.length - 1}
            onOpen={() => onOpen(item.id)}
          />
        ))}
      </ListSurface>
    </View>
  );
}

function NcRowItem({
  item,
  last,
  onOpen,
}: {
  item: NcRow;
  last: boolean;
  onOpen: () => void;
}) {
  const timing = getNcTiming(item.data_nova_verif);
  const status = STATUS_META[item.status] ?? {
    label: item.status.replaceAll('_', ' '),
    tone: 'neutral' as BadgeTone,
  };
  const priority = PRIORITY_META[item.prioridade] ?? {
    label: 'Não informada',
    tone: 'neutral' as BadgeTone,
  };

  return (
    <OperationalRow
      tone={datumToneFor(item)}
      last={last}
      onPress={onOpen}
      accessibilityLabel={`Abrir não conformidade: ${item.item_titulo}`}
      trailing={<ChevronRight size={19} color={Colors.textTertiary} />}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.item_titulo}</Text>
        <Badge label={priority.label} tone={priority.tone} size="sm" />
      </View>
      <Text style={styles.rowContext} numberOfLines={1}>
        {item.obra_nome} · {item.ambiente_nome}
      </Text>
      <Text style={styles.rowDescription} numberOfLines={1}>{item.descricao}</Text>
      <View style={styles.rowFooter}>
        <Text style={[styles.deadline, { color: badgeTextColor(deadlineTone(item)) }]}>
          {isActionableNc(item.status) ? timing.label : status.label}
        </Text>
        <Text style={styles.owner} numberOfLines={1}>
          {item.responsavel_nome ?? 'Sem responsável'}
        </Text>
      </View>
    </OperationalRow>
  );
}

function badgeTextColor(tone: BadgeTone): string {
  if (tone === 'danger') return Colors.nok;
  if (tone === 'warning') return Colors.warn;
  if (tone === 'success') return Colors.ok;
  if (tone === 'info') return Colors.info;
  return Colors.textSecondary;
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
  summaryTitle: { ...Typography.label, color: Colors.textSecondary },
  summaryValue: {
    marginTop: 2,
    color: Colors.brand,
    fontFamily: FontFamily.monoSemibold,
    fontSize: 34,
    lineHeight: 39,
  },
  summaryLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
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
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchBox: {
    minHeight: 48,
    flex: 1,
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
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
  },
  filterButtonActive: {
    width: 58,
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  filterButtonPressed: { opacity: 0.78 },
  filterCount: {
    color: Colors.surface,
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
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
  groupDescription: { ...Typography.caption, color: Colors.textTertiary },
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
  deadline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  owner: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  loading: { gap: Spacing.md },
  skeletonGroup: { width: 140, height: 20, borderRadius: Radius.sm },
  skeletonRows: { width: '100%', height: 132, borderRadius: Radius.lg },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm },
  sheetAction: { flex: 1 },
  sheetSection: { gap: Spacing.sm, marginBottom: Spacing.xl },
  sheetLabel: { ...Typography.overline, color: Colors.textTertiary },
  optionList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionRowSelected: { backgroundColor: Colors.brandLight },
  optionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface2,
  },
  optionIconSelected: { backgroundColor: Colors.surface },
  optionBody: { flex: 1 },
  optionTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  optionTitleSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  optionDescription: { ...Typography.caption, color: Colors.textTertiary },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderNormal,
  },
  radioSelected: { borderColor: Colors.brand },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand,
  },
  priorityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  priorityOption: {
    minHeight: 42,
    minWidth: 92,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  priorityOptionSelected: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandLight,
  },
  priorityOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  priorityOptionTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
});
