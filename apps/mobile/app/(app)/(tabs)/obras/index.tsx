import { useQuery } from '@powersync/react';
import { useRouter } from 'expo-router';
import { Building2, Search, X } from '../../../../lib/icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, HeaderIconButton } from '../../../../components/AppHeader';
import {
  type BadgeTone,
  EmptyState,
  ErrorBanner,
  GroupLabel,
  HeroPill,
  ProgressCard,
  SearchPill,
  FilterChips,
  Skeleton,
  TapeHero,
} from '../../../../components/ui';
import { Breakpoints, Colors, Radius, Spacing } from '../../../../lib/constants';
import { useConta } from '../../../../lib/auth/sessao';

interface ObraRow {
  id: string;
  nome: string;
  status: string;
  municipio: string;
  uf: string;
  total_fvs: number;
  fvs_concluidas: number;
  progresso_percentual: number;
  ncs_abertas: number;
}

const OBRAS_QUERY = `
  SELECT
    o.id,
    o.nome,
    o.status,
    o.municipio,
    o.uf,
    COUNT(DISTINCT f.id) AS total_fvs,
    COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS fvs_concluidas,
    COALESCE(CAST(COUNT(DISTINCT CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN f.id END) AS REAL) * 100 / NULLIF(COUNT(DISTINCT f.id), 0), 0) AS progresso_percentual,
    (SELECT COUNT(*) FROM nao_conformidades n
     WHERE n.status IN ('aberta','em_correcao') AND n.verificacao_id IN (
       SELECT v.id FROM verificacoes v
       JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
       JOIN ambientes a2 ON a2.id = fp.ambiente_id
       WHERE a2.obra_id = o.id
         AND a2.ativo = 1
     )) AS ncs_abertas
  FROM obras o
  LEFT JOIN ambientes a ON a.obra_id = o.id AND a.ativo = 1
  LEFT JOIN fvs_planejadas f ON f.ambiente_id = a.id
  WHERE o.ativo = 1
    AND (
      ? = 'admin'
      OR EXISTS (
        SELECT 1 FROM obra_usuarios ou
        WHERE ou.obra_id = o.id AND ou.usuario_id = ?
      )
    )
  GROUP BY o.id
  ORDER BY o.nome
`;

type ObraTab = 'em_andamento' | 'concluidas' | 'todas';

const TAB_OPTIONS = [
  { value: 'em_andamento' as const, label: 'Em andamento' },
  { value: 'concluidas' as const, label: 'Concluídas' },
  { value: 'todas' as const, label: 'Todas' },
];

const OBRA_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  nao_iniciada: { label: 'Não iniciada', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'info' },
  paralisada: { label: 'Paralisada', tone: 'warning' },
  concluida: { label: 'Concluída', tone: 'success' },
};

const GROUP_ORDER: { status: string; title: string }[] = [
  { status: 'em_andamento', title: 'Em andamento' },
  { status: 'paralisada', title: 'Paralisada' },
  { status: 'nao_iniciada', title: 'Não iniciada' },
  { status: 'concluida', title: 'Concluída' },
];

