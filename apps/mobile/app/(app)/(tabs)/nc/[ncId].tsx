import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  HardHat,
  History,
  MapPin,
  RotateCcw,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '../../../../components/AppHeader';
import { PhotoGrid } from '../../../../components/PhotoGrid';
import { PhotoViewer } from '../../../../components/PhotoViewer';
import {
  Badge,
  type BadgeTone,
  BottomActionBar,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Skeleton,
} from '../../../../components/ui';
import {
  buildNcLifecycle,
  ncPriorityLabel,
  ncStatusLabel,
  type NcReinspectionSource,
} from '../../../../lib/nc-detail';
import { getNcTiming, isActionableNc } from '../../../../lib/nc-list';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../lib/constants';
import { goBack } from '../../../../lib/navigation';
import { formatDateOnly, formatDateTime } from '../../../../lib/verification-detail';

interface NcDetailRow {
  id: string;
  verificacao_id: string;
  verificacao_item_id: string;
  descricao: string;
  solucao_proposta: string;
  responsavel_id: string | null;
  data_nova_verif: string | null;
  prioridade: string;
  status: string;
  numero_ocorrencia: number;
  nc_anterior_id: string | null;
  verificacao_reinsp_id: string | null;
  foto_reinspecao_url: string | null;
  resolvida_na_verif_id: string | null;
  resolvida_em: string | null;
  observacao_resolucao: string | null;
  created_at: string | null;
  updated_at: string | null;
  item_titulo: string;
  item_metodo: string | null;
  item_tolerancia: string | null;
  item_resultado: string;
  numero_verif: number;
  data_verif: string;
  inspetor_nome: string | null;
  inspetor_cargo: string | null;
  equipe_nome: string | null;
  responsavel_nome: string | null;
  fvs_planejada_id: string;
  subservico: string;
  ambiente_id: string;
  ambiente_nome: string;
  obra_id: string;
  obra_nome: string;
}

interface NcPhotoRow {
  id: string;
  nc_id: string;
  r2_key: string;
  r2_thumb_key: string | null;
  nome_arquivo: string | null;
  ordem: number;
}

interface NcReinspectionRow extends NcReinspectionSource {
  nc_id: string;
  verificacao_id: string;
}

interface RelatedNcRow {
  id: string;
  numero_ocorrencia: number;
  status: string;
  descricao: string;
}

interface ViewerState {
  photos: string[];
  initialIndex: number;
}

const NC_DETAIL_QUERY = `
  SELECT n.id, n.verificacao_id, n.verificacao_item_id, n.descricao,
         n.solucao_proposta, n.responsavel_id, n.data_nova_verif,
         n.prioridade, n.status, n.numero_ocorrencia, n.nc_anterior_id,
         n.verificacao_reinsp_id, n.foto_reinspecao_url,
         n.resolvida_na_verif_id, n.resolvida_em, n.observacao_resolucao,
         n.created_at, n.updated_at,
         vi.titulo AS item_titulo, vi.metodo_verif AS item_metodo,
         vi.tolerancia AS item_tolerancia, vi.resultado AS item_resultado,
         v.numero_verif, v.data_verif,
         u.nome AS inspetor_nome, u.cargo AS inspetor_cargo,
         ev.nome AS equipe_nome, er.nome AS responsavel_nome,
         fp.id AS fvs_planejada_id, fp.subservico,
         a.id AS ambiente_id, a.nome AS ambiente_nome,
         o.id AS obra_id, o.nome AS obra_nome
  FROM nao_conformidades n
  JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
  JOIN verificacoes v ON v.id = n.verificacao_id
  LEFT JOIN usuarios u ON u.id = v.inspetor_id
  LEFT JOIN equipes ev ON ev.id = v.equipe_id
  LEFT JOIN equipes er ON er.id = n.responsavel_id
  JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
  JOIN ambientes a ON a.id = fp.ambiente_id
  JOIN obras o ON o.id = a.obra_id
  WHERE n.id = ?
`;

