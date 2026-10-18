// O nome do caminho (lib/supabase) é histórico: o banco agora é o Neon (Data API) e a identidade vem do Clerk.
// Mantido para não alterar os imports das telas.
import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createDataClient, memoizeToken, NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';

export async function createClient(): Promise<SupabaseClient<Database>> {
  const { getToken } = await auth();
  return createDataClient(memoizeToken(() => getToken({ template: NEON_TOKEN_TEMPLATE })));
}
