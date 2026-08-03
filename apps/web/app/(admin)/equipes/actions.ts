'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';

export type EquipeFormData = {
  nome: string;
  tipo: string;
  especialidade: string;
  responsavel: string;
  telefone: string;
  cnpj_terceiro: string;
  escopo?: 'global' | 'restrito';
  empresaIds?: string[];
};

async function replaceScope(
  equipeId: string,
  clienteId: string,
  formData: EquipeFormData,
): Promise<void> {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from('equipe_empresas')
    .delete()
    .eq('equipe_id', equipeId)
    .eq('cliente_id', clienteId);
  if (deleteError) throw deleteError;

  if (formData.escopo === 'restrito' && formData.empresaIds?.length) {
    const { error } = await supabase.from('equipe_empresas').insert(
      formData.empresaIds.map(empresa_id => ({
        equipe_id: equipeId,
        empresa_id,
        cliente_id: clienteId,
      })),
    );
    if (error) throw error;
  }
}

export async function createEquipe(formData: EquipeFormData) {
  try {
    const context = await requireTenantRole(['admin', 'gestor']);
    if (formData.escopo === 'restrito' && !formData.empresaIds?.length) {
      throw new Error('Selecione ao menos uma empresa para o escopo restrito.');
    }
    const supabase = await createClient();
    const { data, error } = await supabase.from('equipes').insert({
      nome: formData.nome.trim(),
      tipo: formData.tipo as 'proprio' | 'terceirizado',
      especialidade: formData.especialidade || null,
      responsavel: formData.responsavel || null,
      telefone: formData.telefone || null,
      cnpj_terceiro: formData.tipo === 'terceirizado' ? formData.cnpj_terceiro || null : null,
      cliente_id: context.clienteId,
      escopo: formData.escopo ?? 'global',
      ativo: true,
    }).select().single();
    if (error) throw error;
    await replaceScope(data.id, context.clienteId, formData);
    revalidatePath('/equipes');
    return { success: true, data: { ...data, equipe_empresas: (formData.empresaIds ?? []).map(empresa_id => ({ empresa_id })) } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar equipe.' };
  }
}

export async function updateEquipe(id: string, formData: EquipeFormData) {
  try {
    const context = await requireTenantRole(['admin', 'gestor']);
    if (formData.escopo === 'restrito' && !formData.empresaIds?.length) {
      throw new Error('Selecione ao menos uma empresa para o escopo restrito.');
    }
    const supabase = await createClient();
    const { data, error } = await supabase.from('equipes').update({
      nome: formData.nome.trim(),
      tipo: formData.tipo as 'proprio' | 'terceirizado',
      especialidade: formData.especialidade || null,
      responsavel: formData.responsavel || null,
      telefone: formData.telefone || null,
      cnpj_terceiro: formData.tipo === 'terceirizado' ? formData.cnpj_terceiro || null : null,
      escopo: formData.escopo ?? 'global',
    }).eq('id', id).eq('cliente_id', context.clienteId).select().single();
    if (error) throw error;
    await replaceScope(id, context.clienteId, formData);
    revalidatePath('/equipes');
    return { success: true, data: { ...data, equipe_empresas: (formData.empresaIds ?? []).map(empresa_id => ({ empresa_id })) } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar equipe.' };
  }
}
