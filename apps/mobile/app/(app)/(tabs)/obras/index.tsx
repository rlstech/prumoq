import { useQuery } from '@powersync/react-native';
import { Building2, MapPin, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../../../../components/AppHeader';
import { ProgressBar } from '../../../../components/ProgressBar';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Colors, FontSizes, Radius, Spacing } from '../../../../lib/constants';
import type { BadgeStatus } from '../../../../components/StatusBadge';

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
    COUNT(DISTINCT CASE WHEN f.status = 'conforme' THEN f.id END) AS fvs_concluidas,
    CAST(SUM(CASE f.status WHEN 'conforme' THEN 100 WHEN 'em_andamento' THEN COALESCE(f.percentual_exec, 0) ELSE 0 END) AS REAL) / NULLIF(COUNT(DISTINCT f.id), 0) AS progresso_percentual,
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
  GROUP BY o.id
  ORDER BY o.nome
`;

export default function ObrasScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: obras } = useQuery<ObraRow>(OBRAS_QUERY);

  const filtered = useMemo(() => {
    if (!search.trim()) return obras;
    const q = search.toLowerCase();
    return obras.filter(o => o.nome.toLowerCase().includes(q) || o.municipio?.toLowerCase().includes(q));
  }, [obras, search]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Obras"
        subtitle={`${obras.length} ativa${obras.length !== 1 ? 's' : ''}`}
      >
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou cidade..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </AppHeader>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const progress = item.progresso_percentual ?? 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/obras/${item.id}` as never)}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardNome} numberOfLines={1}>{item.nome}</Text>
                </View>
                <StatusBadge status={item.status as BadgeStatus} size="sm" />
              </View>

              <View style={styles.cardMeta}>
                <MapPin size={12} color={Colors.textTertiary} />
                <Text style={styles.cardCity}>{item.municipio}{item.uf ? `, ${item.uf}` : ''}</Text>
              </View>

              <View style={styles.cardBottom}>
                <ProgressBar value={progress} height={5} color={Colors.ok} />
                <View style={styles.cardStats}>
                  <Text style={styles.statText}>{item.fvs_concluidas}/{item.total_fvs} FVS</Text>
                  {item.ncs_abertas > 0 && (
                    <View style={styles.ncBadge}>
                      <Text style={styles.ncBadgeText}>{item.ncs_abertas} NC</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Building2 size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma obra encontrada</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: '#fff',
    fontSize: FontSizes.md,
  },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardLeft: { flex: 1 },
  cardNome: { fontSize: FontSizes.md, fontWeight: '500', color: Colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCity: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  cardBottom: { gap: Spacing.xs },
  cardStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  ncBadge: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ncBadgeText: { fontSize: FontSizes.tiny, fontWeight: '600', color: Colors.nok },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textTertiary },
});
