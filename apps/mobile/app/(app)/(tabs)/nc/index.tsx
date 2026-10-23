import { useQuery } from '@powersync/react';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  Search,
  SlidersHorizontal,
  X,
} from '../../../../lib/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, HeaderIconButton } from '../../../../components/AppHeader';
import { usePrivateMediaUris } from '../../../../hooks/usePrivateMediaUris';
import {
  Badge,
  type BadgeTone,
  Button,
  EmptyState,
  ErrorBanner,
  FilterChips,
  GroupLabel,
  ModalSheet,
  Pill,
  SearchPill,
  Skeleton,
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
import { useConta } from '../../../../lib/auth/sessao';

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
  foto_key: string | null;
  fvs_nome: string | null;
  fvs_planejada_id: string;
  obra_id: string;
  ambiente_id: string;
}

const NC_QUERY = `
  SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
         vi.titulo AS item_titulo,
         a.nome AS ambiente_nome, o.nome AS obra_nome,
         e.nome AS responsavel_nome,
         (SELECT COALESCE(nf.r2_thumb_key, nf.r2_key) FROM nc_fotos nf
           WHERE nf.nc_id = n.id ORDER BY nf.ordem LIMIT 1) AS foto_key,
         fp.subservico AS fvs_nome,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const conta = useConta();
  const userId = conta?.usuarioId ?? null;
  const perfil: string | null = conta?.perfil ?? null;

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
  // Miniaturas: uma assinatura em lote para a lista toda (nunca uma por cartão).
  const resolveFoto = usePrivateMediaUris(filtered.map(item => item.foto_key ?? '').filter(Boolean));
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
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title="Não conformidades"
        rightElement={(
          <View style={styles.headerActions}>
            <HeaderIconButton
              Icon={searchOpen ? X : Search}
              label={searchOpen ? 'Fechar busca' : 'Buscar não conformidades'}
              active={searchOpen}
              onPress={() => {
                if (searchOpen) setSearch('');
                setSearchOpen(open => !open);
              }}
            />
            <HeaderIconButton
              Icon={SlidersHorizontal}
              label={`Filtros de prazo e prioridade${activeFilterCount ? `, ${activeFilterCount} ativos` : ''}`}
              active={activeFilterCount > 0}
              badge={activeFilterCount || undefined}
              onPress={openFilters}
            />
          </View>
        )}
      >
        <View style={styles.headerPills}>
          <Pill label={`${summary.actionable} ${summary.actionable === 1 ? 'aberta' : 'abertas'}`} tone={summary.actionable > 0 ? 'danger' : 'neutral'} dot />
          {summary.overdue > 0 ? <Pill label={`${summary.overdue} ${summary.overdue === 1 ? 'vencida' : 'vencidas'}`} tone="danger" Icon={AlertTriangle} /> : null}
          {summary.today > 0 ? <Pill label={`${summary.today} para hoje`} tone="warning" Icon={Clock3} /> : null}
          <Pill label={`${summary.resolved} ${summary.resolved === 1 ? 'resolvida' : 'resolvidas'}`} tone={summary.resolved > 0 ? 'success' : 'neutral'} dot />
        </View>
      </AppHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {searchOpen ? (
          <SearchPill value={search} onChangeText={setSearch} placeholder="Buscar item, obra ou ambiente" autoFocus />
        ) : null}

        <FilterChips
          value={activeTab}
          options={TAB_OPTIONS.map(option => ({
            ...option,
            count: option.value === 'abertas' ? summary.actionable : option.value === 'resolvidas' ? summary.resolved : ncs.length,
          }))}
          onChange={changeTab}
          accessibilityLabel="Filtrar por situação da não conformidade"
        />

        {error ? (
          <ErrorBanner message="Não foi possível carregar as não conformidades." />
        ) : null}

        {hasRefinements ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar busca e filtros"
            onPress={clearAllFilters}
            style={styles.clearFilters}
          >
            <X size={14} color={Colors.textSecondary} />
            <Text style={styles.clearFiltersText}>Limpar busca e filtros · {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</Text>
          </Pressable>
        ) : null}

        {!ready || isLoading ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonRows} />
            <Skeleton style={styles.skeletonRows} />
          </View>
        ) : groups.length ? (
          groups.map(group => (
            <NcGroupBlock
              key={group.key}
              group={group}
              resolveFoto={resolveFoto}
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
              <Text style={styles.sheetLabel}>Prazo</Text>
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
            <Text style={styles.sheetLabel}>Prioridade</Text>
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

function NcGroupBlock({
  group,
  resolveFoto,
  onOpen,
}: {
  group: NcGroup<NcRow>;
  resolveFoto: (key: string) => string;
  onOpen: (ncId: string) => void;
}) {
  return (
    <View style={styles.group}>
      <GroupLabel label={group.title} count={group.items.length} description={group.description} />
      {group.items.map(item => (
        <NcCard key={item.id} item={item} fotoUri={item.foto_key ? resolveFoto(item.foto_key) : ''} onOpen={() => onOpen(item.id)} />
      ))}
    </View>
  );
}

/** Cartão da NC (canvas): miniatura da foto, título, local e pílulas de status e prazo. */
function NcCard({ item, fotoUri, onOpen }: { item: NcRow; fotoUri: string; onOpen: () => void }) {
  const timing = getNcTiming(item.data_nova_verif);
  const status = STATUS_META[item.status] ?? { label: item.status.replaceAll('_', ' '), tone: 'neutral' as BadgeTone };
  const priority = PRIORITY_META[item.prioridade];
  const actionable = isActionableNc(item.status);
  const deadline = deadlineTone(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Não conformidade: ${item.item_titulo}. ${item.ambiente_nome}, ${item.obra_nome}. ${status.label}${actionable ? `, ${timing.label}` : ''}.`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumb}>
        {fotoUri ? (
          <Image source={{ uri: fotoUri }} style={styles.thumbImage} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <ImageIcon size={24} color={Colors.textSecondary} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.item_titulo}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.ambiente_nome}{item.fvs_nome ? ` · ${item.fvs_nome}` : ''}
        </Text>
        <Text style={styles.cardObra} numberOfLines={1}>{item.obra_nome}{item.responsavel_nome ? ` · ${item.responsavel_nome}` : ''}</Text>
        <View style={styles.cardPills}>
          <Pill label={status.label} tone={status.tone} onSurface />
          {actionable ? (
            <Pill
              label={timing.label}
              tone={deadline === 'danger' ? 'danger' : deadline === 'warning' ? 'warning' : 'neutral'}
              Icon={CalendarClock}
              onSurface
            />
          ) : null}
          {priority && item.prioridade === 'alta' && actionable ? <Pill label="Alta" tone="danger" onSurface /> : null}
        </View>
      </View>
    </Pressable>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
  },
  cardPressed: { backgroundColor: Colors.surface2 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.base, lineHeight: 20, color: Colors.text },
  cardMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  cardObra: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, color: Colors.textTertiary },
  cardPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  summary: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
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
    borderRadius: Radius.full,
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
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  filterButtonActive: {
    width: 64,
    backgroundColor: Colors.brand,
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
    alignSelf: 'flex-start',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  clearFiltersText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semibold,
  },
  group: { gap: Spacing.sm, marginTop: Spacing.xs },
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
    letterSpacing: 0,
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
  sheetLabel: { ...Typography.label, color: Colors.text },
  optionList: {
    gap: 4,
  },
  optionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  optionRowSelected: { backgroundColor: Colors.brandLight },
  optionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
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
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.md,
  },
  priorityOptionSelected: {
    backgroundColor: Colors.brand,
  },
  priorityOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  priorityOptionTextSelected: { color: Colors.surface, fontFamily: FontFamily.bold },
});
