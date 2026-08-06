import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { Building2, ChevronRight, Search, X } from 'lucide-react-native';
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
  EmptyState,
  ErrorBanner,
  ListSurface,
  OperationalRow,
  SegmentedControl,
  Skeleton,
  type DatumTone,
} from '../../../../components/ui';
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

function datumToneFor(item: ObraRow): DatumTone {
  if (item.ncs_abertas > 0) return 'danger';
  if (item.status === 'concluida') return 'success';
  if (item.status === 'paralisada') return 'warning';
  if (item.status === 'em_andamento') return 'info';
  return 'neutral';
}

export default function ObrasScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ObraTab>('em_andamento');
  const [search, setSearch] = useState('');
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
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Obras"
        subtitle={`${activeCount} em andamento · ${doneCount} concluídas`}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.summary}>
          <View style={styles.summaryPrimary}>
            <Text style={styles.summaryEyebrow}>CARTEIRA EM CAMPO</Text>
            <Text style={styles.summaryValue}>{Math.round(portfolio.progress)}%</Text>
            <Text style={styles.summaryLabel}>avanço ponderado das FVS</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFacts}>
            <SummaryFact
              value={portfolio.completedFvs}
              label="FVS concluídas"
              tone={Colors.text}
            />
            <SummaryFact
              value={portfolio.openNc}
              label="NC abertas"
              tone={portfolio.openNc > 0 ? Colors.nok : Colors.text}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <SegmentedControl
            value={activeTab}
            options={TAB_OPTIONS}
            onChange={setActiveTab}
            accessibilityLabel="Filtrar por situação da obra"
          />

          <View style={styles.searchBox}>
            <Search size={18} color={Colors.textTertiary} />
            <TextInput
              accessibilityLabel="Buscar obras"
              style={styles.searchInput}
              placeholder="Buscar por nome ou cidade"
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
          <ErrorBanner message="Não foi possível carregar as obras." />
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
            <View key={group.status} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>{group.items.length}</Text>
                </View>
              </View>
              <ListSurface>
                {group.items.map((item, index) => (
                  <ObraRowItem
                    key={item.id}
                    item={item}
                    last={index === group.items.length - 1}
                    onOpen={() => router.push(`/obras/${item.id}` as never)}
                  />
                ))}
              </ListSurface>
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

function ObraRowItem({
  item,
  last,
  onOpen,
}: {
  item: ObraRow;
  last: boolean;
  onOpen: () => void;
}) {
  const status = OBRA_STATUS[item.status] ?? OBRA_STATUS.nao_iniciada;
  const progress = item.progresso_percentual ?? 0;
  const hasNc = item.ncs_abertas > 0;

  return (
    <OperationalRow
      tone={datumToneFor(item)}
      last={last}
      onPress={onOpen}
      accessibilityLabel={`Abrir obra ${item.nome}`}
      trailing={<ChevronRight size={19} color={Colors.textTertiary} />}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.nome}</Text>
        <Badge label={status.label} tone={status.tone} size="sm" />
      </View>
      <Text style={styles.rowContext} numberOfLines={1}>
        {item.municipio || 'Local não informado'}{item.uf ? `, ${item.uf}` : ''}
      </Text>
      <Text style={styles.rowDescription} numberOfLines={1}>
        {item.fvs_concluidas ?? 0} de {item.total_fvs ?? 0} FVS concluídas
        {hasNc ? ` · ${item.ncs_abertas} NC abertas` : ''}
      </Text>
      <View style={styles.rowFooter}>
        <Text style={[styles.footerLabel, { color: hasNc ? Colors.nok : Colors.ok }]}>
          {hasNc ? `${item.ncs_abertas} NC` : 'Sem NC'}
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
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  footerProgress: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  loading: { gap: Spacing.md },
  skeletonGroup: { width: 140, height: 20, borderRadius: Radius.sm },
  skeletonRows: { width: '100%', height: 132, borderRadius: Radius.lg },
});
