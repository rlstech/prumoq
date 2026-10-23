import { Clerk } from '@clerk/clerk-js/headless';

// Clerk sem componentes visuais, empacotado junto com o app (sem script externo): as telas de login são
// nossas. A sessão do Clerk só é necessária online, para obter tokens. Offline o app abre com a conta
// salva no aparelho (ver lib/auth/sessao.tsx).

export const NEON_TOKEN_TEMPLATE = 'neon';
export const POWERSYNC_TOKEN_TEMPLATE = 'powersync';

export type ClerkInstance = InstanceType<typeof Clerk>;

let instancia: ClerkInstance | null = null;
let carregando: Promise<ClerkInstance> | null = null;

function publishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!key) throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY não configurada.');
  return key;
}

/**
 * Carrega o Clerk. Sem internet, o carregamento falha (ou fica "degraded", sem dados do servidor);
 * nesse caso a promessa é rejeitada e uma chamada seguinte tenta de novo com uma instância nova.
 */
export function carregarClerk(): Promise<ClerkInstance> {
  if (instancia) return Promise.resolve(instancia);
  carregando ??= (async () => {
    const clerk = new Clerk(publishableKey());
    // Quem navega é o app (layout raiz). Sem isto, signOut() recarrega a página e interrompe o que vem
    // depois (ex.: um novo login logo em seguida).
    await clerk.load({ routerPush: () => undefined, routerReplace: () => undefined });
    if (clerk.status !== 'ready') throw new Error(`Clerk indisponível (${clerk.status})`);
    // Sem rede o Clerk ainda fica "ready" (usa a configuração guardada no navegador), mas sem o client do
    // servidor: "sem usuário" aí não quer dizer sessão encerrada. Só vale com o client confirmado online.
    if (!clerk.client?.id) throw new Error('Clerk sem conexão com o servidor');
    instancia = clerk;
    return clerk;
  })().finally(() => {
    carregando = null;
  });
  return carregando;
}

export function clerkCarregado(): ClerkInstance | null {
  return instancia;
}

/** Token de um template JWT do Clerk, ou null sem sessão/sem internet. */
export async function obterToken(template: string): Promise<string | null> {
  const session = instancia?.session;
  if (!session) return null;
  try {
    return (await session.getToken({ template })) ?? null;
  } catch {
    return null;
  }
}
