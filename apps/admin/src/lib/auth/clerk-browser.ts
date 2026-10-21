// Acesso ao Clerk carregado pelo <ClerkProvider> (window.Clerk), para código fora de componentes:
// cliente de dados, contexto de autenticação e chamadas à API do Worker.
type ClerkBrowser = {
  loaded?: boolean;
  user?: { id: string } | null;
  session?: { getToken(options?: { template?: string }): Promise<string | null> } | null;
};

const CLERK_LOAD_TIMEOUT_MS = 10_000;

// O clerk-js carrega depois da primeira renderização: consultas feitas ao montar a tela sairiam sem token
// (a Data API responderia 400). Espera o Clerk ficar pronto antes de pedir o token.
export async function loadedClerk(): Promise<ClerkBrowser | undefined> {
  const started = Date.now();
  for (;;) {
    const clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
    if (clerk?.loaded || Date.now() - started > CLERK_LOAD_TIMEOUT_MS) return clerk;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/** Id do usuário no Clerk (não é o id de `usuarios`). */
export async function currentClerkUserId(): Promise<string | null> {
  return (await loadedClerk())?.user?.id ?? null;
}

export async function getClerkToken(template?: string): Promise<string | null> {
  const clerk = await loadedClerk();
  return (await clerk?.session?.getToken(template ? { template } : undefined)) ?? null;
}
