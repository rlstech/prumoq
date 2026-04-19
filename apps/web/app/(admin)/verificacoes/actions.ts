'use server';
import { createClient } from '@supabase/supabase-js';

export async function getVerificacaoDetalhe(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('verificacoes' as any)
    .select(`
      *,
      fvs_planejadas(subservico, ambientes(nome, obras(nome))),
      usuarios(nome),
      verificacao_itens(id, ordem, titulo, metodo_verif, tolerancia, resultado),
      verificacao_fotos(id, r2_key, ordem),
      nao_conformidades!nao_conformidades_verificacao_id_fkey(id, verificacao_item_id, descricao, status, prioridade)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[getVerificacaoDetalhe] error:', error);
    return null;
  }

  return data as any;
}
