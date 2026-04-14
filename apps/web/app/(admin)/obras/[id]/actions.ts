'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthenticatedUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  return user;
}

export async function createAmbiente(
  obraId: string,
  formData: { nome: string; tipo: string; localizacao: string; observacoes: string },
  selectedFvsIds: string[],
  fvsPadraoList: { id: string; nome: string; revisao_atual: number }[]
) {
  try {
    await getAuthenticatedUser();

    // Normalize enum: accept 'Interno'/'Externo' or 'interno'/'externo'
    const tipo = formData.tipo.toLowerCase() as 'interno' | 'externo';

    const { data: ambiente, error: ambError } = await supabaseAdmin
      .from('ambientes')
      .insert({
        nome: formData.nome,
        tipo,
        localizacao: formData.localizacao || null,
        observacoes: formData.observacoes || null,
        obra_id: obraId,
        ativo: true,
      })
      .select()
      .single();

    if (ambError) throw ambError;

    if (selectedFvsIds.length > 0) {
      const fvsToInsert = selectedFvsIds.map(fvsId => {
        const pd = fvsPadraoList.find(f => f.id === fvsId);
        return {
          ambiente_id: (ambiente as any).id,
          fvs_padrao_id: fvsId,
          subservico: pd?.nome ?? 'Serviço Padrão',
          revisao_associada: pd?.revisao_atual ?? 1,
          status: 'pendente',
        };
      });

      const { error: fvsError } = await supabaseAdmin
        .from('fvs_planejadas')
        .insert(fvsToInsert);

      if (fvsError) throw new Error(`Ambiente criado, mas erro ao agendar FVS: ${fvsError.message}`);
    }

    revalidatePath(`/obras/${obraId}`);
    return { success: true, data: ambiente };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addEquipeToObra(obraId: string, equipeId: string) {
  try {
    await getAuthenticatedUser();
    console.log('[addEquipeToObra] inserting', { obraId, equipeId });
    const { data, error } = await supabaseAdmin
      .from('obra_equipes' as never)
      .insert({ obra_id: obraId, equipe_id: equipeId } as never)
      .select();
    console.log('[addEquipeToObra] result', { data, error });
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[addEquipeToObra] caught error', error);
    return { success: false, error: error.message };
  }
}

export async function removeEquipeFromObra(obraId: string, equipeId: string) {
  try {
    await getAuthenticatedUser();
    const { error } = await supabaseAdmin
      .from('obra_equipes' as never)
      .delete()
      .eq('obra_id', obraId)
      .eq('equipe_id', equipeId);
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
