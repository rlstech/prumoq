import { useQuery } from '@powersync/react-native';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  MapPin,
  Search,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../../../components/AppHeader';
import {
  Badge,
  type BadgeTone,
  DatumCard,
  EmptyState,
  MetricBlock,
  Progress,
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
    CAST(SUM(CASE WHEN f.status IN ('conforme','concluida','concluida_ressalva') THEN 100 WHEN f.status = 'em_andamento' THEN COALESCE(f.percentual_exec, 0) ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
    (SELECT COUNT(*) FROM nao_conformidades n
     WHERE n.status = 'aberta' AND n.verificacao_id IN (
       SELECT v.id FROM verificacoes v
       JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
       JOIN ambientes a2 ON a2.id = fp.ambiente_id
       WHERE a2.obra_id = o.id
     )) AS ncs_abertas
  FROM obras o
  LEFT JOIN ambientes a ON a.obra_id = o.id
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

const OBRA_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  nao_iniciada: { label: 'Não iniciada', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'info' },
  paralisada: { label: 'Paralisada', tone: 'warning' },
  concluida: { label: 'Concluída', tone: 'success' },
};

export default function ObrasScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= Breakpoints.tablet ? 2 : 1;
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

  const { data: obras } = useQuery<ObraRow>(
    userId && perfil ? OBRAS_QUERY : 'SELECT 1 WHERE 0',
    userId && perfil ? [perfil, userId] : []
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return obras;
    const query = search.toLowerCase();
    return obras.filter(obra =>
      obra.nome.toLowerCase().includes(query)
      || obra.municipio?.toLowerCase().includes(query)
    );
  }, [obras, search]);

  const portfolio = useMemo(() => {
    const totalFvs = obras.reduce((total, obra) => total + (obra.total_fvs ?? 0), 0);
    const completedFvs = obras.reduce((total, obra) => total + (obra.fvs_concluidas ?? 0), 0);
    const openNc = obras.reduce((total, obra) => total + (obra.ncs_abertas ?? 0), 0);
    const weightedProgress = totalFvs > 0
      ? obras.reduce(
          (total, obra) => total + (obra.progresso_percentual ?? 0) * (obra.total_fvs ?? 0),
          0
        ) / totalFvs
      : 0;
    return { totalFvs, completedFvs, openNc, progress: weightedProgress };
  }, [obras]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Obras"
        subtitle={`${obras.length} ativa${obras.length !== 1 ? 's' : ''} no seu acesso`}
      >
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
        </View>
      </AppHeader>

      <FlatList
        key={columns}
        data={filtered}
        numColumns={columns}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        ListHeaderComponent={
          <View style={styles.portfolio}>
            <View style={styles.portfolioLead}>
              <Text style={styles.eyebrow}>CARTEIRA EM CAMPO</Text>
              <View style={styles.portfolioValueRow}>
                <Text style={styles.portfolioValue}>{Math.round(portfolio.progress)}</Text>
                <Text style={styles.portfolioSuffix}>%</Text>
              </View>
              <Text style={styles.portfolioCaption}>avanço ponderado das FVS</Text>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(portfolio.progress) }}
                style={styles.heroProgressTrack}
              >
                <View
                  style={[
                    styles.heroProgressFill,
                    { width: `${Math.min(Math.max(portfolio.progress, 0), 100)}%` as `${number}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.portfolioMetrics}>
              <MetricBlock
                label="FVS CONCLUÍDAS"
                value={portfolio.completedFvs}
                suffix={`/ ${portfolio.totalFvs}`}
                tone="success"
                style={styles.portfolioMetric}
              />
              <View style={styles.metricDivider} />
              <MetricBlock
                label="NC ABERTAS"
                value={portfolio.openNc}
                tone={portfolio.openNc > 0 ? 'danger' : 'neutral'}
                style={styles.portfolioMetric}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const progress = item.progresso_percentual ?? 0;
          const hasNc = item.ncs_abertas > 0;
          const status = OBRA_STATUS[item.status] ?? OBRA_STATUS.nao_iniciada;
          const datumTone = hasNc ? 'danger' : progress >= 100 ? 'success' : 'accent';

          return (
            <DatumCard
              tone={datumTone}
              style={styles.card}
              accessibilityLabel={`Abrir obra ${item.nome}`}
              onPress={() => router.push(`/obras/${item.id}` as never)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardEyebrow}>OBRA ATIVA</Text>
                  <Text style={styles.cardName} numberOfLines={2}>{item.nome}</Text>
                </View>
                <Badge label={status.label} tone={status.tone} size="sm" />
              </View>

              <View style={styles.locationRow}>
                <MapPin size={15} color={Colors.textTertiary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.municipio || 'Local não informado'}{item.uf ? `, ${item.uf}` : ''}
                </Text>
              </View>

              <View style={styles.progressBlock}>
                <View style={styles.progressValueRow}>
                  <Text style={styles.progressValue}>{Math.round(progress)}</Text>
                  <Text style={styles.progressSuffix}>%</Text>
                </View>
                <View style={styles.progressDetail}>
                  <Text style={styles.progressLabel}>AVANÇO DAS FVS</Text>
                  <Progress value={progress} tone={hasNc ? 'danger' : progress >= 100 ? 'success' : 'brand'} height={6} />
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.fvsCount}>
                  <Text style={styles.mono}>{item.fvs_concluidas}</Text>
                  {` de ${item.total_fvs} FVS concluídas`}
                </Text>
                <View style={styles.footerAction}>
                  {hasNc ? (
                    <View style={styles.ncLabel}>
                      <AlertTriangle size={14} color={Colors.nok} />
                      <Text style={styles.ncText}>{item.ncs_abertas} NC</Text>
                    </View>
                  ) : (
                    <Text style={styles.noNcText}>Sem NC</Text>
                  )}
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </View>
              </View>
            </DatumCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            Icon={Building2}
            title="Nenhuma obra encontrada"
            description={search ? 'Tente outro nome ou cidade.' : 'As obras liberadas para o seu acesso aparecerão aqui.'}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  searchBox: {
    minHeight: 48,
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.base,
  },
  list: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 104,
  },
  columns: { gap: Spacing.md },
  portfolio: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xxl,
    overflow: 'hidden',
  },
  portfolioLead: { flex: 1.25, minWidth: 220, gap: Spacing.xs },
  eyebrow: {
    ...Typography.overline,
    color: Colors.brandSignature,
  },
  portfolioValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  portfolioValue: {
    color: Colors.surface,
    fontFamily: FontFamily.monoSemibold,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  portfolioSuffix: {
    color: Colors.brandSignature,
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.lg,
  },
  portfolioCaption: { ...Typography.caption, color: Colors.surface, opacity: 0.72 },
  portfolioMetrics: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  portfolioMetric: { flex: 1 },
  metricDivider: { width: 1, height: 48, backgroundColor: Colors.border },
  heroProgressTrack: {
    height: 7,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.brandSignature,
  },
  card: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  cardTitleGroup: { flex: 1, gap: 3 },
  cardEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  cardName: { ...Typography.heading, color: Colors.text },
  locationRow: {
    minHeight: 28,
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  progressBlock: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.lg,
  },
  progressValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  progressValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 34,
    lineHeight: 38,
    color: Colors.brand,
    letterSpacing: -1,
  },
  progressSuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.sm,
    color: Colors.brand,
  },
  progressDetail: { flex: 1, gap: 6, paddingBottom: 4 },
  progressLabel: { ...Typography.overline, color: Colors.textTertiary },
  cardFooter: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  fvsCount: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  mono: { fontFamily: FontFamily.monoSemibold, color: Colors.text },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ncLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    minHeight: 28,
  },
  ncText: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.semibold },
  noNcText: { ...Typography.caption, color: Colors.ok, fontFamily: FontFamily.medium },
});
