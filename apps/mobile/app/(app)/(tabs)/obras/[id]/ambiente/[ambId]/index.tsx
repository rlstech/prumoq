import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Layers3, Search, X } from '../../../../../../../lib/icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, HeaderIconButton } from '../../../../../../../components/AppHeader';
import {
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  FilterChips,
  GroupLabel,
  HeroPill,
  Pill,
  SearchPill,
  Skeleton,
  TapeHero,
  type TrenaTone,
} from '../../../../../../../components/ui';
import { Breakpoints, Colors, FontFamily, FontSizes, Radius, Spacing } from '../../../../../../../lib/constants';
import { ChevronRight } from '../../../../../../../lib/icons';
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

const STATUS_META: Record<string, { label: string; tone: BadgeTone & TrenaTone; color: string }> = {
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

function estadoVisual(item: FvsRow): { label: string; tone: TrenaTone } {
  if (item.ncs_abertas > 0) {
    return { label: item.ncs_abertas === 1 ? '1 NC aberta' : `${item.ncs_abertas} NCs abertas`, tone: 'danger' };
  }
  const status = getStatus(item.status);
  return { label: status.label, tone: status.tone };
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  const counts = {
    todos: fvsList.length,
    atencao: summary.attention,
    em_curso: summary.inProgress,
    concluidos: summary.completed,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title={ambiente?.nome ?? 'Ambiente'}
        subtitle={subtitle}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}`)}
        rightElement={(
          <HeaderIconButton
            Icon={searchOpen ? X : Search}
            label={searchOpen ? 'Fechar busca' : 'Buscar serviços'}
            active={searchOpen}
            onPress={() => {
              if (searchOpen) setSearch('');
              setSearchOpen(open => !open);
            }}
          />
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {searchOpen ? (
          <SearchPill value={search} onChangeText={setSearch} placeholder="Buscar por nome do serviço" autoFocus />
        ) : null}

        <TapeHero label="Avanço do ambiente" value={summary.progress}>
          <HeroPill label={`${summary.completed}/${summary.total} serviços concluídos`} />
          <HeroPill
            label={summary.attention > 0 ? `${summary.attention} com NC` : 'Sem NC aberta'}
            tone={summary.attention > 0 ? 'danger' : 'success'}
          />
        </TapeHero>

        <FilterChips
          value={filter}
          onChange={setFilter}
          options={SERVICE_FILTERS.map(option => ({ ...option, count: counts[option.value] }))}
          accessibilityLabel="Filtrar serviços por situação"
        />

        {error ? (
          <ErrorBanner message="Não foi possível carregar os serviços." />
        ) : null}

        {isLoading ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonRows} />
            <Skeleton style={styles.skeletonRows} />
          </View>
        ) : groups.length ? (
          groups.map(group => (
            <View key={group.key} style={styles.group}>
              <GroupLabel label={group.title} count={group.items.length} />
              <View style={styles.list}>
                {group.items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <ServicoLinha
                      item={item}
                      onOpen={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
                    />
                  </View>
                ))}
              </View>
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
            actionLabel={hasRefinements ? 'Limpar busca' : undefined}
            onAction={hasRefinements ? clearAllFilters : undefined}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Linha de serviço (FVS): nome, situação em pílula e a última verificação. */
function ServicoLinha({ item, onOpen }: { item: FvsRow; onOpen: () => void }) {
  const estado = estadoVisual(item);
  const countLabel = item.total_verificacoes === 1 ? 'verificação' : 'verificações';
  const ultima = item.ultima_verif ? `Última em ${formatDate(item.ultima_verif)}` : 'Não iniciado';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir serviço ${item.subservico || 'sem nome'}, ${estado.label}. ${ultima}.`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.subservico || 'Serviço'}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {ultima} · {item.total_verificacoes} {countLabel}
        </Text>
      </View>
      <Pill label={estado.label} tone={estado.tone} onSurface />
      <ChevronRight size={16} color={Colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  group: { gap: Spacing.sm, marginTop: Spacing.xs },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 6 },
  divider: { height: 1, backgroundColor: Colors.bg, marginHorizontal: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingLeft: Spacing.lg,
    borderRadius: Radius.md,
    minHeight: 64,
  },
  rowPressed: { backgroundColor: Colors.surface2 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontFamily: FontFamily.semibold, fontSize: FontSizes.base, lineHeight: 20, color: Colors.text },
  rowMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  loading: { gap: Spacing.md },
  skeletonRows: { width: '100%', height: 96, borderRadius: Radius.lg },
});
