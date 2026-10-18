import type { PerfilUsuario, StatusCliente } from '@prumoq/shared';
import { auth } from '@clerk/nextjs/server';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface AuthContext {
  userId: string;
  clerkUserId: string;
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

// React scopes this cache to the active server render. A layout and its page can
// therefore share a single verified user/profile lookup without weakening the
// request-level verification performed by Supabase and the middleware.
// `userId` é o UUID interno de `usuarios` (o mesmo valor que auth.users.id tinha no Supabase), não o id do
// Clerk: auditorias e FKs continuam apontando para ele. O id do Clerk fica em `clerkUserId`.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil, cliente_id, ativo')
    .eq('clerk_user_id', clerkUserId)
    .single();
  const profile = profileData as {
    id: string;
    nome: string;
    email: string | null;
    perfil: PerfilUsuario;
    cliente_id: string | null;
    ativo: boolean;
  } | null;
  if (!profile?.ativo) return null;

  if (profile.perfil === 'superadmin') {
    return {
      userId: profile.id,
      clerkUserId,
      email: profile.email,
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
    userId: profile.id,
    clerkUserId,
    email: profile.email,
    nome: profile.nome,
    perfil: profile.perfil,
    clienteId: profile.cliente_id,
    clienteNome: cliente.nome,
    clienteStatus: cliente.status,
  };
});

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
