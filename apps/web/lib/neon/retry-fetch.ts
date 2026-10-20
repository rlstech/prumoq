// A Data API do Neon mantém um pool de conexões, e a PRIMEIRA consulta de cada conexão nova chega ao banco sem
// o JWT (acontece depois de ~5 min parado e também em rajadas que abrem conexões novas: medido 14 de 40 chamadas
// simultâneas). current_usuario_id() transforma essa situação em HTTP 401 `jwt_ausente` em vez de deixar a RLS
// devolver uma lista vazia. Aqui a requisição é simplesmente repetida; a nova tentativa cai numa conexão
// aquecida. Nada foi gravado na tentativa que falhou: o erro ocorre ao avaliar a RLS, antes de qualquer efeito.
// Ver neon/baseline/README.md.

// Medido: depois de ociosa, a primeira requisição chegou a precisar de mais de 2 s (6 tentativas com 100 ms
// crescentes esgotaram). Espera exponencial limitada a 2 s, no máximo ~10 s; no caso comum resolve na 1ª ou 2ª.
const MAX_RETRIES = 8;
const backoff = (attempt: number) => Math.min(150 * 2 ** attempt, 2000);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function createRetryFetch(): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      // Hipótese em teste: o keep-alive devolve a mesma conexão HTTP (e, por trás, a mesma conexão ruim do pool).
      // A partir da 3ª tentativa pede conexão nova (na 2ª piora as rajadas: conexão nova também nasce fria).
      let attemptInit = init;
      if (attempt >= 2) {
        const headers = new Headers(init?.headers);
        headers.set('Connection', 'close');
        attemptInit = { ...init, headers };
      }
      const response = await fetch(input, attemptInit);
      if (response.status !== 401 || attempt >= MAX_RETRIES) {
        if (attempt > 0 && process.env.NEON_RETRY_DEBUG) console.warn(`[neon-retry] resolvido na tentativa ${attempt + 1} (HTTP ${response.status})`);
        return response;
      }
      // 401 por token inválido/expirado tem outra mensagem e não deve ser repetido.
      // HEAD (contagens com `head: true`) não traz corpo: não dá para distinguir, então repete.
      const isHead = (init?.method ?? 'GET').toUpperCase() === 'HEAD';
      const body = isHead ? '' : await response.clone().text();
      if (!isHead && !body.includes('jwt_ausente')) return response;
      if (process.env.NEON_RETRY_DEBUG) {
        // só metadados do token (nunca o valor): ajuda a distinguir token ruim de conexão sem claims
        const auth = new Headers(init?.headers).get('Authorization') ?? '';
        let claims = 'sem-token';
        try {
          const p = JSON.parse(atob(auth.replace(/^Bearer /, '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string; exp?: number; sub?: string };
          claims = `role=${p.role ?? '(ausente)'} expira_em=${p.exp ? Math.round(p.exp - Date.now() / 1000) : '?'}s sub=${(p.sub ?? '').slice(0, 9)}`;
        } catch { claims = auth ? `token-nao-jwt(${auth.slice(0, 12)}...)` : 'sem-token'; }
        const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname.split('/rest/v1')[1];
        console.warn(`[neon-retry] ${init?.method ?? 'GET'} ${path} tentativa ${attempt + 1}/${MAX_RETRIES} | ${claims}`);
      }
      await sleep(backoff(attempt));
    }
  };
}
