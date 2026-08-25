import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPrivateMedia } from '@/lib/media/signed-urls';

export type ContractorEvaluationReport = { evaluation: Database['public']['Tables']['avaliacoes_empreiteiro']['Row']; obra: string; empreiteiro: string; cnpj: string | null; modelo: string; revisao: number; avaliador: string; itens: Database['public']['Tables']['avaliacao_empreiteiro_itens']['Row'][]; signature: string | null };

export async function loadContractorEvaluationReport(client: SupabaseClient<Database>, id: string): Promise<ContractorEvaluationReport | null> {
  const { data: evaluation, error } = await client.from('avaliacoes_empreiteiro').select('*').eq('id', id).maybeSingle();
  if (error) throw error; if (!evaluation) return null;
  const [{ data: work }, { data: team }, { data: revision }, { data: items }, { data: user }] = await Promise.all([
    client.from('obras').select('nome').eq('id', evaluation.obra_id).maybeSingle(), client.from('equipes').select('nome,cnpj_terceiro').eq('id', evaluation.equipe_id).maybeSingle(),
    client.from('modelo_avaliacao_empreiteiro_revisoes').select('modelo_id,numero_revisao').eq('id', evaluation.modelo_revisao_id).single(),
    client.from('avaliacao_empreiteiro_itens').select('*').eq('avaliacao_id', id).order('ordem'), client.from('usuarios').select('nome').eq('id', evaluation.avaliador_id).maybeSingle(),
  ]);
  const { data: model } = revision ? await client.from('modelos_avaliacao_empreiteiro').select('nome').eq('id', revision.modelo_id).maybeSingle() : { data: null };
  const signed = evaluation.assinatura_url ? await signPrivateMedia(client, [evaluation.assinatura_url]) : new Map<string, string>();
  return { evaluation, obra: work?.nome ?? 'Obra', empreiteiro: team?.nome ?? 'Empreiteiro', cnpj: team?.cnpj_terceiro ?? null, modelo: model?.nome ?? 'Modelo de avaliação', revisao: revision?.numero_revisao ?? 0, avaliador: user?.nome ?? '—', itens: items ?? [], signature: evaluation.assinatura_url ? signed.get(evaluation.assinatura_url) ?? null : null };
}