export default function NcDetailScreen() {
  const { ncId } = useLocalSearchParams<{ ncId: string }>();
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const detailQuery = useQuery<NcDetailRow>(NC_DETAIL_QUERY, [ncId]);
  const photoQuery = useQuery<NcPhotoRow>(`
    SELECT nf.id, nf.nc_id, nf.r2_key, nf.r2_thumb_key, nf.nome_arquivo, nf.ordem
    FROM nc_fotos nf
    WHERE nf.nc_id = ?
    ORDER BY nf.ordem ASC
  `, [ncId]);
  const reinspectionQuery = useQuery<NcReinspectionRow>(`
    SELECT nr.id, nr.nc_id, nr.verificacao_id, nr.inspetor_id,
           nr.resultado, nr.observacao, nr.foto_url, nr.nova_nc_id,
           nr.created_at, u.nome AS inspetor_nome,
           v.numero_verif
    FROM nc_reinspecoes nr
    LEFT JOIN usuarios u ON u.id = nr.inspetor_id
    LEFT JOIN verificacoes v ON v.id = nr.verificacao_id
    WHERE nr.nc_id = ?
    ORDER BY nr.created_at ASC
  `, [ncId]);

  const nc = detailQuery.data[0];
  const previousQuery = useQuery<RelatedNcRow>(`
    SELECT n.id, n.numero_ocorrencia, n.status, n.descricao
    FROM nao_conformidades n
    WHERE n.id = ?
  `, [nc?.nc_anterior_id ?? '']);
  const nextQuery = useQuery<RelatedNcRow>(`
    SELECT n.id, n.numero_ocorrencia, n.status, n.descricao
    FROM nao_conformidades n
    WHERE n.nc_anterior_id = ?
    ORDER BY n.numero_ocorrencia ASC
  `, [ncId]);

  const lifecycle = useMemo(
    () => nc ? buildNcLifecycle(nc, reinspectionQuery.data) : [],
    [nc, reinspectionQuery.data],
  );
  const evidence = useMemo(
    () => photoQuery.data.map(photo => photo.r2_key),
    [photoQuery.data],
  );
  const actionable = nc ? isActionableNc(nc.status) : false;
  const timing = getNcTiming(nc?.data_nova_verif);
  const loading = detailQuery.isLoading;
  const error = detailQuery.error ?? photoQuery.error ?? reinspectionQuery.error;

  function openViewer(photos: string[], initialIndex = 0) {
    setViewer({ photos, initialIndex });
  }

  function openVerification(verificationId: string) {
    if (!nc) return;
    router.push(
      `/obras/${nc.obra_id}/ambiente/${nc.ambiente_id}/fvs/${nc.fvs_planejada_id}/verificacao/${verificationId}` as never,
    );
  }

  function openReinspection() {
    if (!nc) return;
    router.push(
      `/obras/${nc.obra_id}/ambiente/${nc.ambiente_id}/fvs/${nc.fvs_planejada_id}/verificacao/nova` as never,
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Não conformidade" showBack onBack={() => goBack('/nc')} />
        <View style={styles.loading}>
          <Skeleton style={styles.skeletonHero} />
          <Skeleton style={styles.skeletonCard} />
          <Skeleton style={styles.skeletonCard} />
        </View>
      </SafeAreaView>
    );
  }

  if (!nc) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Não conformidade" showBack onBack={() => goBack('/nc')} />
        <View style={styles.notFound}>
          {error ? <ErrorBanner message="Não foi possível carregar o registro." /> : null}
          <EmptyState
            Icon={FileQuestion}
            title="Registro não encontrado"
            description="A NC pode ter sido removida ou não estar disponível para o seu acesso."
            actionLabel="Voltar para a lista"
            onAction={() => router.replace('/nc' as never)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={`NC · ocorrência ${nc.numero_ocorrencia}`}
        subtitle={`${nc.obra_nome} · ${nc.ambiente_nome}`}
        showBack
        onBack={() => goBack('/nc')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, actionable && styles.contentWithAction]}
      >
        {error ? <ErrorBanner message="Alguns detalhes não puderam ser carregados." /> : null}

        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>ITEM NÃO CONFORME</Text>
              <Text style={styles.title}>{nc.item_titulo}</Text>
              <Text style={styles.service}>{nc.subservico}</Text>
            </View>
            <Badge
              label={ncStatusLabel(nc.status)}
              tone={statusTone(nc.status)}
              Icon={nc.status === 'resolvida' ? CheckCircle2 : AlertTriangle}
            />
          </View>
          <View style={styles.heroMeta}>
            <MetaPill
              Icon={CalendarDays}
              label={
                actionable
                  ? timing.label
                  : nc.status === 'resolvida'
                    ? `Resolvida em ${formatDateOnly(nc.resolvida_em)}`
                    : ncStatusLabel(nc.status)
              }
              tone={deadlineColor(timing.bucket, actionable)}
            />
            <MetaPill
              Icon={ShieldCheck}
              label={`Prioridade ${ncPriorityLabel(nc.prioridade).toLocaleLowerCase('pt-BR')}`}
              tone={priorityColor(nc.prioridade)}
            />
          </View>
        </Card>

        <Section
          eyebrow="OCORRÊNCIA"
          title="Problema e encaminhamento"
          Icon={AlertTriangle}
        >
          <DetailBlock label="Descrição" value={nc.descricao} emphasized />
          <DetailBlock label="Solução proposta" value={nc.solucao_proposta} />
          <View style={styles.fieldGrid}>
            <DetailField
              label="Responsável"
              value={nc.responsavel_nome ?? 'Não informado'}
              Icon={UsersRound}
            />
            <DetailField
              label="Prazo"
              value={formatDateOnly(nc.data_nova_verif)}
              Icon={CalendarDays}
            />
          </View>
        </Section>

        <Section eyebrow="CONTEXTO" title="Origem da ocorrência" Icon={ClipboardCheck}>
          <View style={styles.contextList}>
            <ContextRow Icon={HardHat} label="Obra" value={nc.obra_nome} />
            <ContextRow Icon={MapPin} label="Ambiente" value={nc.ambiente_nome} />
            <ContextRow Icon={Wrench} label="Serviço" value={nc.subservico} />
            <ContextRow
              Icon={ClipboardCheck}
              label="Verificação"
              value={`Verificação ${nc.numero_verif} · ${formatDateOnly(nc.data_verif)}`}
            />
            <ContextRow
              Icon={UserRound}
              label="Inspetor"
              value={[
                nc.inspetor_nome,
                nc.inspetor_cargo,
              ].filter(Boolean).join(' · ') || 'Não informado'}
            />
            <ContextRow
              Icon={UsersRound}
              label="Equipe executora"
              value={nc.equipe_nome ?? 'Não informada'}
              last
            />
          </View>
          <View style={styles.itemDetails}>
            <DetailBlock label="Item verificado" value={nc.item_titulo} />
            <DetailBlock label="Método de verificação" value={nc.item_metodo ?? 'Não informado'} />
            <DetailBlock label="Tolerância / critério" value={nc.item_tolerancia ?? 'Não informado'} />
          </View>
          <Button
            label="Ver verificação de origem"
            variant="secondary"
            onPress={() => openVerification(nc.verificacao_id)}
          />
        </Section>

        <Section eyebrow="EVIDÊNCIAS" title="Registro fotográfico" Icon={Camera}>
          {evidence.length ? (
            <PhotoGrid
              photos={evidence}
              onPress={index => openViewer(evidence, index)}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhuma foto foi anexada à ocorrência.</Text>
          )}
        </Section>

        <Section eyebrow="HISTÓRICO" title="Ciclo da não conformidade" Icon={History}>
          <View style={styles.timeline}>
            {lifecycle.map((event, index) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: timelineColor(event.tone) }]} />
                  {index < lifecycle.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineBody}>
                  <View style={styles.timelineHeading}>
                    <Text style={styles.timelineTitle}>{event.title}</Text>
                    <Text style={styles.timelineDate}>
                      {formatDateTime(event.date) ?? 'Data não informada'}
                    </Text>
                  </View>
                  {event.person ? (
                    <Text style={styles.timelinePerson}>
                      {event.person}
                      {event.kind === 'reinspection'
                        ? ` · verificação ${reinspectionQuery.data.find(item => item.id === event.id)?.numero_verif ?? '—'}`
                        : ''}
                    </Text>
                  ) : null}
                  {event.description ? (
                    <Text style={styles.timelineDescription}>{event.description}</Text>
                  ) : null}
                  {event.photoUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Abrir foto da reinspeção"
                      onPress={() => openViewer([event.photoUrl as string])}
                      style={styles.timelinePhoto}
                    >
                      <Camera size={15} color={Colors.brand} />
                      <Text style={styles.timelinePhotoText}>Ver foto da reinspeção</Text>
                    </Pressable>
                  ) : null}
                  {event.relatedNcId ? (
                    <RelatedLink
                      label="Ocorrência gerada nesta reinspeção"
                      onPress={() => router.push(`/nc/${event.relatedNcId}` as never)}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Section>

        {(nc.resolvida_em || nc.observacao_resolucao || nc.foto_reinspecao_url) ? (
          <Section eyebrow="ENCERRAMENTO" title="Resultado da resolução" Icon={CheckCircle2}>
            <DetailBlock
              label="Resolvida em"
              value={formatDateTime(nc.resolvida_em) ?? 'Data não informada'}
            />
            <DetailBlock
              label="Observação"
              value={nc.observacao_resolucao ?? 'Nenhuma observação registrada.'}
            />
            {nc.foto_reinspecao_url ? (
              <PhotoGrid
                photos={[nc.foto_reinspecao_url]}
                onPress={() => openViewer([nc.foto_reinspecao_url as string])}
              />
            ) : null}
            {nc.resolvida_na_verif_id || nc.verificacao_reinsp_id ? (
              <Button
                label="Ver verificação de resolução"
                variant="secondary"
                onPress={() => openVerification(
                  nc.resolvida_na_verif_id ?? nc.verificacao_reinsp_id as string,
                )}
              />
            ) : null}
          </Section>
        ) : null}

        {(previousQuery.data[0] || nextQuery.data.length) ? (
          <Section eyebrow="RECORRÊNCIA" title="Ocorrências relacionadas" Icon={RotateCcw}>
            {previousQuery.data[0] ? (
              <RelatedNc
                prefix="Ocorrência anterior"
                nc={previousQuery.data[0]}
                onPress={() => router.push(`/nc/${previousQuery.data[0].id}` as never)}
              />
            ) : null}
            {nextQuery.data.map(related => (
              <RelatedNc
                key={related.id}
                prefix="Ocorrência seguinte"
                nc={related}
                onPress={() => router.push(`/nc/${related.id}` as never)}
              />
            ))}
          </Section>
        ) : null}

        <View style={styles.audit}>
          <Text style={styles.auditText}>Criada em {formatDateTime(nc.created_at) ?? 'data não informada'}</Text>
          <Text style={styles.auditText}>Atualizada em {formatDateTime(nc.updated_at) ?? 'data não informada'}</Text>
        </View>
      </ScrollView>

      {actionable ? (
        <BottomActionBar
          primaryLabel="Reinspecionar"
          onPrimary={openReinspection}
          helper="A correção só é encerrada após uma nova inspeção conforme."
        />
      ) : null}

      <PhotoViewer
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        visible={Boolean(viewer)}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

function Section({
  eyebrow,
  title,
  Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  Icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon size={18} color={Colors.brand} />
        </View>
        <View>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </Card>
  );
}

function DetailBlock({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.detailBlock, emphasized && styles.detailBlockEmphasized]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, emphasized && styles.detailValueEmphasized]}>{value}</Text>
    </View>
  );
}

