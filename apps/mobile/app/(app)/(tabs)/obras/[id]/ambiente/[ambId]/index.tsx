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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppHeader } from '../../../../../../../components/AppHeader';
import {
  Chip,
  type DatumTone,
  EmptyState,
  ListSurface,
  OperationalRow,
  Progress,
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
  datum: DatumTone;
  color: string;
  background: string;
  Icon: LucideIcon;
}

const SERVICE_FILTERS: { key: ServiceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'em_curso', label: 'Em curso' },
  { key: 'concluidos', label: 'Concluídos' },
];

const STATUS: Record<string, ServiceStatus> = {
  conforme: {
    label: 'Concluído',
    datum: 'success',
    color: Colors.ok,
    background: Colors.okBg,
    Icon: CheckCircle2,
  },
  concluida: {
    label: 'Concluído',
    datum: 'success',
    color: Colors.ok,
    background: Colors.okBg,
    Icon: CheckCircle2,
  },
  concluida_ressalva: {
    label: 'Com ressalva',
    datum: 'warning',
    color: Colors.warn,
    background: Colors.warnBg,
    Icon: CircleAlert,
  },
  nao_conforme: {
    label: 'NC aberta',
    datum: 'danger',
    color: Colors.nok,
    background: Colors.nokBg,
    Icon: AlertTriangle,
  },
  em_andamento: {
    label: 'Em andamento',
    datum: 'info',
    color: Colors.info,
    background: Colors.infoBg,
    Icon: ArrowRight,
  },
  em_revisao: {
    label: 'Em revisão',
    datum: 'info',
    color: Colors.info,
    background: Colors.infoBg,
    Icon: ClipboardCheck,
  },
  pendente: {
    label: 'Pendente',
    datum: 'neutral',
    color: Colors.textTertiary,
    background: Colors.surface2,
    Icon: Circle,
  },
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

  return (
    <SafeAreaView style={styles.safe}>
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
          <View style={styles.summaryHeading}>
            <Text style={styles.summaryTitle}>Progresso do ambiente</Text>
            <View style={styles.summaryValue}>
              <Text style={styles.summaryPercent}>{Math.round(summary.progress)}</Text>
              <Text style={styles.summarySuffix}>%</Text>
            </View>
          </View>

          <Progress
            value={summary.progress}
            tone={summary.attention > 0 ? 'danger' : summary.progress === 100 ? 'success' : 'brand'}
            height={5}
          />

          <View style={styles.summaryMeta}>
            <Text style={styles.summaryMetaText}>
              <Text style={styles.summaryMetaValue}>{summary.completed}/{summary.total}</Text>
              {' concluídas'}
            </Text>
            <View style={styles.metaDot} />
            <Text style={styles.summaryMetaText}>
              {summary.inProgress} em curso
            </Text>
            <View style={styles.metaDot} />
            <Text style={[
              styles.summaryMetaText,
              summary.attention > 0 && styles.summaryMetaDanger,
            ]}>
              {summary.attention} com atenção
            </Text>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Serviços</Text>
          <Text style={styles.listCount}>
            {filtered.length}{filter === 'todos' ? '' : ` de ${fvsList.length}`}
          </Text>
        </View>

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

        {filtered.length > 0 ? (
          <ListSurface>
            {filtered.map((item, index) => {
              const status = getStatus(item.status);
              const hasOpenNc = item.ncs_abertas > 0;
              const StatusIcon = hasOpenNc ? AlertTriangle : status.Icon;
              const iconColor = hasOpenNc ? Colors.nok : status.color;
              const iconBackground = hasOpenNc ? Colors.nokBg : status.background;
              const ncLabel = item.ncs_abertas === 1
                ? '1 NC aberta'
                : `${item.ncs_abertas} NC abertas`;

              return (
                <OperationalRow
                  key={item.id}
                  tone={hasOpenNc ? 'danger' : status.datum}
                  last={index === filtered.length - 1}
                  accessibilityLabel={`Abrir serviço ${item.subservico || 'sem nome'}, ${status.label}${hasOpenNc ? `, ${ncLabel}` : ''}`}
                  onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
                  leading={(
                    <View style={[styles.statusIcon, { backgroundColor: iconBackground }]}>
                      <StatusIcon size={17} color={iconColor} strokeWidth={2.2} />
                    </View>
                  )}
                  trailing={<ChevronRight size={19} color={Colors.textTertiary} />}
                >
                  <View style={[styles.rowContent, isTablet && styles.rowContentTablet]}>
                    <View style={styles.identity}>
                      <Text style={styles.serviceName} numberOfLines={2}>
                        {item.subservico || 'Serviço'}
                      </Text>
                      <View style={styles.lastInspection}>
                        <History size={13} color={Colors.textTertiary} />
                        <Text style={styles.lastInspectionText} numberOfLines={1}>
                          {item.ultima_verif
                            ? `Última verificação em ${formatDate(item.ultima_verif)}`
                            : 'Não iniciado'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.verifications, isTablet && styles.verificationsTablet]}>
                      <Text style={styles.verificationValue}>{item.total_verificacoes}</Text>
                      <Text style={styles.verificationLabel}>
                        {item.total_verificacoes === 1 ? ' verificação' : ' verificações'}
                      </Text>
                    </View>

                    <View style={[styles.stateColumn, isTablet && styles.stateColumnTablet]}>
                      <Text style={[styles.stateText, { color: status.color }]}>
                        {status.label}
                      </Text>
                      {hasOpenNc ? (
                        <View style={styles.ncState}>
                          <AlertTriangle size={12} color={Colors.nok} />
                          <Text style={styles.ncStateText}>{ncLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </OperationalRow>
              );
            })}
          </ListSurface>
        ) : (
          <View style={styles.emptySurface}>
            <EmptyState
              Icon={Layers3}
              title="Nenhum serviço neste filtro"
              description={fvsList.length === 0
                ? 'Este ambiente ainda não possui FVS planejadas.'
                : 'Selecione outro filtro para visualizar os serviços.'}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    gap: Spacing.lg,
  },
  summary: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  summaryTitle: { ...Typography.label, color: Colors.text },
  summaryValue: { flexDirection: 'row', alignItems: 'baseline' },
  summaryPercent: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xxl,
    lineHeight: 30,
    color: Colors.brand,
  },
  summarySuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xs,
    color: Colors.brand,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryMetaText: { ...Typography.caption, color: Colors.textSecondary },
  summaryMetaValue: { fontFamily: FontFamily.monoSemibold, color: Colors.text },
  summaryMetaDanger: { color: Colors.nok, fontFamily: FontFamily.medium },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderNormal,
  },
  listHeading: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  listTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xl,
    lineHeight: 28,
    color: Colors.text,
  },
  listCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  filters: { gap: Spacing.sm, paddingRight: Spacing.lg },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { gap: Spacing.sm },
  rowContentTablet: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  identity: { flex: 1, minWidth: 0, gap: 5 },
  serviceName: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
    lineHeight: 22,
    color: Colors.text,
  },
  lastInspection: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lastInspectionText: { ...Typography.caption, color: Colors.textSecondary, flexShrink: 1 },
  verifications: { flexDirection: 'row', alignItems: 'baseline' },
  verificationsTablet: { width: 130 },
  verificationValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  verificationLabel: { ...Typography.caption, color: Colors.textSecondary },
  stateColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stateColumnTablet: {
    width: 170,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
  },
  stateText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  ncState: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ncStateText: {
    ...Typography.caption,
    color: Colors.nok,
    fontFamily: FontFamily.medium,
  },
  emptySurface: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
