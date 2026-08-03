'use server';
import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';
import { signPrivateMedia } from '@/lib/media/signed-urls';
import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getVerificacaoDetalhe(id: string) {
  const context = await requireTenantRole(['admin', 'gestor']);
  const supabase = await createClient();

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
    .eq('cliente_id', context.clienteId)
    .single();

  if (error) {
    console.error('[getVerificacaoDetalhe] error:', error);
    return null;
  }

  if (!data) return null;

  const detail = data as unknown as {
    assinatura_url: string | null;
    verificacao_fotos: Array<{ r2_key: string }> | null;
    [key: string]: unknown;
  };
  const signedMedia = await signPrivateMedia(
    supabase as unknown as SupabaseClient<Database>,
    [detail.assinatura_url, ...(detail.verificacao_fotos ?? []).map(photo => photo.r2_key)],
  );

  return {
    ...detail,
    assinatura_url: detail.assinatura_url ? signedMedia.get(detail.assinatura_url) ?? null : null,
    verificacao_fotos: (detail.verificacao_fotos ?? []).map(photo => ({
      ...photo,
      r2_key: signedMedia.get(photo.r2_key) ?? '',
    })).filter(photo => Boolean(photo.r2_key)),
  };
}
