import type { PerfilUsuario, StatusCliente } from '@prumoq/shared';
import { currentClerkUserId } from '@/lib/auth/clerk-browser';
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

// Perfil do usuário logado, lido do banco com o token dele. Fica em memória por alguns segundos para que o
// layout e a página da mesma navegação não repitam a consulta; trocar de usuário no Clerk invalida.
// Estas checagens são de interface (para onde mandar, o que mostrar): quem autoriza de fato é a RLS do banco.
// `userId` é o UUID interno de `usuarios`, não o id do Clerk (que fica em `clerkUserId`).
const CONTEXT_TTL_MS = 15_000;
let cached: { clerkUserId: string; expiresAt: number; value: Promise<AuthContext | null> } | null = null;

export function clearAuthContext(): void {
  cached = null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const clerkUserId = await currentClerkUserId();
  if (!clerkUserId) return null;
  if (cached && cached.clerkUserId === clerkUserId && cached.expiresAt > Date.now()) return cached.value;
  const value = loadAuthContext(clerkUserId);
  cached = { clerkUserId, expiresAt: Date.now() + CONTEXT_TTL_MS, value };
  // falha (rede, Data API) não fica em cache
  value.catch(() => { if (cached?.value === value) cached = null; });
  return value;
}

async function loadAuthContext(clerkUserId: string): Promise<AuthContext | null> {
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
