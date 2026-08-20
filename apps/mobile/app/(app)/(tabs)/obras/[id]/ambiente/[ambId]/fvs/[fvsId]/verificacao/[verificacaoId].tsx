import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CloudUpload,
  FileQuestion,
  ListChecks,
  MinusCircle,
  PenLine,
  ShieldAlert,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { AppHeader } from '../../../../../../../../../../components/AppHeader';
import { PhotoGrid } from '../../../../../../../../../../components/PhotoGrid';
import { PhotoViewer } from '../../../../../../../../../../components/PhotoViewer';
import {
  BadgeStatus,
  StatusBadge,
} from '../../../../../../../../../../components/StatusBadge';
import {
  Button,
  Card,
  ErrorBanner,
  SectionTitle,
} from '../../../../../../../../../../components/ui';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../../../../../../../../../lib/constants';
import { goBack } from '../../../../../../../../../../lib/navigation';
import { usePrivateMediaUris } from '../../../../../../../../../../hooks/usePrivateMediaUris';
import {
  formatDateOnly,
  formatDateTime,
  groupByKey,
  isPendingMediaKey,
  sortVerificationItems,
  summarizeVerificationItems,
} from '../../../../../../../../../../lib/verification-detail';

interface VerificationRow {
  id: string;
  fvs_planejada_id: string;
  numero_verif: number;
  inspetor_id: string;
  equipe_id: string | null;
  data_verif: string;
  status: string;
  observacoes: string | null;
  assinatura_url: string | null;
  assinada_em: string | null;
  created_offline: number | boolean;
  created_at: string | null;
  inspetor_nome: string | null;
  inspetor_cargo: string | null;
  equipe_nome: string | null;
  equipe_tipo: string | null;
  equipe_responsavel: string | null;
  equipe_especialidade: string | null;
  subservico: string | null;
  ambiente_nome: string | null;
  obra_nome: string | null;
  eng_responsavel: string | null;
  crea_cau: string | null;
}

interface VerificationItemRow {
  id: string;
  verificacao_id: string;
  fvs_padrao_item_id: string;
  ordem: number;
  titulo: string;
  metodo_verif: string | null;
  tolerancia: string | null;
  resultado: string;
}

interface NonConformityRow {
  id: string;
  verificacao_id: string;
  verificacao_item_id: string;
  descricao: string;
  solucao_proposta: string;
  responsavel_id: string | null;
  data_nova_verif: string | null;
  prioridade: string;
  status: string;
  resolvida_na_verif_id: string | null;
  resolvida_em: string | null;
  observacao_resolucao: string | null;
  responsavel_nome: string | null;
}

interface VerificationPhotoRow {
  id: string;
  verificacao_id: string;
  r2_key: string;
  r2_thumb_key: string | null;
  nome_arquivo: string | null;
  ordem: number;
}

interface NonConformityPhotoRow {
  id: string;
  nc_id: string;
  r2_key: string;
  r2_thumb_key: string | null;
  ordem: number;
}

interface ViewerState {
  photos: string[];
  initialIndex: number;
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || 'Não informado';
}

function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  };
  return labels[priority] ?? priority;
}

