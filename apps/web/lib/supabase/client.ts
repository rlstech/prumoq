// O nome do caminho (lib/supabase) é histórico: o banco agora é o Neon (Data API) e a identidade vem do Clerk.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createDataClient, memoizeToken, NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';

type ClerkBrowser = { session?: { getToken(options: { template: string }): Promise<string | null> } | null };

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  browserClient = createDataClient(
    memoizeToken(async () => {
      const clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
      return (await clerk?.session?.getToken({ template: NEON_TOKEN_TEMPLATE })) ?? null;
    }),
  );
  return browserClient;
}
