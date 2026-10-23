import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Layers3, Search, X } from '../../../../../lib/icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, HeaderIconButton } from '../../../../../components/AppHeader';
import { HistoricoPainel } from '../../../../../components/historico/HistoricoPainel';
import {
  EmptyState,
  ErrorBanner,
  FilterChips,
  GroupLabel,
  HeroPill,
  ProgressCard,
  SearchPill,
  SegmentedControl,
  Skeleton,
  TapeHero,
  type TrenaTone,
} from '../../../../../components/ui';
import { Breakpoints, Colors, Radius, Spacing } from '../../../../../lib/constants';
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

function estadoDoAmbiente(item: AmbienteRow): { label: string; tone: TrenaTone } {
  const hasNc = item.ncs_abertas > 0;
  const noFvs = (item.total_fvs ?? 0) === 0;
  const isComplete = !noFvs && (item.fvs_concluidas ?? 0) >= item.total_fvs;
  if (hasNc) return { label: 'Com NC', tone: 'danger' };
  if (isComplete) return { label: 'Concluído', tone: 'success' };
  if (noFvs) return { label: 'Sem serviços', tone: 'neutral' };
  if ((item.fvs_concluidas ?? 0) === 0 && (item.progresso_percentual ?? 0) === 0) return { label: 'Não iniciado', tone: 'neutral' };
  return { label: 'Em andamento', tone: 'info' };
}

type ObraTab = 'ambientes' | 'historico';

const TABS: { value: ObraTab; label: string }[] = [
  { value: 'ambientes', label: 'Ambientes' },
  { value: 'historico', label: 'Histórico' },
];

export default function ObraDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<ObraTab>('ambientes');

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
  const counts = {
    todos: ambientes.length,
    interno: ambientes.filter(ambiente => ambiente.tipo === 'interno').length,
    externo: ambientes.filter(ambiente => ambiente.tipo !== 'interno').length,
    com_nc: ambientes.filter(ambiente => ambiente.ncs_abertas > 0).length,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title={obra?.nome ?? 'Obra'}
        subtitle={`${location} · ${kpi.total_ambientes} ${kpi.total_ambientes === 1 ? 'ambiente' : 'ambientes'}`}
        showBack
        onBack={() => goBack('/(app)/(tabs)/obras')}
        rightElement={tab === 'ambientes' ? (
          <HeaderIconButton
            Icon={searchOpen ? X : Search}
            label={searchOpen ? 'Fechar busca' : 'Buscar ambientes'}
            active={searchOpen}
            onPress={() => {
              if (searchOpen) setSearch('');
              setSearchOpen(open => !open);
            }}
          />
        ) : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <TapeHero
          label="Avanço da obra"
          value={progress}
          footer={obra?.eng_responsavel ? `Responsável técnico: ${obra.eng_responsavel}` : undefined}
        >
          <HeroPill label={`${kpi.fvs_concluidas}/${kpi.total_fvs} FVS concluídas`} />
          <HeroPill
            label={`${kpi.ncs_abertas} ${kpi.ncs_abertas === 1 ? 'NC aberta' : 'NCs abertas'}`}
            tone={kpi.ncs_abertas > 0 ? 'danger' : 'success'}
          />
        </TapeHero>

        <SegmentedControl
          value={tab}
          options={TABS}
          onChange={setTab}
          accessibilityLabel="Ver ambientes ou histórico da obra"
        />

        {tab === 'historico' ? (
          <HistoricoPainel obraId={id} />
        ) : (
          <>
            {searchOpen ? (
              <SearchPill value={search} onChangeText={setSearch} placeholder="Buscar por nome ou localização" autoFocus />
            ) : null}

            <FilterChips
              value={filter}
              onChange={setFilter}
              options={FILTERS.map(option => ({ ...option, count: counts[option.value] }))}
              accessibilityLabel="Filtrar ambientes por tipo ou não conformidade"
            />

            {error ? (
              <ErrorBanner message="Não foi possível carregar os ambientes." />
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
                  {group.items.map(item => (
                    <AmbienteCard
                      key={item.id}
                      item={item}
                      onOpen={() => router.push(`/obras/${id}/ambiente/${item.id}` as never)}
                    />
                  ))}
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
                actionLabel={hasRefinements ? 'Limpar busca' : undefined}
                onAction={hasRefinements ? clearAllFilters : undefined}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AmbienteCard({ item, onOpen }: { item: AmbienteRow; onOpen: () => void }) {
  const estado = estadoDoAmbiente(item);
  const progress = item.progresso_percentual ?? 0;
  const tipo = item.tipo === 'interno' ? 'Interno' : 'Externo';
  return (
    <ProgressCard
      title={item.nome}
      subtitle={[tipo, item.localizacao].filter(Boolean).join(' · ')}
      status={estado}
      progress={(item.total_fvs ?? 0) > 0 ? progress : undefined}
      progressTone={progress >= 100 ? 'success' : 'brand'}
      meta={`${item.fvs_concluidas ?? 0} de ${item.total_fvs ?? 0} FVS${item.ncs_abertas > 0 ? ` · ${item.ncs_abertas} ${item.ncs_abertas === 1 ? 'NC aberta' : 'NCs abertas'}` : ''}`}
      metaTone={item.ncs_abertas > 0 ? 'danger' : undefined}
      onPress={onOpen}
      accessibilityLabel={`Abrir ambiente ${item.nome}, ${estado.label}, ${Math.round(progress)} por cento`}
    />
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
  loading: { gap: Spacing.md },
  skeletonRows: { width: '100%', height: 120, borderRadius: Radius.lg },
});
