import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  PenLine,
  Plus,
  UserRound,
  WifiOff,
} from 'lucide-react-native';
import { AppHeader } from '../../../../../../../../../components/AppHeader';
import { goBack } from '../../../../../../../../../lib/navigation';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { FVSLockedScreen } from '../../../../../../../../../components/FVSLockedScreen';
import { FVSReopenModal } from '../../../../../../../../../components/FVSReopenModal';
import { StatusBadge } from '../../../../../../../../../components/StatusBadge';
import type { BadgeStatus } from '../../../../../../../../../components/StatusBadge';
import {
  Badge,
  DatumCard,
  EmptyState,
  SectionTitle,
} from '../../../../../../../../../components/ui';
import type { DatumTone } from '../../../../../../../../../components/ui';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  FontFamily,
  FontSizes,
  Palette,
  Radius,
  Spacing,
  Typography,
} from '../../../../../../../../../lib/constants';
import {
  formatDateOnly,
  sortVerificationRecords,
  summarizeVerificationEvidence,
  verificationDetailPath,
} from '../../../../../../../../../lib/verification-detail';

interface FvsRow { id: string; subservico: string; status: string; ambiente_nome: string; obra_nome: string }
interface ConclusaoRow {
  id: string; inspetor_nome: string;
  resultado: string; observacao_final: string | null;
  motivo_antes_100: string | null; created_at: string;
}
interface VerifRow {
  id: string; numero_verif: number; data_verif: string; status: string;
  assinatura_url: string | null; inspetor_nome: string;
  created_offline: number | boolean;
  created_at: string;
}
interface NcRow {
  id: string; verificacao_id: string; status: string;
}
interface FotoRow { id: string; verificacao_id: string }

interface VerificationListItem extends VerifRow {
  openNonConformities: number;
  resolvedNonConformities: number;
  photoCount: number;
}

