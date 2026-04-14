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

  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('empresa_id, perfil')
    .eq('id', user.id)
    .single();

  if (!data) throw new Error('Usuário não encontrado');
  if (data.perfil !== 'admin' && data.perfil !== 'gestor') {
    throw new Error('Sem permissão para gerenciar equipes');
  }

  return { userId: user.id, empresaId: data.empresa_id as string };
}

export async function createEquipe(formData: {
  nome: string;
  tipo: string;
  especialidade: string;
  responsavel: string;
  telefone: string;
  cnpj_terceiro: string;
}) {
  try {
    const { empresaId } = await getAuthenticatedUser();

    const { data, error } = await supabaseAdmin
      .from('equipes')
      .insert({
        nome: formData.nome,
        tipo: formData.tipo,
        especialidade: formData.especialidade || null,
        responsavel: formData.responsavel || null,
        telefone: formData.telefone || null,
        cnpj_terceiro: formData.tipo === 'terceirizado' ? formData.cnpj_terceiro || null : null,
        empresa_id: empresaId,
        ativo: true,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/equipes');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateEquipe(
  id: string,
  formData: {
    nome: string;
    tipo: string;
    especialidade: string;
    responsavel: string;
    telefone: string;
    cnpj_terceiro: string;
  }
) {
  try {
    await getAuthenticatedUser();

    const { data, error } = await supabaseAdmin
      .from('equipes')
      .update({
        nome: formData.nome,
        tipo: formData.tipo,
        especialidade: formData.especialidade || null,
        responsavel: formData.responsavel || null,
        telefone: formData.telefone || null,
        cnpj_terceiro: formData.tipo === 'terceirizado' ? formData.cnpj_terceiro || null : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/equipes');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