function DetailField({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof CalendarDays;
}) {
  return (
    <View style={styles.detailField}>
      <Icon size={17} color={Colors.textTertiary} />
      <View style={styles.detailFieldBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailFieldValue}>{value}</Text>
      </View>
    </View>
  );
}

function ContextRow({
  Icon,
  label,
  value,
  last = false,
}: {
  Icon: typeof HardHat;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.contextRow, last && styles.contextRowLast]}>
      <Icon size={17} color={Colors.textTertiary} />
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </View>
  );
}

function MetaPill({
  Icon,
  label,
  tone,
}: {
  Icon: typeof CalendarDays;
  label: string;
  tone: string;
}) {
  return (
    <View style={styles.metaPill}>
      <Icon size={15} color={tone} />
      <Text style={[styles.metaPillText, { color: tone }]}>{label}</Text>
    </View>
  );
}

function RelatedLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.relatedInline}
    >
      <Text style={styles.relatedInlineText}>{label}</Text>
      <ChevronRight size={16} color={Colors.brand} />
    </Pressable>
  );
}

function RelatedNc({
  prefix,
  nc,
  onPress,
}: {
  prefix: string;
  nc: RelatedNcRow;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${prefix.toLocaleLowerCase('pt-BR')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.relatedNc, pressed && styles.relatedNcPressed]}
    >
      <View style={styles.relatedNcBody}>
        <Text style={styles.relatedNcPrefix}>{prefix}</Text>
        <Text style={styles.relatedNcTitle} numberOfLines={1}>
          Ocorrência {nc.numero_ocorrencia} · {ncStatusLabel(nc.status)}
        </Text>
        <Text style={styles.relatedNcDescription} numberOfLines={1}>{nc.descricao}</Text>
      </View>
      <ChevronRight size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

function statusTone(status: string): BadgeTone {
  if (status === 'resolvida') return 'success';
  if (status === 'em_correcao') return 'info';
  if (status === 'aberta') return 'danger';
  return 'neutral';
}

function priorityColor(priority: string): string {
  if (priority === 'alta') return Colors.nok;
  if (priority === 'media') return Colors.warn;
  return Colors.textSecondary;
}

function deadlineColor(bucket: string, actionable: boolean): string {
  if (!actionable) return Colors.ok;
  if (bucket === 'overdue' || bucket === 'today') return Colors.nok;
  if (bucket === 'soon') return Colors.warn;
  return Colors.textSecondary;
}

function timelineColor(tone: 'danger' | 'warning' | 'success' | 'neutral'): string {
  if (tone === 'danger') return Colors.nok;
  if (tone === 'warning') return Colors.warn;
  if (tone === 'success') return Colors.ok;
  return Colors.textTertiary;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.lg,
  },
  contentWithAction: { paddingBottom: 148 },
  loading: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  skeletonHero: { width: '100%', height: 156, borderRadius: Radius.lg },
  skeletonCard: { width: '100%', height: 220, borderRadius: Radius.lg },
  notFound: {
    flex: 1,
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: { gap: Spacing.lg },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroText: { flex: 1, gap: 3 },
  eyebrow: { ...Typography.overline, color: Colors.nok },
  title: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: 3,
  },
  service: { ...Typography.caption, color: Colors.textSecondary },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    paddingHorizontal: Spacing.md,
  },
  metaPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
  },
  section: { gap: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.brandLight,
  },
  sectionEyebrow: { ...Typography.overline, color: Colors.textTertiary },
  sectionTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  sectionContent: { gap: Spacing.md },
  detailBlock: { gap: 4 },
  detailBlockEmphasized: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.nok,
  },
  detailLabel: { ...Typography.overline, color: Colors.textTertiary },
  detailValue: { ...Typography.body, color: Colors.textSecondary },
  detailValueEmphasized: { color: Colors.text, fontFamily: FontFamily.medium },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  detailField: {
    minWidth: 180,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  detailFieldBody: { flex: 1, gap: 2 },
  detailFieldValue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  contextList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  contextRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contextRowLast: { borderBottomWidth: 0 },
  contextLabel: {
    width: 88,
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  contextValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
    color: Colors.text,
  },
  itemDetails: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  emptyText: { ...Typography.body, color: Colors.textTertiary },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', minHeight: 78 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.surface,
    marginTop: 5,
    zIndex: 1,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: Colors.borderNormal,
  },
  timelineBody: { flex: 1, paddingLeft: Spacing.sm, paddingBottom: Spacing.lg },
  timelineHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  timelineTitle: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  timelineDate: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
  timelinePerson: {
    marginTop: 3,
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  timelineDescription: {
    marginTop: 5,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  timelinePhoto: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  timelinePhotoText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
    color: Colors.brand,
  },
  relatedInline: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  relatedInlineText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
    color: Colors.brand,
  },
  relatedNc: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  relatedNcPressed: { opacity: 0.72 },
  relatedNcBody: { flex: 1, gap: 2 },
  relatedNcPrefix: { ...Typography.overline, color: Colors.textTertiary },
  relatedNcTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  relatedNcDescription: { ...Typography.caption, color: Colors.textSecondary },
  audit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  auditText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.tiny,
    color: Colors.textTertiary,
  },
});
