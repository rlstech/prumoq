// O nome do caminho (lib/supabase) é histórico: o banco agora é o Neon (Data API) e a identidade vem do Clerk.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@prumoq/shared';
import { createDataClient, memoizeToken, NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';

type ClerkBrowser = {
  loaded?: boolean;
  session?: { getToken(options: { template: string }): Promise<string | null> } | null;
};

let browserClient: SupabaseClient<Database> | null = null;

const CLERK_LOAD_TIMEOUT_MS = 10_000;

// O clerk-js carrega depois da hidratação: consultas feitas ao montar a tela (ex.: contador da Sidebar)
// sairiam sem token e a Data API responderia 400. Espera o Clerk ficar pronto antes de pedir o token.
async function loadedClerk(): Promise<ClerkBrowser | undefined> {
  const started = Date.now();
  for (;;) {
    const clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
    if (clerk?.loaded || Date.now() - started > CLERK_LOAD_TIMEOUT_MS) return clerk;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  browserClient = createDataClient(
    memoizeToken(async () => {
      const clerk = await loadedClerk();
      return (await clerk?.session?.getToken({ template: NEON_TOKEN_TEMPLATE })) ?? null;
    }),
  );
  return browserClient;
}
