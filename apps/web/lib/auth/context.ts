import type { PerfilUsuario, StatusCliente } from '@prumoq/shared';
import { createClient } from '@/lib/supabase/server';

export interface AuthContext {
  userId: string;
  email: string | null;
  nome: string;
  perfil: PerfilUsuario;
  clienteId: string | null;
  clienteNome: string | null;
  clienteStatus: StatusCliente | null;
}

export class AuthorizationError extends Error {
  constructor(message = 'Sem permissão para realizar esta operação.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from('usuarios')
    .select('nome, perfil, cliente_id, ativo')
    .eq('id', user.id)
    .single();
  const profile = profileData as {
    nome: string;
    perfil: PerfilUsuario;
    cliente_id: string | null;
    ativo: boolean;
  } | null;
  if (!profile?.ativo) return null;

  if (profile.perfil === 'superadmin') {
    return {
      userId: user.id,
      email: user.email ?? null,
      nome: profile.nome,
      perfil: profile.perfil,
      clienteId: null,
      clienteNome: null,
      clienteStatus: null,
    };
  }

  if (!profile.cliente_id) return null;
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('nome, status')
    .eq('id', profile.cliente_id)
    .single();
  const cliente = clienteData as { nome: string; status: StatusCliente } | null;
  if (!cliente) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    nome: profile.nome,
    perfil: profile.perfil,
    clienteId: profile.cliente_id,
    clienteNome: cliente.nome,
    clienteStatus: cliente.status,
  };
}

export async function requirePlatformAdmin(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context || context.perfil !== 'superadmin') {
    throw new AuthorizationError('Acesso restrito à administração da plataforma.');
  }
  return context;
}

export async function requireTenantRole(
  roles: Array<'admin' | 'gestor' | 'inspetor'>,
): Promise<AuthContext & { clienteId: string }> {
  const context = await getAuthContext();
  if (
    !context ||
    !context.clienteId ||
    context.clienteStatus !== 'ativo' ||
    !roles.includes(context.perfil as 'admin' | 'gestor' | 'inspetor')
  ) {
    throw new AuthorizationError();
  }
  return context as AuthContext & { clienteId: string };
}

export async function assertObraInTenant(
  obraId: string,
  clienteId: string,
): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('obras')
    .select('id')
    .eq('id', obraId)
    .eq('cliente_id', clienteId)
    .maybeSingle();
  if (!data) throw new AuthorizationError('Obra fora do escopo do cliente.');
}
