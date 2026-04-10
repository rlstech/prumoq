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
import { ProgressBar } from '../../../../components/ProgressBar';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Colors, Radius, Spacing } from '../../../../lib/constants';
import type { BadgeStatus } from '../../../../components/StatusBadge';

interface ObraRow {
  id: string;
  nome: string;
  status: string;
  municipio: string;
  uf: string;
  total_fvs: number;
  fvs_concluidas: number;
  ncs_abertas: number;
}

const OBRAS_QUERY = `
  SELECT
    o.id,
    o.nome,
    o.status,
    o.municipio,
    o.uf,
    COUNT(DISTINCT f.id)  AS total_fvs,
    COUNT(DISTINCT f2.id) AS fvs_concluidas,
    COUNT(DISTINCT n.id)  AS ncs_abertas
  FROM obras o
  LEFT JOIN ambientes a  ON a.obra_id = o.id
  LEFT JOIN fvs_planejadas f  ON f.ambiente_id = a.id
  LEFT JOIN fvs_planejadas f2 ON f2.ambiente_id = a.id AND f2.status = 'conforme'
  LEFT JOIN nao_conformidades n ON n.status = 'aberta' AND n.verificacao_id IN (
    SELECT id FROM verificacoes
    WHERE fvs_planejada_id IN (
      SELECT id FROM fvs_planejadas WHERE ambiente_id = a.id
    )
  )
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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Obras</Text>
          <Text style={styles.subtitle}>{obras.length} ativa{obras.length !== 1 ? 's' : ''}</Text>
        </View>
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const progress = item.total_fvs > 0
            ? (item.fvs_concluidas / item.total_fvs) * 100
            : 0;
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
  safe: { flex: 1, backgroundColor: Colors.brand },
  header: {
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  title: { color: '#fff', fontSize: 19, fontWeight: '500' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
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
    fontSize: 14,
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
  cardNome: { fontSize: 14, fontWeight: '500', color: Colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCity: { fontSize: 12, color: Colors.textSecondary },
  cardBottom: { gap: Spacing.xs },
  cardStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statText: { fontSize: 11, color: Colors.textSecondary },
  ncBadge: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ncBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.nok },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { fontSize: 14, color: Colors.textTertiary },
});
