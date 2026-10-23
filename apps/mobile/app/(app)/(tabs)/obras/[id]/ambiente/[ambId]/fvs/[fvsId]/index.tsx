import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  PenLine,
  Plus,
  WifiOff,
  X,
} from '../../../../../../../../../lib/icons';
import { AppHeader, HeaderIconButton } from '../../../../../../../../../components/AppHeader';
import { goBack } from '../../../../../../../../../lib/navigation';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FVSLockedScreen } from '../../../../../../../../../components/FVSLockedScreen';
import { FVSReopenModal } from '../../../../../../../../../components/FVSReopenModal';
import { StatusBadge } from '../../../../../../../../../components/StatusBadge';
import type { BadgeStatus } from '../../../../../../../../../components/StatusBadge';
import {
  Button,
  EmptyState,
  IconTile,
  Pill,
  SectionHead,
} from '../../../../../../../../../components/ui';
import {
  Breakpoints,
  Colors,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
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

  // Numa reinspeção a tela de captura só oferece o slot único da NC, então
  // `verificacao_fotos` fica vazia e o registro aparecia aqui como "0 fotos"
  // mesmo com a evidência gravada em `nc_reinspecoes.foto_url`.
  const { data: fotosReinspecao } = useQuery<FotoRow>(`
    SELECT id, verificacao_id
    FROM nc_reinspecoes
    WHERE foto_url IS NOT NULL AND verificacao_id IN (
      SELECT id FROM verificacoes WHERE fvs_planejada_id = ?
    )
    ORDER BY verificacao_id, created_at
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
    const evidencias = [...fotos, ...fotosReinspecao];
    return sortVerificationRecords(verificacoes).map(verification => ({
      ...verification,
      ...summarizeVerificationEvidence(verification.id, ncs, evidencias),
    }));
  }, [verificacoes, ncs, fotos, fotosReinspecao]);

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

  const novaVerificacao = () => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${fvsId}/verificacao/nova` as never);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AppHeader
        title={fvs?.subservico || 'FVS'}
        subtitle={[fvs?.ambiente_nome, fvs?.obra_nome].filter(Boolean).join(' · ')}
        showBack
        onBack={() => goBack(`/(app)/(tabs)/obras/${id}/ambiente/${ambId}`)}
        rightElement={Platform.OS === 'web' ? (
          <HeaderIconButton
            Icon={FileText}
            label="Visualizar PDF da FVS"
            // Na mesma janela: no PWA instalado, abrir outra janela tira o usuário do app.
            onPress={() => router.push(`/print/${fvsId}` as never)}
          />
        ) : undefined}
      />

      <FlatList
        data={historyItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                {fvs ? <StatusBadge status={fvs.status as BadgeStatus} /> : <View />}
                <Text style={styles.heroCount}>
                  {verificacoes.length} {verificacoes.length === 1 ? 'registro' : 'registros'}
                </Text>
              </View>
              <View style={styles.stats}>
                <Stat value={summary.conformes} label="Conformes" color={Colors.ok} bg={Colors.okBg} />
                <Stat value={summary.naoConformes} label="Com NC" color={Colors.nok} bg={Colors.nokBg} />
                <Stat value={summary.pendentes} label="Pendentes" color={Colors.info} bg={Colors.infoBg} />
              </View>
            </View>

            {isLocked ? (
              <FVSLockedScreen
                status={fvs!.status as 'conforme' | 'concluida' | 'concluida_ressalva'}
                conclusao={ultimaConclusao}
                onRequestReopen={() => setReopenModalOpen(true)}
              />
            ) : (
              <Button label="Nova verificação" Icon={Plus} onPress={novaVerificacao} fullWidth />
            )}

            {historyItems.length > 0 ? (
              <SectionHead title="Histórico de verificações" count={historyItems.length} />
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const tone = item.status === 'conforme' ? 'success' : item.status === 'nao_conforme' ? 'danger' : 'info';
          const Icon = item.status === 'conforme' ? Check : item.status === 'nao_conforme' ? X : Clock3;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Verificação ${item.numero_verif}, ${formatDateOnly(item.data_verif)}, ${statusLabel(item.status)}. Abrir registro completo.`}
              onPress={() => openVerification(item.id)}
              style={({ pressed }) => [styles.record, pressed && styles.recordPressed]}
            >
              <View style={styles.recordTop}>
                <IconTile Icon={Icon} tone={tone} />
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>Verificação #{item.numero_verif}</Text>
                  <Text style={styles.recordMeta} numberOfLines={1}>
                    {formatDateOnly(item.data_verif)} · {item.inspetor_nome || 'Inspetor não informado'}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.indicatorRow}>
                {item.openNonConformities > 0 ? (
                  <Pill
                    label={`${item.openNonConformities} ${item.openNonConformities === 1 ? 'NC aberta' : 'NCs abertas'}`}
                    tone="danger"
                    Icon={AlertTriangle}
                  />
                ) : item.resolvedNonConformities > 0 ? (
                  <Pill
                    label={`${item.resolvedNonConformities} ${item.resolvedNonConformities === 1 ? 'NC resolvida' : 'NCs resolvidas'}`}
                    tone="success"
                    Icon={CheckCircle2}
                  />
                ) : null}
                {item.photoCount > 0 ? (
                  <Pill label={`${item.photoCount} ${item.photoCount === 1 ? 'foto' : 'fotos'}`} Icon={Camera} onSurface />
                ) : null}
                <Pill
                  label={item.assinatura_url ? 'Assinada' : 'Sem assinatura'}
                  tone={item.assinatura_url ? 'success' : 'neutral'}
                  Icon={PenLine}
                  onSurface
                />
                {(item.created_offline === 1 || item.created_offline === true) ? (
                  <Pill label="Criada offline" tone="warning" Icon={WifiOff} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isLocked ? (
            <EmptyState
              title="Nenhuma verificação registrada"
              description="Registre a primeira inspeção deste serviço para iniciar o histórico."
              Icon={ClipboardCheck}
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

function Stat({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: value > 0 ? bg : Colors.bg }]}>
      <Text style={[styles.statValue, { color: value > 0 ? color : Colors.textSecondary }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
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
  list: {
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  listHeader: { gap: Spacing.lg, marginBottom: Spacing.md },
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  heroCount: { fontFamily: FontFamily.medium, fontSize: FontSizes.xs, color: Colors.textSecondary },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontFamily: FontFamily.monoBold, fontSize: 24, lineHeight: 28 },
  statLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  separator: { height: Spacing.sm },
  record: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  recordPressed: { backgroundColor: Colors.surface2 },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  recordBody: { flex: 1, minWidth: 0, gap: 2 },
  recordTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, color: Colors.text },
  recordMeta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  indicatorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
});
