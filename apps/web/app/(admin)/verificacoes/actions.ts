'use server';
import { createClient } from '@/lib/supabase/server';

export async function getVerificacaoDetalhe(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('verificacoes' as any)
    .select(`
      *,
      fvs_planejadas(subservico, ambientes(nome, obras(nome))),
      usuarios(nome),
      verificacao_itens(id, ordem, titulo, metodo_verif, tolerancia, resultado),
      verificacao_fotos(id, r2_key, ordem),
      nao_conformidades(id, verificacao_item_id, descricao, status, prioridade)
    `)
    .eq('id', id)
    .single();
  return data as any;
}