export default function FvsHistoryScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const router = useRouter();
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  const { data: fvsRows } = useQuery<FvsRow>(`
    SELECT fp.id, fp.subservico, fp.status, a.nome AS ambiente_nome, o.nome AS obra_nome
    FROM fvs_planejadas fp
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    WHERE fp.id = ?
  `, [fvsId]);
  const fvs = fvsRows[0];

  const { data: verificacoes } = useQuery<VerifRow>(`
    SELECT v.id, v.numero_verif, v.data_verif, v.status,
           v.assinatura_url, v.created_offline,
           v.created_at, u.nome AS inspetor_nome
    FROM verificacoes v
    LEFT JOIN usuarios u ON u.id = v.inspetor_id
    WHERE v.fvs_planejada_id = ?
    ORDER BY v.data_verif DESC, v.numero_verif DESC
  `, [fvsId]);

  const { data: ncs } = useQuery<NcRow>(`
    SELECT n.id, n.verificacao_id, n.status
    FROM nao_conformidades n
    JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
    WHERE n.verificacao_id IN (
      SELECT id FROM verificacoes WHERE fvs_planejada_id = ?
    )
  `, [fvsId]);

  const { data: fotos } = useQuery<FotoRow>(`
    SELECT id, verificacao_id
    FROM verificacao_fotos
    WHERE verificacao_id IN (
      SELECT id FROM verificacoes WHERE fvs_planejada_id = ?
    )
    ORDER BY verificacao_id, ordem
  `, [fvsId]);

  const { data: conclusoes } = useQuery<ConclusaoRow>(`
    SELECT fc.id, fc.resultado, fc.observacao_final,
           fc.motivo_antes_100, fc.created_at, u.nome AS inspetor_nome
    FROM fvs_conclusoes fc
    JOIN usuarios u ON u.id = fc.inspetor_id
    WHERE fc.fvs_planejada_id = ?
    ORDER BY fc.numero_conclusao DESC
    LIMIT 1
  `, [fvsId]);
  const ultimaConclusao = conclusoes[0] ?? null;

  const historyItems = useMemo<VerificationListItem[]>(() => {
    return sortVerificationRecords(verificacoes).map(verification => ({
      ...verification,
      ...summarizeVerificationEvidence(verification.id, ncs, fotos),
    }));
  }, [verificacoes, ncs, fotos]);

  const isLocked = fvs?.status === 'conforme'
    || fvs?.status === 'concluida'
    || fvs?.status === 'concluida_ressalva';

  const summary = useMemo(() => ({
    conformes:    verificacoes.filter(v => v.status === 'conforme').length,
    naoConformes: verificacoes.filter(v => v.status === 'nao_conforme').length,
    pendentes:    verificacoes.filter(v => v.status === 'em_andamento' || v.status === 'pendente').length,
  }), [verificacoes]);

  function openVerification(verificationId: string) {
    router.push(verificationDetailPath({
      obraId: id,
      ambienteId: ambId,
      fvsId,
      verificacaoId: verificationId,
    }) as never);
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <AppHeader
        title={fvs?.subservico || 'FVS'}
        subtitle={[fvs?.ambiente_nome, fvs?.obra_nome].filter(Boolean).join(' · ')}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}`)}
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {Platform.OS === 'web' && (
              <Pressable
                style={styles.pdfBtn}
                onPress={() => (window as Window).open(`/print/${fvsId}`, '_blank', 'noreferrer')}
                accessibilityRole="button"
                accessibilityLabel="Visualizar PDF da FVS"
              >
                <FileText size={14} color={Colors.brand} />
              </Pressable>
            )}
            {!isLocked && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nova verificação"
                style={({ pressed }) => [styles.novaBtn, pressed && styles.novaBtnPressed]}
                onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${fvsId}/verificacao/nova` as never)}
              >
                <Plus size={16} color={Palette.white} />
                <Text style={styles.novaBtnText}>Nova</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <View style={styles.statusPanel}>
        <View style={styles.statusPrimary}>
          {fvs && <StatusBadge status={fvs.status as BadgeStatus} />}
          <Text style={styles.summaryTotal}>
            {verificacoes.length} registro{verificacoes.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <SummaryStat value={summary.conformes} label="Conformes" tone={Colors.ok} />
          <SummaryStat value={summary.naoConformes} label="Não conf." tone={Colors.nok} />
          <SummaryStat value={summary.pendentes} label="Pendentes" tone={Colors.progress} />
        </View>
      </View>

      <FlatList
        data={historyItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {isLocked ? (
              <FVSLockedScreen
                status={fvs!.status as 'conforme' | 'concluida' | 'concluida_ressalva'}
                conclusao={ultimaConclusao}
                onRequestReopen={() => setReopenModalOpen(true)}
              />
            ) : null}
            <SectionTitle
              eyebrow="Registros"
              title="Histórico de verificações"
              description={
                isLocked
                  ? undefined
                  : 'Mais recentes primeiro. Toque em um registro para consultar todos os detalhes.'
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <DatumCard
            tone={datumTone(item.status)}
            style={styles.recordCard}
            accessibilityLabel={`Verificação ${item.numero_verif}, ${formatDateOnly(item.data_verif)}, ${statusLabel(item.status)}. Abrir registro completo.`}
            onPress={() => openVerification(item.id)}
          >
            <View style={styles.recordTop}>
              <Text style={styles.recordNumber}>Verificação #{item.numero_verif}</Text>
              <View style={styles.recordTopActions}>
                <StatusBadge status={item.status as BadgeStatus} size="sm" />
                <ChevronRight size={20} color={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.recordMeta}>
              <View style={styles.metaItem}>
                <CalendarDays size={15} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{formatDateOnly(item.data_verif)}</Text>
              </View>
              <View style={styles.metaItem}>
                <UserRound size={15} color={Colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.inspetor_nome || 'Inspetor não informado'}
                </Text>
              </View>
            </View>

            <View style={styles.indicatorRow}>
              {item.openNonConformities > 0 ? (
                <Badge
                  label={`${item.openNonConformities} NC ${item.openNonConformities === 1 ? 'aberta' : 'abertas'}`}
                  tone="danger"
                  Icon={AlertTriangle}
                  size="sm"
                />
              ) : item.resolvedNonConformities > 0 ? (
                <Badge
                  label={`${item.resolvedNonConformities} NC ${item.resolvedNonConformities === 1 ? 'resolvida' : 'resolvidas'}`}
                  tone="success"
                  Icon={CheckCircle2}
                  size="sm"
                />
              ) : null}
              {item.photoCount > 0 ? (
                <Badge
                  label={`${item.photoCount} ${item.photoCount === 1 ? 'foto' : 'fotos'}`}
                  Icon={Camera}
                  size="sm"
                />
              ) : null}
              <Badge
                label={item.assinatura_url ? 'Assinada' : 'Sem assinatura'}
                tone={item.assinatura_url ? 'success' : 'neutral'}
                Icon={PenLine}
                size="sm"
              />
              {(item.created_offline === 1 || item.created_offline === true) ? (
                <Badge label="Criada offline" tone="warning" Icon={WifiOff} size="sm" />
              ) : null}
            </View>
          </DatumCard>
        )}
        ListEmptyComponent={
          !isLocked ? (
            <EmptyState
              title="Nenhuma verificação registrada"
              description="Registre a primeira inspeção deste serviço para iniciar o histórico."
              Icon={ClipboardCheck}
              actionLabel="Registrar primeira verificação"
              onAction={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${fvsId}/verificacao/nova` as never)}
            />
          ) : null
        }
      />

      <FVSReopenModal
        visible={reopenModalOpen}
        fvsId={fvsId!}
        obraId={id!}
        onClose={() => setReopenModalOpen(false)}
        onSuccess={() => setReopenModalOpen(false)}
      />
    </SafeAreaView>
  );
}

function SummaryStat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function datumTone(status: string): DatumTone {
  if (status === 'conforme') return 'success';
  if (status === 'nao_conforme') return 'danger';
  if (status === 'em_andamento') return 'info';
  return 'neutral';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    conforme: 'conforme',
    nao_conforme: 'não conforme',
    em_andamento: 'em andamento',
    pendente: 'pendente',
  };
  return labels[status] ?? status;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  novaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ComponentSize.touch,
    backgroundColor: Colors.action,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  novaBtnPressed: { backgroundColor: Colors.actionPressed },
  novaBtnText: { color: Palette.white, fontSize: FontSizes.base, fontFamily: FontFamily.medium },
  pdfBtn: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryStat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  summaryValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.base,
    lineHeight: 20,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  summaryTotal: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  list: {
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  listHeader: {
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  recordCard: {
    marginBottom: Spacing.sm,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  recordNumber: {
    flex: 1,
    color: Colors.text,
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.base,
    lineHeight: 22,
  },
  recordTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaItem: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
