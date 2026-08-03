import { supabase } from '../supabase';

export async function validateMobileAccess(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('usuarios')
    .select('cliente_id, perfil, ativo')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile || !profile.ativo) return 'Usuário inativo ou sem perfil no PrumoQ.';
  if (!['inspetor', 'admin', 'gestor'].includes(profile.perfil)) return 'Perfil sem acesso ao aplicativo.';
  if (!profile.cliente_id) return 'Usuário sem cliente associado.';

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('status')
    .eq('id', profile.cliente_id)
    .maybeSingle();
  if (clienteError || !cliente || cliente.status !== 'ativo') return 'O ambiente deste cliente está suspenso.';
  return null;
}
