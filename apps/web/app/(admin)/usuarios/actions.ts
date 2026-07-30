'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getConfiguredPwaOrigin, minimumPasswordSchema } from '@/lib/auth/passwords';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createUsuario(data: any) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Usuário autenticado não encontrado');

    const { data: currentUserData } = await supabaseAdmin
      .from('usuarios')
      .select('empresa_id, perfil')
      .eq('id', user.id)
      .single();

    if (currentUserData?.perfil !== 'admin' && currentUserData?.perfil !== 'gestor') {
      throw new Error('Sem permissão para criar usuários');
    }

    const passwordValidation = minimumPasswordSchema.safeParse(data.senha);
    if (!passwordValidation.success) {
      throw new Error(passwordValidation.error.issues[0]?.message ?? 'Senha inválida');
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome }
    });

    if (authError) throw authError;

    const { error: userError } = await supabaseAdmin.from('usuarios').insert({
      id: authUser.user.id,
      nome: data.nome,
      cargo: data.cargo,
      perfil: data.perfil,
      ativo: true,
      empresa_id: currentUserData?.empresa_id
    });

    if (userError) {
      // rollback auth user creation if inserting into public.usuarios fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw userError;
    }

    if (data.obras && data.obras.length > 0) {
      const obrasInsert = data.obras.map((obra_id: string) => ({
         usuario_id: authUser.user.id,
         obra_id: obra_id,
      }));
      await supabaseAdmin.from('obra_usuarios').insert(obrasInsert);
    }

    revalidatePath('/usuarios');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendPasswordRecovery(usuarioId: string) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const { data: actor, error: actorError } = await supabaseAdmin
      .from('usuarios')
      .select('empresa_id, perfil')
      .eq('id', user.id)
      .single();
    if (actorError || !actor) throw new Error('Não foi possível validar suas permissões');
    if (actor.perfil !== 'admin' && actor.perfil !== 'gestor') {
      throw new Error('Sem permissão para recuperar senhas de usuários');
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('usuarios')
      .select('empresa_id, ativo')
      .eq('id', usuarioId)
      .single();
    if (targetError || !target || !target.ativo) {
      throw new Error('Usuário ativo não encontrado');
    }
    if (!actor.empresa_id || target.empresa_id !== actor.empresa_id) {
      throw new Error('Usuário fora do escopo da sua empresa');
    }

    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(usuarioId);
    const targetEmail = authUser.user?.email;
    if (authUserError || !targetEmail) {
      throw new Error('E-mail de autenticação não encontrado');
    }

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      targetEmail,
      { redirectTo: `${getConfiguredPwaOrigin()}/redefinir-senha` },
    );
    if (resetError) throw resetError;

    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível enviar a recuperação',
    };
  }
}

export async function updateUsuario(id: string, data: any) {
  try {
     const supabase = await createServerSupabase();
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) throw new Error('Não autenticado');

     const { data: authUpdate, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: data.email,
        user_metadata: { nome: data.nome }
     });

     if (authError) throw authError;

     const { error: updatedUserError } = await supabaseAdmin.from('usuarios').update({
        nome: data.nome,
        cargo: data.cargo,
        perfil: data.perfil
     }).eq('id', id);

     if (updatedUserError) throw updatedUserError;

     // Manage obras_acesso (delete existing, insert new if not admin)
     if (data.perfil !== 'admin') {
         await supabaseAdmin.from('obra_usuarios').delete().eq('usuario_id', id);
         
         if (data.obras && data.obras.length > 0) {
            const obrasInsert = data.obras.map((obra_id: string) => ({
               usuario_id: id,
               obra_id: obra_id,
            }));
            await supabaseAdmin.from('obra_usuarios').insert(obrasInsert);
         }
     }

     revalidatePath('/usuarios');
     return { success: true };
  } catch (error: any) {
     return { success: false, error: error.message };
  }
}
