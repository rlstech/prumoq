import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PenLine, Plus } from 'lucide-react-native';
import { AppHeader } from '../../../../../../../../../components/AppHeader';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

function resolveSignatureUri(url: string): string {
  if (url.startsWith('pending:')) return url.slice('pending:'.length);
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${R2_PUBLIC_URL}/${url}`;
}
import { FVS100PercentBanner } from '../../../../../../../../../components/FVS100PercentBanner';
import { FVSConclusionModal } from '../../../../../../../../../components/FVSConclusionModal';
import { FVSLockedScreen } from '../../../../../../../../../components/FVSLockedScreen';
import { FVSReopenModal } from '../../../../../../../../../components/FVSReopenModal';
import { PhotoGrid } from '../../../../../../../../../components/PhotoGrid';
import { PhotoViewer } from '../../../../../../../../../components/PhotoViewer';
import { StatusBadge } from '../../../../../../../../../components/StatusBadge';
import type { BadgeStatus } from '../../../../../../../../../components/StatusBadge';
import { Colors, FontSizes, Radius, Spacing } from '../../../../../../../../../lib/constants';

interface FvsRow { id: string; subservico: string; status: string; ambiente_nome: string; obra_nome: string }
interface ConclusaoRow {
  id: string; inspetor_nome: string; percentual_final: number;
  resultado: string; observacao_final: string | null;
  motivo_antes_100: string | null; created_at: string;
}
interface VerifRow {
  id: string; numero_verif: number; data_verif: string; status: string;
  observacoes: string; assinatura_url: string | null;
  inspetor_nome: string; percentual_exec: number; created_offline: number | boolean;
  created_at: string;
}
interface NcRow {
  id: string; verificacao_id: string; descricao: string;
  solucao_proposta: string; data_nova_verif: string;
  responsavel_nome: string | null; status: string; item_titulo: string;
}
interface FotoRow { id: string; verificacao_id: string; r2_key: string; ordem: number }

interface VerifWithData extends VerifRow {
  ncs: NcRow[];
  fotos: string[];
}

export default function FvsHistoryScreen() {
  const { id, ambId, fvsId } = useLocalSearchParams<{ id: string; ambId: string; fvsId: string }>();
  const router = useRouter();
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [signatureViewer, setSignatureViewer] = useState<string[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [conclusionModalOpen, setConclusionModalOpen] = useState(false);
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
    SELECT v.id, v.numero_verif, v.data_verif, v.status, v.observacoes,
           v.assinatura_url, v.percentual_exec, v.created_offline,
           v.created_at, u.nome AS inspetor_nome
    FROM verificacoes v
    LEFT JOIN usuarios u ON u.id = v.inspetor_id
    WHERE v.fvs_planejada_id = ?
    ORDER BY v.created_at DESC
  `, [fvsId]);

  const { data: ncs } = useQuery<NcRow>(`
    SELECT n.id, n.verificacao_id, n.descricao, n.solucao_proposta,
           n.data_nova_verif, n.status, vi.titulo AS item_titulo,
           e.nome AS responsavel_nome
    FROM nao_conformidades n
    JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
    LEFT JOIN equipes e ON e.id = n.responsavel_id
    WHERE n.verificacao_id IN (
      SELECT id FROM verificacoes WHERE fvs_planejada_id = ?
    )
  `, [fvsId]);

  const { data: fotos } = useQuery<FotoRow>(`
    SELECT id, verificacao_id, r2_key, ordem
    FROM verificacao_fotos
    WHERE verificacao_id IN (
      SELECT id FROM verificacoes WHERE fvs_planejada_id = ?
    )
    ORDER BY verificacao_id, ordem
  `, [fvsId]);

  const { data: conclusoes } = useQuery<ConclusaoRow>(`
    SELECT fc.id, fc.percentual_final, fc.resultado, fc.observacao_final,
           fc.motivo_antes_100, fc.created_at, u.nome AS inspetor_nome
    FROM fvs_conclusoes fc
    JOIN usuarios u ON u.id = fc.inspetor_id
    WHERE fc.fvs_planejada_id = ?
    ORDER BY fc.numero_conclusao DESC
    LIMIT 1
  `, [fvsId]);
  const ultimaConclusao = conclusoes[0] ?? null;

  const timeline = useMemo<VerifWithData[]>(() => {
    return verificacoes.map(v => ({
      ...v,
      ncs: ncs.filter(n => n.verificacao_id === v.id),
      fotos: fotos.filter(f => f.verificacao_id === v.id).map(f => f.r2_key),
    }));
  }, [verificacoes, ncs, fotos]);

  const isLocked = fvs?.status === 'concluida' || fvs?.status === 'concluida_ressalva';
  const ultimaVerif = timeline[0];
  const showBanner = !isLocked && !bannerDismissed && Number(ultimaVerif?.percentual_exec) === 100;

  const summary = useMemo(() => ({
    conformes:    verificacoes.filter(v => v.status === 'conforme').length,
    naoConformes: verificacoes.filter(v => v.status === 'nao_conforme').length,
    pendentes:    verificacoes.filter(v => v.status === 'em_andamento' || v.status === 'pendente').length,
  }), [verificacoes]);

  function openViewer(photos: string[], index: number) {
    setViewerPhotos(photos);
    setViewerIndex(index);
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <AppHeader
        title={fvs?.subservico || 'FVS'}
        subtitle={[fvs?.ambiente_nome, fvs?.obra_nome].filter(Boolean).join(' · ')}
        showBack
        onBack={() => router.back()}
        rightElement={
          !isLocked ? (
            <Pressable
              style={styles.novaBtn}
              onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${fvsId}/verificacao/nova` as never)}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.novaBtnText}>Nova</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Status panel */}
      <View style={styles.statusPanel}>
        {fvs && <StatusBadge status={fvs.status as BadgeStatus} />}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>✓ {summary.conformes}</Text>
          <Text style={styles.summaryItem}>✗ {summary.naoConformes}</Text>
          <Text style={styles.summaryItem}>→ {summary.pendentes}</Text>
          <Text style={styles.summaryTotal}>{verificacoes.length} verificaç{verificacoes.length !== 1 ? 'ões' : 'ão'}</Text>
        </View>
      </View>

      <FlatList
        data={timeline}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isLocked ? (
            <FVSLockedScreen
              status={fvs!.status as 'concluida' | 'concluida_ressalva'}
              conclusao={ultimaConclusao}
              onRequestReopen={() => setReopenModalOpen(true)}
            />
          ) : showBanner ? (
            <FVS100PercentBanner
              onConclude={() => setConclusionModalOpen(true)}
              onDismiss={() => setBannerDismissed(true)}
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={styles.timelineItem}>
            {/* Timeline dot + line */}
            <View style={styles.dotCol}>
              <View style={[styles.dot, { backgroundColor: dotColor(item.status) }]} />
              {index < timeline.length - 1 && <View style={styles.line} />}
            </View>

            {/* Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.cardDate}>
                    {new Date(item.created_at || item.data_verif).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <Text style={styles.cardInspector}>{item.inspetor_nome ?? 'Inspetor'}</Text>
                </View>
                <StatusBadge status={item.status as BadgeStatus} size="sm" />
              </View>

              <Text style={styles.cardVerifNum}>
                Verificação #{item.numero_verif} — {item.percentual_exec}% de execução
              </Text>

              {(item.created_offline === 1 || item.created_offline === true) && (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>Aguardando sync</Text>
                </View>
              )}

              {item.observacoes ? (
                <Text style={styles.cardObs} numberOfLines={3}>{item.observacoes}</Text>
              ) : null}

              {/* NCs */}
              {item.ncs.map(nc => (
                <View key={nc.id} style={styles.ncPanel}>
                  <View style={styles.ncHeader}>
                    <Text style={styles.ncItem}>{nc.item_titulo}</Text>
                    <StatusBadge status={nc.status as BadgeStatus} size="sm" />
                  </View>
                  <Text style={styles.ncDesc}>{nc.descricao}</Text>
                  {nc.solucao_proposta ? (
                    <Text style={styles.ncSolucao}>↳ {nc.solucao_proposta}</Text>
                  ) : null}
                  <View style={styles.ncFooter}>
                    {nc.data_nova_verif && (
                      <Text style={styles.ncMeta}>
                        Prazo: {new Date(nc.data_nova_verif).toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                    {nc.responsavel_nome && (
                      <Text style={styles.ncMeta}>Resp.: {nc.responsavel_nome}</Text>
                    )}
                  </View>
                </View>
              ))}

              {/* Photos */}
              {item.fotos.length > 0 && (
                <PhotoGrid
                  photos={item.fotos}
                  max={4}
                  onPress={(i) => openViewer(item.fotos, i)}
                />
              )}

              {/* Signature */}
              {item.assinatura_url ? (
                <View style={styles.signatureSection}>
                  <View style={styles.signedRow}>
                    <PenLine size={12} color={Colors.ok} />
                    <Text style={styles.signedText}>Assinado digitalmente</Text>
                  </View>
                  <Pressable onPress={() => setSignatureViewer([resolveSignatureUri(item.assinatura_url!)])}>
                    <Image
                      source={{ uri: resolveSignatureUri(item.assinatura_url) }}
                      style={styles.signatureThumb}
                      resizeMode="contain"
                    />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.signedRow}>
                  <PenLine size={12} color={Colors.textTertiary} />
                  <Text style={styles.unsignedText}>Sem assinatura</Text>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !isLocked ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma verificação registrada</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${fvsId}/verificacao/nova` as never)}
              >
                <Text style={styles.emptyBtnText}>Registrar primeira verificação</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      <PhotoViewer
        photos={viewerPhotos}
        initialIndex={viewerIndex}
        visible={viewerPhotos.length > 0}
        onClose={() => setViewerPhotos([])}
      />
      <PhotoViewer
        photos={signatureViewer}
        initialIndex={0}
        visible={signatureViewer.length > 0}
        onClose={() => setSignatureViewer([])}
      />
      <FVSConclusionModal
        visible={conclusionModalOpen}
        fvsId={fvsId!}
        percentualAtual={Number(ultimaVerif?.percentual_exec) ?? 0}
        onClose={() => setConclusionModalOpen(false)}
        onSuccess={() => {
          setConclusionModalOpen(false);
          setBannerDismissed(true);
        }}
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

function dotColor(status: string): string {
  if (status === 'conforme')     return Colors.ok;
  if (status === 'nao_conforme') return Colors.nok;
  if (status === 'em_andamento') return Colors.progress;
  return Colors.na;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  novaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  novaBtnText: { color: '#fff', fontSize: FontSizes.base, fontWeight: '500' },
  statusPanel: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  summaryItem: { fontSize: FontSizes.base, color: Colors.textSecondary, fontWeight: '500' },
  summaryTotal: { fontSize: FontSizes.sm, color: Colors.textTertiary },
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  timelineItem: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  dotCol: { alignItems: 'center', paddingTop: 4, width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { gap: 2 },
  cardDate: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text },
  cardInspector: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  cardVerifNum: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  offlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warnBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offlineBadgeText: { fontSize: FontSizes.tiny, color: Colors.warn, fontWeight: '500' },
  cardObs: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  ncPanel: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.nok,
    padding: Spacing.md,
    gap: 4,
  },
  ncHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  ncItem: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.nok, flex: 1 },
  ncDesc: { fontSize: FontSizes.sm, color: Colors.text },
  ncSolucao: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  ncFooter: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', marginTop: 2 },
  ncMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  signatureSection: { gap: 6 },
  signedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signedText: { fontSize: FontSizes.xs, color: Colors.ok, fontWeight: '500' },
  unsignedText: { fontSize: FontSizes.xs, color: Colors.textTertiary },
  signatureThumb: {
    width: '100%',
    height: 80,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  empty: { alignItems: 'center', gap: Spacing.lg, paddingTop: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textTertiary },
  emptyBtn: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  emptyBtnText: { color: '#fff', fontWeight: '500', fontSize: FontSizes.md },
});
