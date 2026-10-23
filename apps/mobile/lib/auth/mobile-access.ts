import { supabase } from '../supabase';
import type { ContaLocal, PerfilApp } from './conta-local';

const PERFIS_DO_APP: readonly string[] = ['inspetor', 'admin', 'gestor'];

export type ResultadoPerfil =
  | { ok: true; conta: ContaLocal }
  | { ok: false; motivo: 'acesso'; mensagem: string }
  | { ok: false; motivo: 'rede'; mensagem: string };

const SEM_CONEXAO = 'Não foi possível confirmar o seu acesso agora. Verifique a conexão e tente novamente.';

/**
 * Lê online o perfil do usuário autenticado no Clerk e decide se ele pode usar o app (RN-06: inspetor,
 * admin e gestor; usuário e cliente ativos). Exige sessão do Clerk ativa: a consulta usa o token `neon`.
 */
export async function buscarPerfilOnline(clerkUserId: string, email: string | null): Promise<ResultadoPerfil> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nome, perfil, ativo, cliente_id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (error) return { ok: false, motivo: 'rede', mensagem: SEM_CONEXAO };

  const perfil = usuario as { id: string; nome: string; perfil: string; ativo: boolean; cliente_id: string | null } | null;
  if (!perfil || !perfil.ativo) {
    return { ok: false, motivo: 'acesso', mensagem: 'Usuário inativo ou sem perfil no PrumoQ.' };
  }
  if (!PERFIS_DO_APP.includes(perfil.perfil)) {
    return { ok: false, motivo: 'acesso', mensagem: 'Perfil sem acesso ao aplicativo.' };
  }
  if (!perfil.cliente_id) {
    return { ok: false, motivo: 'acesso', mensagem: 'Usuário sem cliente associado.' };
  }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('status')
    .eq('id', perfil.cliente_id)
    .maybeSingle();
  if (clienteError) return { ok: false, motivo: 'rede', mensagem: SEM_CONEXAO };
  if ((cliente as { status: string } | null)?.status !== 'ativo') {
    return { ok: false, motivo: 'acesso', mensagem: 'O ambiente deste cliente está suspenso.' };
  }

  return {
    ok: true,
    conta: {
      clerkUserId,
      usuarioId: perfil.id,
      clienteId: perfil.cliente_id,
      perfil: perfil.perfil as PerfilApp,
      nome: perfil.nome,
      email,
      salvaEm: new Date().toISOString(),
    },
  };
}
