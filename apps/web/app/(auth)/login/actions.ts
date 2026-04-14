'use server';

import { createClient } from '@/lib/supabase/server';

export async function loginAction(prevState: any, formData: FormData) {
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
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', data.user.id)
      .single<{ perfil: string }>();

    if (usuario?.perfil === 'inspetor') {
      await supabase.auth.signOut();
      return { error: 'Acesso restrito. Use o aplicativo móvel.' };
    }
  }

  return { success: true };
}
