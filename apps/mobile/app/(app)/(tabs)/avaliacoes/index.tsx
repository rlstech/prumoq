import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, ClipboardCheck, FileDown, Plus } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../../components/AppHeader';
import { Button, EmptyState, ListSurface, OperationalRow } from '../../../../components/ui';
import { Breakpoints, Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../../../lib/constants';

type Row = { id:string; obra_id:string; equipe_id:string; medicao_id:string|null; data_avaliacao:string; status:string; percentual:string; obra_nome:string; equipe_nome:string; referencia:string|null };
const QUERY = `SELECT a.id,a.obra_id,a.equipe_id,a.medicao_id,a.data_avaliacao,a.status,a.percentual,o.nome obra_nome,e.nome equipe_nome,m.referencia FROM avaliacoes_empreiteiro a JOIN obras o ON o.id=a.obra_id JOIN equipes e ON e.id=a.equipe_id LEFT JOIN medicoes_servico m ON m.id=a.medicao_id ORDER BY a.created_at DESC`;
const PENDING = `SELECT m.id,m.referencia,o.nome obra_nome,e.nome equipe_nome FROM medicoes_servico m JOIN obras o ON o.id=m.obra_id JOIN equipes e ON e.id=m.equipe_id LEFT JOIN avaliacoes_empreiteiro a ON a.medicao_id=m.id AND a.status IN ('rascunho','concluida','aprovada') WHERE m.status='rascunho' AND e.tipo='terceirizado' AND a.id IS NULL ORDER BY m.data_medicao DESC`;

function statusLabel(status:string, percentual:string): { text:string; tone:'ok'|'warn'|'muted' } {
  if (status === 'aprovada') return { text: `${Number(percentual).toFixed(0)}%`, tone: 'ok' };
  if (status === 'concluida' || status === 'aguardando_aprovacao') return { text: `${Number(percentual).toFixed(0)}% · aguardando aprovação`, tone: 'warn' };
  if (status === 'invalidada') return { text: 'Invalidada', tone: 'muted' };
  return { text: 'Rascunho', tone: 'muted' };
}
const isEditable = (status:string) => status === 'rascunho' || status === 'concluida';
const canExport = (status:string) => status === 'concluida' || status === 'aprovada' || status === 'invalidada';

export default function EvaluationsScreen() {
  const router = useRouter();
  const { data: items, isLoading } = useQuery<Row>(QUERY, []);
  const { data: pending } = useQuery<{id:string; referencia:string; obra_nome:string; equipe_nome:string}>(PENDING, []);
  return <SafeAreaView style={styles.safe}><AppHeader title="Avaliações" subtitle="Fornecedores de serviço" /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}><View><Text style={styles.heroTitle}>Avaliações em campo</Text><Text style={styles.heroCopy}>{pending.length} {pending.length === 1 ? 'medição aguardando avaliação' : 'medições aguardando avaliação'}</Text></View><View style={styles.heroBadge}><ClipboardCheck size={22} color={Colors.brand} /></View></View>
    {pending.length ? <View style={styles.section}><Text style={styles.title}>Aguardando avaliação</Text><ListSurface>{pending.map((item, index) => <OperationalRow key={item.id} last={index === pending.length - 1} onPress={() => router.push(`/avaliacoes/nova?medicaoId=${item.id}` as never)} accessibilityLabel={`Avaliar medição ${item.referencia}`} trailing={<ChevronRight size={19} color={Colors.textTertiary} />}><Text style={styles.rowTitle}>{item.referencia}</Text><Text style={styles.rowMeta}>{item.equipe_nome} · {item.obra_nome}</Text></OperationalRow>)}</ListSurface></View> : null}
    <View style={styles.section}><View style={styles.heading}><Text style={styles.title}>Histórico</Text><Button label="Avulsa" Icon={Plus} variant="secondary" onPress={() => router.push('/avaliacoes/nova' as never)} /></View>
      {isLoading ? <Text style={styles.muted}>Carregando avaliações...</Text> : items.length ? <ListSurface>{items.map((item, index) => { const status = statusLabel(item.status, item.percentual); const editable = isEditable(item.status); return <OperationalRow key={item.id} last={index === items.length - 1} onPress={() => { if (editable) router.push(`/avaliacoes/nova?avaliacaoId=${item.id}` as never); }} accessibilityLabel={editable ? `Editar avaliação de ${item.equipe_nome}` : `Avaliação de ${item.equipe_nome}`} trailing={<View style={styles.trailing}><Text style={[styles.score, styles[status.tone]]}>{status.text}</Text>{canExport(item.status) ? <Pressable onPress={() => router.push(`/avaliacoes/${item.id}/pdf` as never)} style={styles.pdfButton} accessibilityRole="button" accessibilityLabel={`Gerar PDF da avaliação de ${item.equipe_nome}`}><FileDown size={16} color={Colors.brand} /></Pressable> : null}</View>}><Text style={styles.rowTitle}>{item.equipe_nome}</Text><Text style={styles.rowMeta}>{item.obra_nome} · {item.referencia ?? 'Avulsa'} · {item.data_avaliacao}</Text></OperationalRow>; })}</ListSurface> : <EmptyState Icon={ClipboardCheck} title="Nenhuma avaliação registrada" description="As avaliações concluídas no campo aparecerão aqui." />}
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.bg}, content:{width:'100%',maxWidth:Breakpoints.maxContent,alignSelf:'center',padding:Spacing.lg,paddingBottom:110,gap:Spacing.xl}, hero:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,padding:Spacing.lg,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, heroTitle:{...Typography.heading,color:Colors.text}, heroCopy:{...Typography.caption,color:Colors.textSecondary,marginTop:4}, heroBadge:{width:46,height:46,borderRadius:Radius.md,backgroundColor:Colors.brandLight,alignItems:'center',justifyContent:'center'}, section:{gap:Spacing.sm}, heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, title:{...Typography.heading,color:Colors.text}, rowTitle:{fontFamily:FontFamily.semibold,fontSize:FontSizes.base,color:Colors.text}, rowMeta:{...Typography.caption,color:Colors.textSecondary,marginTop:3}, trailing:{flexDirection:'row',alignItems:'center',gap:Spacing.sm}, pdfButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:Radius.md,backgroundColor:Colors.brandLight}, score:{fontFamily:FontFamily.monoSemibold,fontSize:FontSizes.base}, ok:{color:Colors.ok}, warn:{color:Colors.warn}, muted:{color:Colors.textTertiary},
});
