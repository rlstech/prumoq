// Cliente da API REST do Supabase (PostgREST) com o token do Clerk (Supabase "third-party auth"). Só funciona
// online; a leitura e a gravação normais do app passam pelo banco local do PowerSync. Com `accessToken`,
// `supabase.auth.*` lança erro de propósito: a identidade vem de lib/auth/sessao.tsx.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { NEON_TOKEN_TEMPLATE, obterToken } from './auth/clerk';
import { createRetryFetch } from './neon/retry-fetch';

function dataApiUrl(): string {
  // Ex.: https://xxxx.supabase.co (o supabase-js acrescenta /rest/v1).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  if (!url) throw new Error('EXPO_PUBLIC_SUPABASE_URL não configurada.');
  return url;
}

function publishableKey(): string {
  // Só identifica o projeto (header apikey); quem autoriza é o token do Clerk + RLS.
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key) throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY não configurada.');
  return key;
}

export const supabase = createClient<Database>(dataApiUrl(), publishableKey(), {
  accessToken: () => obterToken(NEON_TOKEN_TEMPLATE),
  global: { fetch: createRetryFetch() },
});
