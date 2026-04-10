import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, XCircle } from 'lucide-react-native';
import { useMemo } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../../../../../../components/ProgressBar';
import { Colors, Radius, Spacing } from '../../../../../../../lib/constants';

interface AmbienteRow { id: string; nome: string; tipo: string; localizacao: string; obra_nome: string }
interface FvsRow {
  id: string;
  subservico: string;
  status: string;
  ultima_verif: string | null;
  total_verificacoes: number;
}

function StatusIcon({ status }: { status: string }) {
  const size = 18;
  if (status === 'conforme')     return <CheckCircle2 size={size} color={Colors.ok} />;
  if (status === 'nao_conforme') return <XCircle size={size} color={Colors.nok} />;
  if (status === 'em_andamento') return <ChevronRight size={size} color={Colors.warn} />;
  return <Circle size={size} color={Colors.na} />;
}

export default function AmbienteScreen() {
  const { id, ambId } = useLocalSearchParams<{ id: string; ambId: string }>();
  const router = useRouter();

  const { data: ambRows } = useQuery<AmbienteRow>(`
    SELECT a.id, a.nome, a.tipo, a.localizacao, o.nome AS obra_nome
    FROM ambientes a
    JOIN obras o ON o.id = a.obra_id
    WHERE a.id = ?
  `, [ambId]);
  const amb = ambRows[0];

  const { data: fvsList } = useQuery<FvsRow>(`
    SELECT fp.id, fp.subservico, fp.status,
      COUNT(v.id) AS total_verificacoes,
      MAX(v.data_verif) AS ultima_verif
    FROM fvs_planejadas fp
    LEFT JOIN verificacoes v ON v.fvs_planejada_id = fp.id
    WHERE fp.ambiente_id = ?
    GROUP BY fp.id
    ORDER BY fp.subservico
  `, [ambId]);

  const summary = useMemo(() => {
    const total = fvsList.length;
    const concluidas = fvsList.filter(f => f.status === 'conforme').length;
    const pct = total > 0 ? (concluidas / total) * 100 : 0;
    return { total, concluidas, pct };
  }, [fvsList]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{amb?.nome ?? '—'}</Text>
          <Text style={styles.subtitle}>
            {amb?.tipo === 'interno' ? 'Ambiente interno' : 'Ambiente externo'}
            {amb?.obra_nome ? ` · ${amb.obra_nome}` : ''}
          </Text>
        </View>
      </View>

      {/* Summary panel */}
      <View style={styles.summaryPanel}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>FVS planejadas</Text>
          <Text style={styles.summaryCount}>{summary.concluidas}/{summary.total}</Text>
        </View>
        <ProgressBar value={summary.pct} height={6} color={Colors.ok} showLabel />
      </View>

      <FlatList
        data={fvsList}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.fvsCard, pressed && { opacity: 0.75 }]}
            onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
          >
            <View style={styles.fvsLeft}>
              <StatusIcon status={item.status} />
            </View>
            <View style={styles.fvsBody}>
              <Text style={styles.fvsNome} numberOfLines={2}>{item.subservico || 'Serviço'}</Text>
              {item.ultima_verif && (
                <Text style={styles.fvsDate}>
                  Última: {new Date(item.ultima_verif).toLocaleDateString('pt-BR')}
                  {item.total_verificacoes > 0 ? ` · ${item.total_verificacoes} verif.` : ''}
                </Text>
              )}
              {!item.ultima_verif && (
                <Text style={styles.fvsDate}>Nenhuma verificação</Text>
              )}
            </View>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma FVS planejada</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 17, fontWeight: '500' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  summaryPanel: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  summaryCount: { fontSize: 13, fontWeight: '600', color: Colors.ok },
  list: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: Spacing.xxl },
  fvsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fvsLeft: { width: 24, alignItems: 'center' },
  fvsBody: { flex: 1 },
  fvsNome: { fontSize: 13, fontWeight: '500', color: Colors.text },
  fvsDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.textTertiary },
});
