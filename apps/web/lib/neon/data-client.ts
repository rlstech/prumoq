import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createRetryFetch } from './retry-fetch';

// Template JWT criado no Clerk: acrescenta `role: authenticated`, sem o qual a Data API
// trata o token como `anonymous`.
export const NEON_TOKEN_TEMPLATE = 'neon';

function dataApiUrl(): string {
  // Base SEM /rest/v1 (o supabase-js acrescenta). Ex.: https://ep-xxx.apirest.c-2.sa-east-1.aws.neon.tech/neondb
  const url = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim().replace(/\/+$/, '');
  if (!url) throw new Error('NEXT_PUBLIC_NEON_DATA_API_URL não configurada.');
  return url;
}

function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

// O token do template dura 60 s e cada emissão custa uma ida ao Clerk: reaproveita até faltar 10 s.
export function memoizeToken(fetchToken: () => Promise<string | null | undefined>): () => Promise<string | null> {
  let current: { token: string; exp: number } | null = null;
  return async () => {
    const now = Date.now() / 1000;
    if (current && current.exp - now > 10) return current.token;
    let token: string | null | undefined;
    try {
      token = await fetchToken();
    } catch {
      // Sessão encerrada no Clerk (logout, troca de senha) enquanto o cookie ainda vale alguns segundos:
      // "Session not found". Trata como deslogado; a Data API responde 401 e a tela manda para o login.
      return null;
    }
    if (!token) return null;
    current = { token, exp: jwtExpiry(token) };
    return token;
  };
}

// Mesma API do supabase-js (from/rpc/select/embeds); só a autenticação mudou. Atenção: com `accessToken`,
// `client.auth.*` lança erro de propósito. Identidade vem do Clerk.
export function createDataClient(getToken: () => Promise<string | null>): SupabaseClient<Database> {
  const url = dataApiUrl();
  return createSupabaseClient<Database>(url, 'neon-data-api', {
    accessToken: getToken,
    global: { fetch: createRetryFetch() },
  }) as unknown as SupabaseClient<Database>;
}