export default function ObrasScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ObraTab>('em_andamento');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const conta = useConta();
  const userId = conta?.usuarioId ?? null;
  const perfil: string | null = conta?.perfil ?? null;

  const ready = Boolean(userId && perfil);
  const {
    data: obras,
    isLoading,
    error,
  } = useQuery<ObraRow>(
    ready ? OBRAS_QUERY : 'SELECT 1 WHERE 0',
    ready ? [perfil, userId] : []
  );

  const portfolio = useMemo(() => {
    const totalFvs = obras.reduce((total, obra) => total + (obra.total_fvs ?? 0), 0);
    const completedFvs = obras.reduce((total, obra) => total + (obra.fvs_concluidas ?? 0), 0);
    const openNc = obras.reduce((total, obra) => total + (obra.ncs_abertas ?? 0), 0);
    const progress = totalFvs > 0 ? (completedFvs / totalFvs) * 100 : 0;
    return { totalFvs, completedFvs, openNc, progress };
  }, [obras]);

  const activeCount = useMemo(
    () =>
      obras.filter(obra => obra.status === 'em_andamento' || obra.status === 'paralisada').length,
    [obras]
  );
  const doneCount = useMemo(
    () => obras.filter(obra => obra.status === 'concluida').length,
    [obras]
  );

  const filtered = useMemo(() => {
    let list = obras;
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        obra =>
          obra.nome.toLowerCase().includes(query) ||
          obra.municipio?.toLowerCase().includes(query)
      );
    }
    if (activeTab === 'em_andamento') {
      list = list.filter(obra => obra.status === 'em_andamento' || obra.status === 'paralisada');
    } else if (activeTab === 'concluidas') {
      list = list.filter(obra => obra.status === 'concluida');
    }
    return list;
  }, [obras, search, activeTab]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map(group => ({
        ...group,
        items: filtered.filter(obra => obra.status === group.status),
      })).filter(group => group.items.length > 0),
    [filtered]
  );

  const hasRefinements = Boolean(search.trim());

  function clearAllFilters() {
    setSearch('');
  }

  const emptyTitle = hasRefinements
    ? 'Nenhuma obra corresponde aos filtros'
    : activeTab === 'em_andamento'
      ? 'Nenhuma obra em andamento'
      : activeTab === 'concluidas'
        ? 'Nenhuma obra concluída'
        : 'Nenhuma obra encontrada';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title="Obras"
        subtitle={`${activeCount} em andamento · ${doneCount} concluídas`}
        rightElement={(
          <HeaderIconButton
            Icon={searchOpen ? X : Search}
            label={searchOpen ? 'Fechar busca' : 'Buscar obras'}
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
          <SearchPill value={search} onChangeText={setSearch} placeholder="Buscar por nome ou cidade" autoFocus />
        ) : null}

        <TapeHero label="Avanço da carteira" value={portfolio.progress}>
          <HeroPill label={`${portfolio.completedFvs}/${portfolio.totalFvs} FVS concluídas`} />
          <HeroPill
            label={`${portfolio.openNc} ${portfolio.openNc === 1 ? 'NC aberta' : 'NCs abertas'}`}
            tone={portfolio.openNc > 0 ? 'danger' : 'success'}
          />
        </TapeHero>

        <FilterChips
          value={activeTab}
          options={TAB_OPTIONS.map(option => ({
            ...option,
            count: option.value === 'em_andamento' ? activeCount : option.value === 'concluidas' ? doneCount : obras.length,
          }))}
          onChange={setActiveTab}
          accessibilityLabel="Filtrar por situação da obra"
        />

        {error ? (
          <ErrorBanner message="Não foi possível carregar as obras." />
        ) : null}

        {!ready || isLoading ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonRows} />
            <Skeleton style={styles.skeletonRows} />
          </View>
        ) : groups.length ? (
          groups.map(group => (
            <View key={group.status} style={styles.group}>
              <GroupLabel label={group.title} count={group.items.length} />
              {group.items.map(item => (
                <ObraCard
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(`/obras/${item.id}` as never)}
                />
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            Icon={hasRefinements ? Search : Building2}
            title={emptyTitle}
            description={
              hasRefinements
                ? 'Ajuste a busca para ampliar os resultados.'
                : 'As obras liberadas para o seu acesso aparecerão aqui.'
            }
            actionLabel={hasRefinements ? 'Limpar busca' : undefined}
            onAction={hasRefinements ? clearAllFilters : undefined}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ObraCard({ item, onOpen }: { item: ObraRow; onOpen: () => void }) {
  const status = OBRA_STATUS[item.status] ?? OBRA_STATUS.nao_iniciada;
  const progress = item.progresso_percentual ?? 0;
  const hasNc = item.ncs_abertas > 0;
  const local = `${item.municipio || 'Local não informado'}${item.uf ? `, ${item.uf}` : ''}`;
  return (
    <ProgressCard
      title={item.nome}
      subtitle={local}
      status={status}
      progress={progress}
      progressTone={progress >= 100 ? 'success' : 'brand'}
      meta={`${item.fvs_concluidas ?? 0} de ${item.total_fvs ?? 0} FVS${hasNc ? ` · ${item.ncs_abertas} ${item.ncs_abertas === 1 ? 'NC aberta' : 'NCs abertas'}` : ''}`}
      metaTone={hasNc ? 'danger' : undefined}
      onPress={onOpen}
      accessibilityLabel={`Abrir obra ${item.nome}, ${local}, ${Math.round(progress)} por cento${hasNc ? `, ${item.ncs_abertas} não conformidades abertas` : ''}`}
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
  skeletonRows: { width: '100%', height: 132, borderRadius: Radius.lg },
});
