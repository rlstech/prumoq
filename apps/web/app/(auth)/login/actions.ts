'use server';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export type VerificacaoAcesso =
  | { success: true; destination: string }
  | { success: false; error: string; motivo: 'inativo' | 'inspetor' | 'semcliente' | 'suspenso' | 'sessao' };

// Chamada pela tela de login logo depois que o Clerk autentica. O Clerk só prova QUEM é a pessoa;
// quem pode usar o painel (ativo, perfil, ambiente ativo) continua sendo decidido aqui, no banco.
// Em caso de recusa, o cliente encerra a sessão do Clerk (o servidor não consegue).
export async function verificarAcesso(): Promise<VerificacaoAcesso> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Sessão não encontrada. Tente novamente.', motivo: 'sessao' };

  const supabase = await createClient();
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('perfil, ativo, cliente_id')
    .eq('clerk_user_id', userId)
    .single();
  const usuario = usuarioData as { perfil: 'superadmin' | 'admin' | 'gestor' | 'inspetor'; ativo: boolean; cliente_id: string | null } | null;

  if (!usuario?.ativo) {
    return { success: false, error: 'Usuário inativo. Fale com o administrador.', motivo: 'inativo' };
  }

  if (usuario.perfil === 'inspetor') {
    return { success: false, error: 'Acesso restrito. Use o aplicativo móvel.', motivo: 'inspetor' };
  }

  if (usuario.perfil !== 'superadmin') {
    if (!usuario.cliente_id) {
      return { success: false, error: 'Conta sem cliente vinculado.', motivo: 'semcliente' };
    }
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('status')
      .eq('id', usuario.cliente_id)
      .single();
    const cliente = clienteData as { status: 'ativo' | 'suspenso' } | null;
    if (cliente?.status !== 'ativo') {
      return { success: false, error: 'Ambiente suspenso. Fale com o suporte PrumoQ.', motivo: 'suspenso' };
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
