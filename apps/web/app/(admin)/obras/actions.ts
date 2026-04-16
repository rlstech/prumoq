'use server';

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthenticatedUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  return user;
}

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

export async function createObra(formData: ObraFormData) {
  try {
    await getAuthenticatedUser();
    const { data, error } = await supabaseAdmin
      .from('obras')
      .insert({
        nome: formData.nome,
        empresa_id: formData.empresa_id,
        status: formData.status as any,
        municipio: formData.municipio || null,
        uf: formData.uf || null,
        endereco: formData.endereco || null,
        eng_responsavel: formData.eng_responsavel || null,
        crea_cau: formData.crea_cau || null,
        data_inicio_prev: formData.data_inicio_prev || null,
        data_termino_prev: formData.data_termino_prev || null,
        ativo: true,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/obras');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateObra(id: string, formData: ObraFormData) {
  try {
    await getAuthenticatedUser();
    const { error } = await supabaseAdmin
      .from('obras')
      .update({
        nome: formData.nome,
        empresa_id: formData.empresa_id,
        status: formData.status as any,
        municipio: formData.municipio || null,
        uf: formData.uf || null,
        endereco: formData.endereco || null,
        eng_responsavel: formData.eng_responsavel || null,
        crea_cau: formData.crea_cau || null,
        data_inicio_prev: formData.data_inicio_prev || null,
        data_termino_prev: formData.data_termino_prev || null,
      })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/obras');
    revalidatePath(`/obras/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