function DetailField({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.detailField, style]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
  Icon,
  style,
}: {
  label: string;
  value: number;
  tone: string;
  Icon: typeof CheckCircle2;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.metric, style]}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}16` }]}>
        <Icon size={18} color={tone} strokeWidth={2.2} />
      </View>
      <View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function VerificationDetailScreen() {
  const { id, ambId, fvsId, verificacaoId } = useLocalSearchParams<{
    id: string;
    ambId: string;
    fvsId: string;
    verificacaoId: string;
  }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= Breakpoints.tablet;
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const historyHref = `/(app)/(tabs)/obras/${id}/ambiente/${ambId}/fvs/${fvsId}` as const;

  const headerQuery = useQuery<VerificationRow>(`
    SELECT v.id, v.fvs_planejada_id, v.numero_verif, v.inspetor_id, v.equipe_id,
           v.data_verif, v.status, v.observacoes,
           v.assinatura_url, v.assinada_em, v.created_offline, v.created_at,
           u.nome AS inspetor_nome, u.cargo AS inspetor_cargo,
           e.nome AS equipe_nome, e.tipo AS equipe_tipo,
           e.responsavel AS equipe_responsavel, e.especialidade AS equipe_especialidade,
           fp.subservico, a.nome AS ambiente_nome, o.nome AS obra_nome,
           o.eng_responsavel, o.crea_cau
    FROM verificacoes v
    LEFT JOIN usuarios u ON u.id = v.inspetor_id
    LEFT JOIN equipes e ON e.id = v.equipe_id
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE v.id = ? AND v.fvs_planejada_id = ?
  `, [verificacaoId, fvsId]);

  const itemsQuery = useQuery<VerificationItemRow>(`
    SELECT vi.id, vi.verificacao_id, vi.fvs_padrao_item_id, vi.ordem,
           vi.titulo, vi.metodo_verif, vi.tolerancia, vi.resultado
    FROM verificacao_itens vi
    WHERE vi.verificacao_id = ?
    ORDER BY vi.ordem ASC
  `, [verificacaoId]);

  const nonConformitiesQuery = useQuery<NonConformityRow>(`
    SELECT n.id, n.verificacao_id, n.verificacao_item_id, n.descricao,
           n.solucao_proposta, n.responsavel_id, n.data_nova_verif,
           n.prioridade, n.status, n.resolvida_na_verif_id, n.resolvida_em,
           n.observacao_resolucao, e.nome AS responsavel_nome
    FROM nao_conformidades n
    LEFT JOIN equipes e ON e.id = n.responsavel_id
    WHERE n.verificacao_id = ?
  `, [verificacaoId]);

  const verificationPhotosQuery = useQuery<VerificationPhotoRow>(`
    SELECT vf.id, vf.verificacao_id, vf.r2_key, vf.r2_thumb_key,
           vf.nome_arquivo, vf.ordem
    FROM verificacao_fotos vf
    WHERE vf.verificacao_id = ?
    ORDER BY vf.ordem ASC
  `, [verificacaoId]);

  const nonConformityPhotosQuery = useQuery<NonConformityPhotoRow>(`
    SELECT nf.id, nf.nc_id, nf.r2_key, nf.r2_thumb_key, nf.ordem
    FROM nc_fotos nf
    JOIN nao_conformidades n ON n.id = nf.nc_id
    WHERE n.verificacao_id = ?
    ORDER BY nf.ordem ASC
  `, [verificacaoId]);

  const verification = headerQuery.data[0];
  const resolveMediaUri = usePrivateMediaUris(verification?.assinatura_url ? [verification.assinatura_url] : []);
  const items = useMemo(
    () => sortVerificationItems(itemsQuery.data),
    [itemsQuery.data],
  );
  const summary = useMemo(() => summarizeVerificationItems(items), [items]);
  const nonConformitiesByItem = useMemo(
    () => groupByKey(nonConformitiesQuery.data, nc => nc.verificacao_item_id),
    [nonConformitiesQuery.data],
  );
  const photosByNonConformity = useMemo(
    () => groupByKey(nonConformityPhotosQuery.data, photo => photo.nc_id),
    [nonConformityPhotosQuery.data],
  );
  const generalPhotos = useMemo(
    () => verificationPhotosQuery.data.map(photo => ({ key: photo.r2_key, thumbnailKey: photo.r2_thumb_key })),
    [verificationPhotosQuery.data],
  );
  const generalPhotoKeys = useMemo(() => generalPhotos.map(photo => photo.key), [generalPhotos]);
  const pendingMediaCount = useMemo(() => {
    const photoKeys = [
      ...generalPhotoKeys,
      ...nonConformityPhotosQuery.data.map(photo => photo.r2_key),
    ];
    if (verification?.assinatura_url) photoKeys.push(verification.assinatura_url);
    return photoKeys.filter(isPendingMediaKey).length;
  }, [generalPhotoKeys, nonConformityPhotosQuery.data, verification?.assinatura_url]);

  const queries = [
    headerQuery,
    itemsQuery,
    nonConformitiesQuery,
    verificationPhotosQuery,
    nonConformityPhotosQuery,
  ];
  const isLoading = queries.some(query => query.isLoading);
  const queryError = queries.find(query => query.error)?.error;

  function openViewer(photos: string[], initialIndex: number) {
    setViewer({ photos, initialIndex });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Registro da verificação" showBack onBack={() => goBack(historyHref)} />
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={styles.stateTitle}>Carregando registro</Text>
          <Text style={styles.stateText}>Consultando os dados sincronizados desta verificação.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (queryError) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Registro da verificação" showBack onBack={() => goBack(historyHref)} />
        <View style={styles.stateContent}>
          <ErrorBanner message={`Não foi possível carregar o registro. ${queryError.message}`} />
          <Button label="Voltar ao histórico" variant="secondary" onPress={() => goBack(historyHref)} />
        </View>
      </SafeAreaView>
    );
  }

  if (!verification) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Registro da verificação" showBack onBack={() => goBack(historyHref)} />
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <ShieldAlert size={28} color={Colors.warn} />
          </View>
          <Text style={styles.stateTitle}>Registro não encontrado</Text>
          <Text style={styles.stateText}>
            A verificação não existe neste FVS ou não está disponível para o seu acesso.
          </Text>
          <Button label="Voltar ao histórico" variant="secondary" onPress={() => goBack(historyHref)} />
        </View>
      </SafeAreaView>
    );
  }

  const registeredAt = formatDateTime(verification.created_at);
  const signedAt = formatDateTime(verification.assinada_em);
  const isPendingSync = verification.created_offline === 1 || verification.created_offline === true;

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={`Verificação #${verification.numero_verif}`}
        subtitle={[verification.subservico, verification.ambiente_nome, verification.obra_nome]
          .filter(Boolean)
          .join(' · ')}
        showBack
        onBack={() => goBack(historyHref)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {(isPendingSync || pendingMediaCount > 0) ? (
          <View style={styles.syncBanner}>
            <CloudUpload size={20} color={Colors.warn} />
            <View style={styles.syncBannerCopy}>
              <Text style={styles.syncBannerTitle}>Sincronização pendente</Text>
              <Text style={styles.syncBannerText}>
                {pendingMediaCount > 0
                  ? `${pendingMediaCount} mídia${pendingMediaCount === 1 ? '' : 's'} ainda ${pendingMediaCount === 1 ? 'está' : 'estão'} armazenada${pendingMediaCount === 1 ? '' : 's'} localmente.`
                  : 'O registro foi criado offline e ainda aguarda confirmação do servidor.'}
              </Text>
            </View>
          </View>
        ) : null}

        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.overline}>REGISTRO HISTÓRICO · SOMENTE LEITURA</Text>
              <Text style={styles.heroTitle}>Verificação #{verification.numero_verif}</Text>
              <Text style={styles.heroSubtitle}>
                Data da inspeção: {formatDateOnly(verification.data_verif)}
              </Text>
              {registeredAt ? (
                <Text style={styles.heroMeta}>Registrada em {registeredAt}</Text>
              ) : null}
            </View>
            <StatusBadge status={verification.status as BadgeStatus} />
          </View>

          <View style={styles.metrics}>
            <SummaryMetric
              label="Itens"
              value={summary.total}
              tone={Colors.brand}
              Icon={ListChecks}
              style={isTablet ? styles.metricTablet : styles.metricMobile}
            />
            <SummaryMetric
              label="Conformes"
              value={summary.conformes}
              tone={Colors.ok}
              Icon={CheckCircle2}
              style={isTablet ? styles.metricTablet : styles.metricMobile}
            />
            <SummaryMetric
              label="Não conformes"
              value={summary.naoConformes}
              tone={Colors.nok}
              Icon={XCircle}
              style={isTablet ? styles.metricTablet : styles.metricMobile}
            />
            <SummaryMetric
              label="Não aplicáveis"
              value={summary.naoAplicaveis}
              tone={Colors.na}
              Icon={MinusCircle}
              style={isTablet ? styles.metricTablet : styles.metricMobile}
            />
          </View>
        </Card>

        <Card>
          <SectionTitle
            title="Identificação"
            description="Responsáveis e contexto preservados no registro"
          />
          <View style={styles.identityGrid}>
            <View style={[styles.identityBlock, isTablet && styles.identityBlockTablet]}>
              <View style={styles.identityIcon}>
                <UserRound size={19} color={Colors.brand} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>Inspetor</Text>
                <Text style={styles.identityTitle}>{displayValue(verification.inspetor_nome)}</Text>
                {verification.inspetor_cargo ? (
                  <Text style={styles.identityMeta}>{verification.inspetor_cargo}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.identityBlock, isTablet && styles.identityBlockTablet]}>
              <View style={styles.identityIcon}>
                <UsersRound size={19} color={Colors.brand} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>Equipe executora</Text>
                <Text style={styles.identityTitle}>{displayValue(verification.equipe_nome)}</Text>
                <Text style={styles.identityMeta}>
                  {[verification.equipe_especialidade, verification.equipe_responsavel]
                    .filter(Boolean)
                    .join(' · ') || 'Detalhes não informados'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.fieldsGrid}>
            <DetailField
              label="Data da inspeção"
              value={formatDateOnly(verification.data_verif)}
              style={isTablet ? styles.fieldTablet : undefined}
            />
            <DetailField
              label="Horário do registro"
              value={registeredAt ?? 'Não informado'}
              style={isTablet ? styles.fieldTablet : undefined}
            />
            <DetailField
              label="Obra"
              value={displayValue(verification.obra_nome)}
              style={isTablet ? styles.fieldTablet : undefined}
            />
            <DetailField
              label="Ambiente"
              value={displayValue(verification.ambiente_nome)}
              style={isTablet ? styles.fieldTablet : undefined}
            />
          </View>
        </Card>

        <View style={styles.sectionHeading}>
          <ClipboardCheck size={22} color={Colors.brand} />
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionHeadingTitle}>Checklist registrado</Text>
            <Text style={styles.sectionHeadingSubtitle}>
              Resultado e evidências de cada item no momento da inspeção
            </Text>
          </View>
        </View>

        {items.length === 0 ? (
          <Card tone="soft" style={styles.legacyCard}>
            <FileQuestion size={24} color={Colors.textSecondary} />
            <View style={styles.legacyCopy}>
              <Text style={styles.legacyTitle}>Registro legado sem itens detalhados</Text>
              <Text style={styles.legacyText}>
                Os dados gerais desta verificação estão disponíveis, mas o checklist histórico não foi armazenado.
              </Text>
            </View>
          </Card>
        ) : (
          items.map(item => {
            const itemNonConformities = nonConformitiesByItem[item.id] ?? [];

            return (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemOrder}>
                    <Text style={styles.itemOrderText}>{item.ordem}</Text>
                  </View>
                  <View style={styles.itemHeaderCopy}>
                    <Text style={styles.itemTitle}>{item.titulo}</Text>
                  </View>
                  <StatusBadge status={item.resultado as BadgeStatus} size="sm" />
                </View>

                {(item.metodo_verif || item.tolerancia) ? (
                  <View style={styles.itemDetails}>
                    {item.metodo_verif ? (
                      <DetailField label="Método de verificação" value={item.metodo_verif} />
                    ) : null}
                    {item.tolerancia ? (
                      <DetailField label="Tolerância / critério" value={item.tolerancia} />
                    ) : null}
                  </View>
                ) : null}

                {itemNonConformities.map(nonConformity => {
                  const photoKeys = (photosByNonConformity[nonConformity.id] ?? [])
                    .map(photo => photo.r2_key);

                  return (
                    <View key={nonConformity.id} style={styles.ncPanel}>
                      <View style={styles.ncHeader}>
                        <View style={styles.ncTitleRow}>
                          <AlertTriangle size={18} color={Colors.nok} />
                          <Text style={styles.ncTitle}>Não conformidade</Text>
                        </View>
                        <StatusBadge status={nonConformity.status as BadgeStatus} size="sm" />
                      </View>
                      <DetailField label="Descrição" value={displayValue(nonConformity.descricao)} />
                      <DetailField
                        label="Solução proposta"
                        value={displayValue(nonConformity.solucao_proposta)}
                      />
                      <View style={styles.ncFields}>
                        <DetailField
                          label="Responsável"
                          value={displayValue(nonConformity.responsavel_nome)}
                          style={isTablet ? styles.fieldTablet : undefined}
                        />
                        <DetailField
                          label="Prazo"
                          value={formatDateOnly(nonConformity.data_nova_verif)}
                          style={isTablet ? styles.fieldTablet : undefined}
                        />
                        <DetailField
                          label="Prioridade"
                          value={priorityLabel(nonConformity.prioridade)}
                          style={isTablet ? styles.fieldTablet : undefined}
                        />
                        <DetailField
                          label="Situação"
                          value={nonConformity.status === 'resolvida' ? 'Resolvida' : 'Aberta'}
                          style={isTablet ? styles.fieldTablet : undefined}
                        />
                      </View>

                      {nonConformity.resolvida_em || nonConformity.observacao_resolucao ? (
                        <View style={styles.resolutionBox}>
                          <Text style={styles.resolutionTitle}>Reinspeção</Text>
                          {nonConformity.resolvida_em ? (
                            <Text style={styles.resolutionText}>
                              Resolvida em {formatDateTime(nonConformity.resolvida_em)}
                            </Text>
                          ) : null}
                          {nonConformity.observacao_resolucao ? (
                            <Text style={styles.resolutionText}>
                              {nonConformity.observacao_resolucao}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}

                      {photoKeys.length > 0 ? (
                        <View style={styles.photoSection}>
                          <View style={styles.photoSectionTitle}>
                            <Camera size={16} color={Colors.textSecondary} />
                            <Text style={styles.photoSectionLabel}>Evidências da NC</Text>
                          </View>
                          <PhotoGrid
                            photos={photoKeys}
                            onPress={index => openViewer(photoKeys, index)}
                          />
                        </View>
                      ) : (
                        <Text style={styles.noEvidence}>Sem evidência fotográfica disponível.</Text>
                      )}
                    </View>
                  );
                })}
              </Card>
            );
          })
        )}

        <Card>
          <SectionTitle title="Observações gerais" />
          {verification.observacoes?.trim() ? (
            <Text style={styles.observations}>{verification.observacoes}</Text>
          ) : (
            <Text style={styles.emptyInline}>Nenhuma observação registrada.</Text>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Fotos gerais"
            description={`${generalPhotos.length} evidência${generalPhotos.length === 1 ? '' : 's'} neste registro`}
          />
          {generalPhotos.length > 0 ? (
            <PhotoGrid
              photos={generalPhotos}
              onPress={index => openViewer(generalPhotoKeys, index)}
            />
          ) : (
            <Text style={styles.emptyInline}>Nenhuma foto geral registrada.</Text>
          )}
        </Card>

        <Card>
          <View style={styles.signatureHeader}>
            <View style={styles.signatureTitleRow}>
              <PenLine size={20} color={Colors.brand} />
              <Text style={styles.signatureTitle}>Assinatura digital</Text>
            </View>
            {verification.assinatura_url ? (
              <View style={styles.signedBadge}>
                <CheckCircle2 size={15} color={Colors.ok} />
                <Text style={styles.signedBadgeText}>Assinado</Text>
              </View>
            ) : null}
          </View>
          {verification.assinatura_url ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ampliar assinatura digital"
                onPress={() => openViewer([verification.assinatura_url!], 0)}
                style={({ pressed }) => [
                  styles.signatureFrame,
                  pressed && styles.signatureFramePressed,
                ]}
              >
                <Image
                  source={{ uri: resolveMediaUri(verification.assinatura_url) }}
                  style={styles.signatureImage}
                  resizeMode="contain"
                />
              </Pressable>
              <View style={styles.signedMeta}>
                <CalendarDays size={15} color={Colors.textSecondary} />
                <Text style={styles.signedMetaText}>
                  {signedAt ? `Assinada em ${signedAt}` : 'Data da assinatura não informada'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noSignature}>
              <PenLine size={22} color={Colors.textTertiary} />
              <Text style={styles.emptyInline}>Este registro não possui assinatura digital.</Text>
            </View>
          )}
        </Card>

        <View style={styles.auditFooter}>
          <Clock3 size={16} color={Colors.textSecondary} />
          <Text style={styles.auditFooterText}>
            Registro histórico preservado. Nenhum dado pode ser alterado nesta tela.
          </Text>
        </View>
      </ScrollView>

      <PhotoViewer
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        visible={viewer !== null}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  stateContent: {
    flex: 1,
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...Typography.heading,
    color: Colors.text,
    textAlign: 'center',
  },
  stateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 460,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warn,
    backgroundColor: Colors.warnBg,
  },
  syncBannerCopy: {
    flex: 1,
    gap: 2,
  },
  syncBannerTitle: {
    ...Typography.label,
    color: Colors.warn,
  },
  syncBannerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  heroCard: {
    gap: Spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  overline: {
    ...Typography.overline,
    color: Colors.brand,
  },
  heroTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  heroSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  heroMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metric: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricMobile: {
    width: '48%',
    flexGrow: 1,
  },
  metricTablet: {
    width: '23%',
    flexGrow: 1,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  metricLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  identityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  identityBlock: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  identityBlockTablet: {
    width: '48%',
    flexGrow: 1,
  },
  identityIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  identityTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  identityMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  detailField: {
    width: '100%',
    gap: 3,
  },
  fieldTablet: {
    width: '48%',
    flexGrow: 1,
  },
  detailLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  sectionHeadingTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  sectionHeadingSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  legacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  legacyCopy: {
    flex: 1,
    gap: 4,
  },
  legacyTitle: {
    ...Typography.label,
    color: Colors.text,
  },
  legacyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  itemCard: {
    gap: Spacing.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  itemOrder: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOrderText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
    color: Colors.surface,
  },
  itemHeaderCopy: {
    flex: 1,
    paddingTop: 4,
  },
  itemTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  itemDetails: {
    gap: Spacing.md,
    paddingLeft: 44,
  },
  ncPanel: {
    gap: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.nok,
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
    padding: Spacing.lg,
  },
  ncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  ncTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ncTitle: {
    ...Typography.label,
    color: Colors.nok,
  },
  ncFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  resolutionBox: {
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.okBg,
  },
  resolutionTitle: {
    ...Typography.label,
    color: Colors.ok,
  },
  resolutionText: {
    ...Typography.caption,
    color: Colors.text,
  },
  photoSection: {
    gap: Spacing.sm,
  },
  photoSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  photoSectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  noEvidence: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  observations: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyInline: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  signatureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  signatureTitle: {
    ...Typography.heading,
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.okBg,
  },
  signedBadgeText: {
    ...Typography.label,
    color: Colors.ok,
  },
  signatureFrame: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureFramePressed: {
    opacity: 0.76,
  },
  signatureImage: {
    width: '100%',
    height: 150,
  },
  signedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  signedMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  noSignature: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
  },
  auditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  auditFooterText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
    textAlign: 'center',
  },
});
