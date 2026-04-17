import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react-native';
import { useMemo, useState, useEffect } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../../components/AppHeader';
import { Colors, FontSizes, Radius, Spacing } from '../../../../lib/constants';
import { supabase } from '../../../../lib/supabase';

type TabKey = 'abertas' | 'resolvidas' | 'todas';

interface NcRow {
  id: string;
  descricao: string;
  status: string;
  data_nova_verif: string | null;
  prioridade: string;
  item_titulo: string;
  ambiente_nome: string;
  obra_nome: string;
  responsavel_nome: string | null;
  fvs_planejada_id: string;
  obra_id: string;
  ambiente_id: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'abertas',   label: 'Abertas'   },
  { key: 'resolvidas', label: 'Resolvidas' },
  { key: 'todas',     label: 'Todas'     },
];

function deadlineBadge(dateStr: string | null): { label: string; color: string } | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: 'Vencida',       color: Colors.nok };
  if (diff === 0) return { label: 'Vence hoje',    color: Colors.nok };
  if (diff <= 3)  return { label: `${diff}d`,      color: Colors.warn };
  return null;
}

export default function NcScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('abertas');
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: u } = await supabase
        .from('usuarios' as never)
        .select('perfil')
        .eq('id', data.user.id)
        .single();
      if (u) setPerfil((u as { perfil: string }).perfil);
    });
  }, []);

  const ready = !!userId && !!perfil;
  const accessFilter = `(? = 'admin' OR EXISTS (SELECT 1 FROM obra_usuarios ou WHERE ou.obra_id = o.id AND ou.usuario_id = ?))`;

  const { data: ncs } = useQuery<NcRow>(
    ready ? `
    SELECT n.id, n.descricao, n.status, n.data_nova_verif, n.prioridade,
           vi.titulo AS item_titulo,
           a.nome AS ambiente_nome, o.nome AS obra_nome,
           e.nome AS responsavel_nome,
           fp.id AS fvs_planejada_id,
           o.id AS obra_id, a.id AS ambiente_id
    FROM nao_conformidades n
    JOIN verificacao_itens vi ON vi.id = n.verificacao_item_id
    JOIN verificacoes v ON v.id = n.verificacao_id
    JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
    JOIN ambientes a ON a.id = fp.ambiente_id
    JOIN obras o ON o.id = a.obra_id
    LEFT JOIN equipes e ON e.id = n.responsavel_id
    WHERE n.status IN ('aberta', 'resolvida') AND ${accessFilter}
    ORDER BY n.data_nova_verif ASC NULLS LAST
  ` : 'SELECT 1 WHERE 0',
    ready ? [perfil, userId] : []
  );

  const filtered = useMemo(() => {
    if (activeTab === 'abertas')   return ncs.filter(n => n.status === 'aberta');
    if (activeTab === 'resolvidas') return ncs.filter(n => n.status === 'resolvida');
    return ncs;
  }, [ncs, activeTab]);

  const counts = useMemo(() => ({
    abertas:   ncs.filter(n => n.status === 'aberta').length,
    resolvidas: ncs.filter(n => n.status === 'resolvida').length,
  }), [ncs]);

  function goReinspect(nc: NcRow) {
    router.push(`/obras/${nc.obra_id}/ambiente/${nc.ambiente_id}/fvs/${nc.fvs_planejada_id}/verificacao/nova` as never);
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <AppHeader
        title="Não Conformidades"
        subtitle={`${counts.abertas} aberta${counts.abertas !== 1 ? 's' : ''} · ${counts.resolvidas} resolvida${counts.resolvidas !== 1 ? 's' : ''}`}
      />

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <Pressable key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isAberta = item.status === 'aberta';
          const badge = deadlineBadge(item.data_nova_verif);
          return (
            <View style={[styles.card, !isAberta && styles.cardResolved]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  {isAberta
                    ? <AlertTriangle size={14} color={Colors.nok} />
                    : <CheckCircle2 size={14} color={Colors.ok} />
                  }
                  <Text style={[styles.cardItem, !isAberta && styles.cardItemResolved]} numberOfLines={2}>
                    {item.item_titulo}
                  </Text>
                </View>
                {badge && (
                  <View style={[styles.deadlineBadge, { backgroundColor: badge.color + '22' }]}>
                    <Clock size={10} color={badge.color} />
                    <Text style={[styles.deadlineText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardDesc} numberOfLines={2}>{item.descricao}</Text>
              <Text style={styles.cardMeta}>{item.obra_nome} · {item.ambiente_nome}</Text>

              {item.responsavel_nome && (
                <Text style={styles.cardResp}>Resp.: {item.responsavel_nome}</Text>
              )}

              <View style={styles.cardFooter}>
                {item.data_nova_verif && (
                  <Text style={styles.cardDate}>
                    Prazo: {new Date(item.data_nova_verif).toLocaleDateString('pt-BR')}
                  </Text>
                )}
                {isAberta && (
                  <Pressable style={styles.reinspBtn} onPress={() => goReinspect(item)}>
                    <Text style={styles.reinspBtnText}>Reinspecionar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CheckCircle2 size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>
              {activeTab === 'abertas' ? 'Nenhuma NC aberta' : 'Nenhuma NC encontrada'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.brand },
  tabText: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.brand },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.nok,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardResolved: { opacity: 0.7, borderLeftColor: Colors.ok },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flex: 1 },
  cardItem: { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text, flex: 1 },
  cardItemResolved: { color: Colors.textSecondary },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deadlineText: { fontSize: FontSizes.xs, fontWeight: '600' },
  cardDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.textTertiary },
  cardResp: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardDate: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  reinspBtn: {
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  reinspBtnText: { fontSize: FontSizes.sm, color: Colors.progress, fontWeight: '500' },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textTertiary },
});
