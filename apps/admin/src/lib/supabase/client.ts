// O nome do caminho (lib/supabase) é histórico: o banco é o Neon (Data API) e a identidade vem do Clerk.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createDataClient, memoizeToken, NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';
import { getClerkToken } from '@/lib/auth/clerk-browser';

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  browserClient ??= createDataClient(memoizeToken(() => getClerkToken(NEON_TOKEN_TEMPLATE)));
  return browserClient;
}
