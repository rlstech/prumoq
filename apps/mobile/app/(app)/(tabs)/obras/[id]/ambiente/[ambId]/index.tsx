import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardCheck,
  History,
  Layers3,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppHeader } from '../../../../../../../components/AppHeader';
import {
  Badge,
  type BadgeTone,
  Chip,
  DatumCard,
  type DatumTone,
  EmptyState,
  MetricBlock,
  Progress,
  SectionTitle,
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

interface ServiceStatus {
  label: string;
  tone: BadgeTone;
  datum: DatumTone;
  Icon: LucideIcon;
}

const SERVICE_FILTERS: { key: ServiceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'em_curso', label: 'Em curso' },
  { key: 'concluidos', label: 'Concluídos' },
];

const STATUS: Record<string, ServiceStatus> = {
  conforme: { label: 'Concluído', tone: 'success', datum: 'success', Icon: CheckCircle2 },
  concluida: { label: 'Concluído', tone: 'success', datum: 'success', Icon: CheckCircle2 },
  concluida_ressalva: { label: 'Com ressalva', tone: 'warning', datum: 'warning', Icon: CircleAlert },
  nao_conforme: { label: 'NC aberta', tone: 'danger', datum: 'danger', Icon: AlertTriangle },
  em_andamento: { label: 'Em andamento', tone: 'info', datum: 'info', Icon: ArrowRight },
  em_revisao: { label: 'Em revisão', tone: 'info', datum: 'info', Icon: ClipboardCheck },
  pendente: { label: 'Pendente', tone: 'neutral', datum: 'neutral', Icon: Circle },
};

function getStatus(status: string): ServiceStatus {
  return STATUS[status] ?? STATUS.pendente;
}

function formatDate(value: string): string {
  const normalized = value.length === 10 ? `${value}T00:00:00` : value;
  return new Date(normalized).toLocaleDateString('pt-BR');
}

