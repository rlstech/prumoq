import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowRight, CheckCircle2, Circle } from 'lucide-react-native';
import { AppHeader } from '../../../../../../../components/AppHeader';
import { goBack } from '../../../../../../../lib/navigation';
import { useMemo } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../../../../../../components/ProgressBar';
import { Colors, FontSizes, Radius, Spacing } from '../../../../../../../lib/constants';

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
  if (status === 'conforme')
    return (
      <View style={[styles.iconCircle, { backgroundColor: Colors.okBg }]}>
        <CheckCircle2 size={size} color={Colors.ok} />
      </View>
    );
  if (status === 'nao_conforme')
    return (
      <View style={[styles.iconCircle, { backgroundColor: Colors.nokBg }]}>
        <AlertCircle size={size} color={Colors.nok} />
      </View>
    );
  if (status === 'em_andamento')
    return (
      <View style={[styles.iconCircle, { backgroundColor: Colors.progressBg }]}>
        <ArrowRight size={size} color={Colors.progress} />
      </View>
    );
  return (
    <View style={[styles.iconCircle, { backgroundColor: Colors.naBg }]}>
      <Circle size={size} color={Colors.na} />
    </View>
  );
}

function statusLabel(status: string): { text: string; color: string } {
  if (status === 'conforme')     return { text: 'Concluído',    color: Colors.ok };
  if (status === 'nao_conforme') return { text: 'NC aberta',    color: Colors.nok };
  if (status === 'em_andamento') return { text: 'Em andamento', color: Colors.progress };
  return                                { text: 'Pendente',     color: Colors.na };
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

  const subtitleParts = [
    amb?.tipo === 'interno' ? 'Interno' : 'Externo',
    amb?.localizacao || null,
    amb?.obra_nome || null,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <AppHeader
        title={amb?.nome ?? '—'}
        subtitle={subtitleParts.join(' · ')}
        showBack
        onBack={() => goBack()}
      />

      {/* Summary panel */}
      <View style={styles.summaryPanel}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>FVS planejadas</Text>
            <Text style={styles.summaryTotal}>{summary.total} serviços</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>Concluídas</Text>
            <Text style={styles.summaryCount}>{summary.concluidas}/{summary.total}</Text>
          </View>
        </View>
        <ProgressBar value={summary.pct} height={6} color={Colors.brand} />
      </View>

      <FlatList
        data={fvsList}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>SERVIÇOS PLANEJADOS</Text>
        }
        renderItem={({ item }) => {
          const badge = statusLabel(item.status);
          return (
            <Pressable
              style={({ pressed }) => [styles.fvsCard, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/obras/${id}/ambiente/${ambId}/fvs/${item.id}` as never)}
            >
              <StatusIcon status={item.status} />
              <View style={styles.fvsBody}>
                <Text style={styles.fvsNome} numberOfLines={2}>{item.subservico || 'Serviço'}</Text>
                <Text style={styles.fvsDate}>
                  {item.ultima_verif
                    ? `Última verif: ${new Date(item.ultima_verif).toLocaleDateString('pt-BR')}`
                    : 'Não iniciado'}
                </Text>
              </View>
              <View style={styles.fvsRight}>
                <Text style={[styles.fvsStatus, { color: badge.color }]}>{badge.text}</Text>
                <Text style={styles.fvsVerif}>{item.total_verificacoes} verif.</Text>
              </View>
            </Pressable>
          );
        }}
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

  summaryPanel: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryLabel: { fontSize: FontSizes.xs, fontWeight: '500', color: Colors.textSecondary },
  summaryTotal: { fontSize: FontSizes.xxl, fontWeight: '700', color: Colors.text, marginTop: 2 },
  summaryRight: { alignItems: 'flex-end' },
  summaryCount: { fontSize: FontSizes.xxl, fontWeight: '700', color: Colors.ok, marginTop: 2 },

  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

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
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fvsBody:   { flex: 1 },
  fvsNome:   { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text },
  fvsDate:   { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  fvsRight:  { alignItems: 'flex-end', gap: 2 },
  fvsStatus: { fontSize: FontSizes.xs, fontWeight: '600' },
  fvsVerif:  { fontSize: FontSizes.xs, color: Colors.textTertiary },

  empty:     { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.base, color: Colors.textTertiary },
});
