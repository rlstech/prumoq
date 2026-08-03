'use server';

import { createClient } from '@/lib/supabase/server';

export async function loginAction(_prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Preencha todos os campos.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  if (data.user) {
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('perfil, ativo, cliente_id')
      .eq('id', data.user.id)
      .single();
    const usuario = usuarioData as { perfil: 'superadmin' | 'admin' | 'gestor' | 'inspetor'; ativo: boolean; cliente_id: string | null } | null;

    if (!usuario?.ativo) {
      await supabase.auth.signOut();
      return { error: 'Usuário inativo. Fale com o administrador.' };
    }

    if (usuario.perfil === 'inspetor') {
      await supabase.auth.signOut();
      return { error: 'Acesso restrito. Use o aplicativo móvel.' };
    }

    if (usuario.perfil !== 'superadmin') {
      if (!usuario.cliente_id) {
        await supabase.auth.signOut();
        return { error: 'Conta sem cliente vinculado.' };
      }
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', usuario.cliente_id)
        .single();
      const cliente = clienteData as { status: 'ativo' | 'suspenso' } | null;
      if (cliente?.status !== 'ativo') {
        await supabase.auth.signOut();
        return { error: 'Ambiente suspenso. Fale com o suporte PrumoQ.' };
      }
    }

    if (usuario.perfil === 'admin') {
      await supabase.rpc('concluir_onboarding');
    }

    return {
      success: true,
      destination: usuario.perfil === 'superadmin' ? '/clientes' : '/dashboard',
    };
  }

  return { error: 'Perfil de acesso não encontrado.' };
}