export default function AmbienteScreen() {
  const { id, ambId } = useLocalSearchParams<{ id: string; ambId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const [filter, setFilter] = useState<ServiceFilter>('todos');

  const { data: ambienteRows } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao, o.nome AS obra_nome
    FROM ambientes a
    JOIN obras o ON o.id = a.obra_id
    WHERE a.id = ?
  `, [ambId]);
  const ambiente = ambienteRows[0];

  const { data: fvsList } = useQuery<FvsRow>(`
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
    if (filter === 'atencao') return fvsList.filter(item => item.ncs_abertas > 0);
    if (filter === 'em_curso') return fvsList.filter(item => IN_PROGRESS_FVS_STATUSES.has(item.status));
    if (filter === 'concluidos') return fvsList.filter(item => COMPLETED_FVS_STATUSES.has(item.status));
    return fvsList;
  }, [filter, fvsList]);

  const subtitle = [
    ambiente?.tipo === 'interno' ? 'Interno' : 'Externo',
    ambiente?.localizacao || null,
    ambiente?.obra_nome || null,
  ].filter(Boolean).join(' · ');

  const summaryPanel = (
    <DatumCard tone={summary.attention > 0 ? 'danger' : 'accent'} style={styles.summaryCard}>
      <Text style={styles.summaryEyebrow}>CONTROLE DO AMBIENTE</Text>
      <View style={styles.summaryProgressRow}>
        <View style={styles.summaryValueRow}>
          <Text style={styles.summaryValue}>{Math.round(summary.progress)}</Text>
          <Text style={styles.summarySuffix}>%</Text>
        </View>
        <Text style={styles.summaryProgressLabel}>das FVS concluídas</Text>
      </View>
      <Progress
        value={summary.progress}
        tone={summary.attention > 0 ? 'danger' : 'brand'}
        height={8}
      />

      <View style={styles.summaryMetrics}>
        <MetricBlock
          label="CONCLUÍDAS"
          value={summary.completed}
          suffix={`/ ${summary.total}`}
          tone="success"
          style={styles.summaryMetric}
        />
        <View style={styles.summaryMetricDivider} />
        <MetricBlock
          label="EM CURSO"
          value={summary.inProgress}
          tone="info"
          style={styles.summaryMetric}
        />
        <View style={styles.summaryMetricDivider} />
        <MetricBlock
          label="ATENÇÃO"
          value={summary.attention}
          tone={summary.attention > 0 ? 'danger' : 'neutral'}
          style={styles.summaryMetric}
        />
      </View>

      <View style={styles.contextBlock}>
        <Text style={styles.contextLabel}>CONTEXTO</Text>
        <Text style={styles.contextValue}>
          {ambiente?.tipo === 'interno' ? 'Ambiente interno' : 'Ambiente externo'}
        </Text>
        {ambiente?.localizacao ? (
          <Text style={styles.contextSecondary}>{ambiente.localizacao}</Text>
        ) : null}
        {ambiente?.obra_nome ? (
          <Text style={styles.contextSecondary}>{ambiente.obra_nome}</Text>
        ) : null}
      </View>
    </DatumCard>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={ambiente?.nome ?? 'Ambiente'}
        subtitle={subtitle}
        showBack
        onBack={goBack}
      />

      <View style={[styles.workspace, isTablet && styles.workspaceTablet]}>
        {isTablet ? <View style={styles.sidebar}>{summaryPanel}</View> : null}

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.serviceList}
          contentContainerStyle={styles.serviceListContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {!isTablet ? summaryPanel : null}
              <SectionTitle
                eyebrow="PLANO DE INSPEÇÃO"
                title="Serviços planejados"
                description={`${filtered.length} de ${fvsList.length} serviços exibidos`}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {SERVICE_FILTERS.map(option => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    selected={filter === option.key}
                    onPress={() => setFilter(option.key)}
                    Icon={option.key === 'atencao' ? AlertTriangle : undefined}
                  />
                ))}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => {
            const status = getStatus(item.status);
            const hasOpenNc = item.ncs_abertas > 0;
            return (
              <DatumCard
                tone={hasOpenNc ? 'danger' : status.datum}
                accessibilityLabel={`Abrir serviço ${item.subservico || 'sem nome'}, ${status.label}${hasOpenNc ? ', com NC aberta' : ''}`}
                onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
              >
                <View style={styles.serviceTop}>
                  <View style={styles.serviceIdentity}>
                    <Text style={styles.serviceName} numberOfLines={2}>
                      {item.subservico || 'Serviço'}
                    </Text>
                    <Badge
                      label={status.label}
                      tone={status.tone}
                      Icon={status.Icon}
                      size="sm"
                    />
                    {hasOpenNc ? (
                      <Badge
                        label={item.ncs_abertas === 1 ? '1 NC aberta' : `${item.ncs_abertas} NC abertas`}
                        tone="danger"
                        Icon={AlertTriangle}
                        size="sm"
                      />
                    ) : null}
                  </View>
                  <ChevronRight size={20} color={Colors.textTertiary} />
                </View>

                <View style={styles.serviceFooter}>
                  <View style={styles.serviceMeta}>
                    <History size={15} color={Colors.textTertiary} />
                    <Text style={styles.serviceMetaText}>
                      {item.ultima_verif
                        ? `Última verificação em ${formatDate(item.ultima_verif)}`
                        : 'Ainda não iniciado'}
                    </Text>
                  </View>
                  <View style={styles.verificationCount}>
                    <Text style={styles.verificationValue}>{item.total_verificacoes}</Text>
                    <Text style={styles.verificationLabel}>
                      {item.total_verificacoes === 1 ? ' verificação' : ' verificações'}
                    </Text>
                  </View>
                </View>
              </DatumCard>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              Icon={Layers3}
              title="Nenhum serviço neste filtro"
              description={fvsList.length === 0
                ? 'Este ambiente ainda não possui FVS planejadas.'
                : 'Selecione outro filtro para visualizar os serviços.'}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  workspace: {
    flex: 1,
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
  },
  workspaceTablet: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xxl,
  },
  sidebar: {
    width: 330,
    paddingVertical: Spacing.lg,
  },
  summaryCard: { width: '100%' },
  summaryEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  summaryProgressRow: { marginTop: Spacing.md, gap: 2 },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  summaryValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.5,
    color: Colors.brand,
  },
  summarySuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.lg,
    color: Colors.brand,
  },
  summaryProgressLabel: { ...Typography.caption, color: Colors.textSecondary },
  summaryMetrics: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryMetric: { flex: 1, minWidth: 0 },
  summaryMetricDivider: { width: 1, height: 48, backgroundColor: Colors.border },
  contextBlock: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    gap: 3,
  },
  contextLabel: { ...Typography.overline, color: Colors.textTertiary },
  contextValue: { ...Typography.label, color: Colors.text, marginTop: 3 },
  contextSecondary: { ...Typography.caption, color: Colors.textSecondary },
  serviceList: { flex: 1 },
  serviceListContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 104,
  },
  listHeader: { gap: Spacing.xxl, marginBottom: Spacing.xs },
  filters: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  serviceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  serviceIdentity: { flex: 1, gap: Spacing.sm, alignItems: 'flex-start' },
  serviceName: { ...Typography.heading, color: Colors.text },
  serviceFooter: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 210 },
  serviceMetaText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  verificationCount: { flexDirection: 'row', alignItems: 'baseline' },
  verificationValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  verificationLabel: { ...Typography.caption, color: Colors.textSecondary },
});
