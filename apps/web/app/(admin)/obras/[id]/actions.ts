'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertObraInTenant, requireTenantRole } from '@/lib/auth/context';

async function requireObra(obraId: string) {
  const context = await requireTenantRole(['admin', 'gestor']);
  await assertObraInTenant(obraId, context.clienteId);
  return context;
}

export async function createAmbiente(
  obraId: string,
  formData: { nome: string; tipo: string; localizacao: string; observacoes: string },
  selectedFvsIds: string[],
  fvsPadraoList: { id: string; nome: string; revisao_atual: number }[],
) {
  try {
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { data: ambiente, error } = await supabase.from('ambientes').insert({
      cliente_id: context.clienteId,
      nome: formData.nome.trim(),
      tipo: formData.tipo.toLowerCase() as 'interno' | 'externo',
      localizacao: formData.localizacao || null,
      observacoes: formData.observacoes || null,
      obra_id: obraId,
      ativo: true,
    }).select().single();
    if (error) throw error;

    if (selectedFvsIds.length) {
      const allowedIds = new Set(fvsPadraoList.map(item => item.id));
      if (selectedFvsIds.some(id => !allowedIds.has(id))) throw new Error('FVS fora do escopo desta empresa.');
      const { error: fvsError } = await supabase.from('fvs_planejadas').insert(
        selectedFvsIds.map(fvsId => {
          const padrao = fvsPadraoList.find(item => item.id === fvsId);
          return {
            cliente_id: context.clienteId,
            ambiente_id: ambiente.id,
            fvs_padrao_id: fvsId,
            subservico: padrao?.nome ?? 'Serviço Padrão',
            revisao_associada: padrao?.revisao_atual ?? 1,
            status: 'pendente' as const,
          };
        }),
      );
      if (fvsError) throw fvsError;
    }
    revalidatePath(`/obras/${obraId}`);
    return { success: true, data: ambiente };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar ambiente.' };
  }
}

export async function addEquipeToObra(obraId: string, equipeId: string) {
  try {
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { error } = await supabase.from('obra_equipes').insert({
      cliente_id: context.clienteId,
      obra_id: obraId,
      equipe_id: equipeId,
    });
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao vincular equipe.' };
  }
}

export async function removeEquipeFromObra(obraId: string, equipeId: string) {
  try {
    const context = await requireObra(obraId);
    const supabase = await createClient();
    const { error } = await supabase.from('obra_equipes').delete()
      .eq('obra_id', obraId).eq('equipe_id', equipeId).eq('cliente_id', context.clienteId);
    if (error) throw error;
    revalidatePath(`/obras/${obraId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao remover equipe.' };
  }
}

export async function addFvsToAmbiente(
  obraId: string,
  ambId: string,
  selectedFvsIds: string[],
  fvsPadraoList: { id: string; nome: string; revisao_atual: number }[],
) {
  try {
    const context = await requireObra(obraId);
    if (!selectedFvsIds.length) return { success: true };
    const allowedIds = new Set(fvsPadraoList.map(item => item.id));
    if (selectedFvsIds.some(id => !allowedIds.has(id))) throw new Error('FVS fora do escopo desta empresa.');
    const supabase = await createClient();
    const { data: ambiente } = await supabase.from('ambientes').select('id').eq('id', ambId).eq('obra_id', obraId).maybeSingle();
    if (!ambiente) throw new Error('Ambiente fora do escopo da obra.');
    const { error } = await supabase.from('fvs_planejadas').insert(selectedFvsIds.map(fvsId => {
      const padrao = fvsPadraoList.find(item => item.id === fvsId);
      return {
        cliente_id: context.clienteId,
        ambiente_id: ambId,
        fvs_padrao_id: fvsId,
        subservico: padrao?.nome ?? 'Serviço Padrão',
        revisao_associada: padrao?.revisao_atual ?? 1,
        status: 'pendente' as const,
      };
    }));
    if (error) throw error;
    revalidatePath(`/obras/${obraId}/ambiente/${ambId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao associar FVS.' };
  }
}
