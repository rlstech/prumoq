'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireTenantRole } from '@/lib/auth/context';

interface ObraFormData {
  nome: string;
  empresa_id: string;
  status: string;
  municipio: string;
  uf: string;
  endereco: string;
  eng_responsavel: string;
  crea_cau: string;
  data_inicio_prev: string | null;
  data_termino_prev: string | null;
}

async function assertEmpresa(clienteId: string, empresaId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from('empresas').select('id').eq('id', empresaId).eq('cliente_id', clienteId).eq('ativo', true).maybeSingle();
  if (!data) throw new Error('Empresa fora do escopo deste cliente.');
}

export async function createObra(formData: ObraFormData) {
  try {
    const context = await requireTenantRole(['admin']);
    await assertEmpresa(context.clienteId, formData.empresa_id);
    const supabase = await createClient();
    const { error } = await supabase.from('obras').insert({
      cliente_id: context.clienteId,
      nome: formData.nome.trim(),
      empresa_id: formData.empresa_id,
      status: formData.status as 'nao_iniciada' | 'em_andamento' | 'paralisada' | 'concluida',
      municipio: formData.municipio || null,
      uf: formData.uf || null,
      endereco: formData.endereco || null,
      eng_responsavel: formData.eng_responsavel,
      crea_cau: formData.crea_cau,
      data_inicio_prev: formData.data_inicio_prev || null,
      data_termino_prev: formData.data_termino_prev || null,
      ativo: true,
    });
    if (error) throw error;
    revalidatePath('/obras');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar obra.' };
  }
}

export async function updateObra(id: string, formData: ObraFormData) {
  try {
    const context = await requireTenantRole(['admin']);
    await assertEmpresa(context.clienteId, formData.empresa_id);
    const supabase = await createClient();
    const { error } = await supabase.from('obras').update({
      nome: formData.nome.trim(),
      empresa_id: formData.empresa_id,
      status: formData.status as 'nao_iniciada' | 'em_andamento' | 'paralisada' | 'concluida',
      municipio: formData.municipio || null,
      uf: formData.uf || null,
      endereco: formData.endereco || null,
      eng_responsavel: formData.eng_responsavel,
      crea_cau: formData.crea_cau,
      data_inicio_prev: formData.data_inicio_prev || null,
      data_termino_prev: formData.data_termino_prev || null,
    }).eq('id', id).eq('cliente_id', context.clienteId);
    if (error) throw error;
    revalidatePath('/obras');
    revalidatePath(`/obras/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar obra.' };
  }
}
