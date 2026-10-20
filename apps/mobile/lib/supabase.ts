// O nome do arquivo é histórico: este cliente fala com a Data API do Neon (PostgREST, mesma API do
// supabase-js) usando o token do Clerk. Só funciona online; a leitura e a gravação normais do app passam
// pelo banco local do PowerSync. Com `accessToken`, `supabase.auth.*` lança erro de propósito: a identidade
// vem de lib/auth/sessao.tsx.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { NEON_TOKEN_TEMPLATE, obterToken } from './auth/clerk';
import { createRetryFetch } from './neon/retry-fetch';

function dataApiUrl(): string {
  // Base SEM /rest/v1 (o supabase-js acrescenta).
  const url = process.env.EXPO_PUBLIC_NEON_DATA_API_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  if (!url) throw new Error('EXPO_PUBLIC_NEON_DATA_API_URL não configurada.');
  return url;
}

export const supabase = createClient<Database>(dataApiUrl(), 'neon-data-api', {
  accessToken: () => obterToken(NEON_TOKEN_TEMPLATE),
  global: { fetch: createRetryFetch() },
});
