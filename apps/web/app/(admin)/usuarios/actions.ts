'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getConfiguredPwaOrigin, minimumPasswordSchema } from '@/lib/auth/passwords';
import { requireTenantRole } from '@/lib/auth/context';

type UsuarioInput = {
  nome: string;
  email: string;
  senha?: string;
  cargo?: string;
  perfil: 'admin' | 'gestor' | 'inspetor';
  obras?: string[];
};

async function validateObras(clienteId: string, obraIds: string[]): Promise<void> {
  if (!obraIds.length) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from('obras').select('id').eq('cliente_id', clienteId).in('id', obraIds);
  if (error || data?.length !== new Set(obraIds).size) throw new Error('Uma ou mais obras estão fora do cliente.');
}

async function replaceObras(usuarioId: string, clienteId: string, perfil: UsuarioInput['perfil'], obraIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from('obra_usuarios').delete().eq('usuario_id', usuarioId).eq('cliente_id', clienteId);
  if (deleteError) throw deleteError;
  if (perfil !== 'admin' && obraIds.length) {
    const { error } = await supabase.from('obra_usuarios').insert(obraIds.map(obra_id => ({
      cliente_id: clienteId,
      usuario_id: usuarioId,
      obra_id,
      papel: perfil,
      ativo: true,
    })));
    if (error) throw error;
  }
}

export async function createUsuario(data: UsuarioInput) {
  let createdId: string | null = null;
  try {
    const context = await requireTenantRole(['admin']);
    const password = minimumPasswordSchema.parse(data.senha);
    const obraIds = data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? []));
    await validateObras(context.clienteId, obraIds);
    const admin = createAdminClient();
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nome: data.nome.trim() },
    });
    if (authError) throw authError;
    createdId = authUser.user.id;

    const supabase = await createClient();
    const { error: profileError } = await supabase.from('usuarios').insert({
      id: authUser.user.id,
      cliente_id: context.clienteId,
      nome: data.nome.trim(),
      cargo: data.cargo?.trim() || null,
      perfil: data.perfil,
      ativo: true,
    });
    if (profileError) throw profileError;
    await replaceObras(authUser.user.id, context.clienteId, data.perfil, obraIds);
    revalidatePath('/usuarios');
    return { success: true };
  } catch (error) {
    if (createdId) await createAdminClient().auth.admin.deleteUser(createdId);
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao criar usuário.' };
  }
}

export async function sendPasswordRecovery(usuarioId: string) {
  try {
    const context = await requireTenantRole(['admin']);
    const supabase = await createClient();
    const { data: target } = await supabase.from('usuarios').select('id, ativo').eq('id', usuarioId).eq('cliente_id', context.clienteId).maybeSingle();
    if (!target?.ativo) throw new Error('Usuário ativo não encontrado neste cliente.');
    const admin = createAdminClient();
    const { data: authUser, error } = await admin.auth.admin.getUserById(usuarioId);
    if (error || !authUser.user?.email) throw new Error('E-mail de autenticação não encontrado.');
    const { error: resetError } = await admin.auth.resetPasswordForEmail(authUser.user.email, {
      redirectTo: `${getConfiguredPwaOrigin()}/redefinir-senha`,
    });
    if (resetError) throw resetError;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao enviar recuperação.' };
  }
}

export async function updateUsuario(id: string, data: UsuarioInput) {
  try {
    const context = await requireTenantRole(['admin']);
    const obraIds = data.perfil === 'admin' ? [] : Array.from(new Set(data.obras ?? []));
    await validateObras(context.clienteId, obraIds);
    const supabase = await createClient();
    const { data: target } = await supabase.from('usuarios').select('id').eq('id', id).eq('cliente_id', context.clienteId).maybeSingle();
    if (!target) throw new Error('Usuário fora do escopo deste cliente.');

    const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, {
      email: data.email.trim().toLowerCase(),
      user_metadata: { nome: data.nome.trim() },
    });
    if (authError) throw authError;
    const { error } = await supabase.from('usuarios').update({
      nome: data.nome.trim(), cargo: data.cargo?.trim() || null, perfil: data.perfil,
    }).eq('id', id).eq('cliente_id', context.clienteId);
    if (error) throw error;
    await replaceObras(id, context.clienteId, data.perfil, obraIds);
    revalidatePath('/usuarios');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar usuário.' };
  }
}
