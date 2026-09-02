import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileDown, FileText, LoaderCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../../components/AppHeader';
import { Button, EmptyState, ListSurface, OperationalRow } from '../../../../../components/ui';
import { contractorEvaluationPdfFilename, generateAndShareContractorEvaluationPdf, renderContractorEvaluationPdfHtml, type ContractorEvaluationPdfReport } from '../../../../../lib/contractor-evaluation-pdf';
import { usePrivateMediaUris } from '../../../../../hooks/usePrivateMediaUris';
import { Breakpoints, Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../../../../lib/constants';

type EvaluationRow = { id:string; status:string; obra_nome:string; equipe_nome:string; cnpj_terceiro:string|null; referencia:string|null; modelo_nome:string; numero_revisao:number; avaliador_nome:string|null; data_avaliacao:string; assinada_em:string|null; assinatura_url:string|null; pontos_obtidos:string; pontos_possiveis:string; percentual:string; notificacoes_ocorridas:string|null; providencias_tomadas:string|null; motivo_invalidacao:string|null };
type ItemRow = { ordem:number; titulo:string; peso:number; resultado:string|null; comentario_nao_atende:string|null };

const REPORT_QUERY = `SELECT a.id,a.status,a.data_avaliacao,a.assinada_em,a.assinatura_url,a.pontos_obtidos,a.pontos_possiveis,a.percentual,a.notificacoes_ocorridas,a.providencias_tomadas,a.motivo_invalidacao,o.nome obra_nome,e.nome equipe_nome,e.cnpj_terceiro,m.referencia,mo.nome modelo_nome,r.numero_revisao,u.nome avaliador_nome FROM avaliacoes_empreiteiro a JOIN obras o ON o.id=a.obra_id JOIN equipes e ON e.id=a.equipe_id LEFT JOIN medicoes_servico m ON m.id=a.medicao_id JOIN modelo_avaliacao_empreiteiro_revisoes r ON r.id=a.modelo_revisao_id JOIN modelos_avaliacao_empreiteiro mo ON mo.id=r.modelo_id LEFT JOIN usuarios u ON u.id=a.avaliador_id WHERE a.id=?`;
const ITEMS_QUERY = 'SELECT ordem,titulo,peso,resultado,comentario_nao_atende FROM avaliacao_empreiteiro_itens WHERE avaliacao_id=? ORDER BY ordem';

function printable(status:string) { return status === 'concluida' || status === 'aprovada' || status === 'invalidada'; }

export default function ContractorEvaluationPdfScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: evaluations, isLoading: isLoadingEvaluation } = useQuery<EvaluationRow>(REPORT_QUERY, [id ?? '']);
  const { data: items, isLoading: isLoadingItems } = useQuery<ItemRow>(ITEMS_QUERY, [id ?? '']);
  const evaluation = evaluations[0];
  const signatureUri = usePrivateMediaUris(evaluation?.assinatura_url ? [evaluation.assinatura_url] : [])(evaluation?.assinatura_url ?? '');
  const report = useMemo<ContractorEvaluationPdfReport | null>(() => {
    if (!evaluation) return null;
    return { id:evaluation.id, status:evaluation.status, obra:evaluation.obra_nome, empreiteiro:evaluation.equipe_nome, cnpj:evaluation.cnpj_terceiro, referencia:evaluation.referencia, modelo:evaluation.modelo_nome, revisao:Number(evaluation.numero_revisao), avaliador:evaluation.avaliador_nome ?? '—', dataAvaliacao:evaluation.data_avaliacao, assinadaEm:evaluation.assinada_em, assinaturaUri:signatureUri || null, pontosObtidos:Number(evaluation.pontos_obtidos), pontosPossiveis:Number(evaluation.pontos_possiveis), percentual:Number(evaluation.percentual), notificacoes:evaluation.notificacoes_ocorridas, providencias:evaluation.providencias_tomadas, motivoInvalidacao:evaluation.motivo_invalidacao, itens:items.map(item => ({ ordem:Number(item.ordem), titulo:item.titulo, peso:Number(item.peso), resultado:item.resultado, comentario:item.comentario_nao_atende })) };
  }, [evaluation, items, signatureUri]);
  async function generatePdf() {
    if (!report) return;
    setGenerating(true); setError(null);
    try { await generateAndShareContractorEvaluationPdf(renderContractorEvaluationPdfHtml(report), contractorEvaluationPdfFilename(report), report.assinaturaUri); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setGenerating(false); }
  }
  const loading = isLoadingEvaluation || isLoadingItems;
  return <SafeAreaView edges={['top']} style={styles.safe}><AppHeader title="Documento da avaliação" subtitle="PDF local para compartilhamento" showBack onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}>
    {loading ? <View style={styles.loading}><LoaderCircle size={24} color={Colors.brand} /><Text style={styles.muted}>Preparando documento...</Text></View> : !report || !printable(report.status) ? <EmptyState Icon={FileText} title="PDF indisponível" description="Somente avaliações assinadas, aprovadas ou invalidadas podem gerar documento." /> : <>
      <View style={styles.hero}><FileText size={24} color={Colors.brand} /><View style={styles.heroText}><Text style={styles.title}>Avaliação de {report.empreiteiro}</Text><Text style={styles.copy}>{report.obra} · {report.percentual.toFixed(0)}% · {report.itens.length} critérios</Text></View></View>
      <ListSurface>
        <OperationalRow last onPress={() => {}} accessibilityLabel="Modelo da avaliação"><Text style={styles.rowLabel}>Modelo</Text><Text style={styles.rowValue}>{report.modelo} · Rev. {report.revisao}</Text></OperationalRow>
        <OperationalRow last onPress={() => {}} accessibilityLabel="Responsável pela avaliação"><Text style={styles.rowLabel}>Responsável</Text><Text style={styles.rowValue}>{report.avaliador}</Text></OperationalRow>
        <OperationalRow last onPress={() => {}} accessibilityLabel="Estado da assinatura"><Text style={styles.rowLabel}>Assinatura</Text><Text style={styles.rowValue}>{report.assinaturaUri ? 'Incluída no documento' : 'Indisponível — dados permanecem válidos'}</Text></OperationalRow>
      </ListSurface>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      <Button label={generating ? 'Gerando PDF...' : 'Gerar PDF'} Icon={FileDown} onPress={() => void generatePdf()} disabled={generating} />
      <Text style={styles.helper}>No navegador, escolha “Salvar como PDF” na janela de impressão. No app, selecione onde compartilhar ou salvar o arquivo.</Text>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.bg}, content:{width:'100%',maxWidth:Breakpoints.maxContent,alignSelf:'center',padding:Spacing.lg,paddingBottom:48,gap:Spacing.lg}, loading:{minHeight:180,alignItems:'center',justifyContent:'center',gap:Spacing.sm}, muted:{...Typography.caption,color:Colors.textSecondary}, hero:{flexDirection:'row',gap:Spacing.md,alignItems:'flex-start',padding:Spacing.lg,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg}, heroText:{flex:1,gap:4}, title:{...Typography.heading,color:Colors.text}, copy:{...Typography.caption,color:Colors.textSecondary}, rowLabel:{...Typography.caption,color:Colors.textSecondary}, rowValue:{fontFamily:FontFamily.medium,fontSize:FontSizes.base,color:Colors.text,marginTop:4}, error:{padding:Spacing.md,borderRadius:Radius.md,backgroundColor:Colors.nokBg}, errorText:{...Typography.caption,color:Colors.nok}, helper:{...Typography.caption,color:Colors.textSecondary,textAlign:'center'},
});
