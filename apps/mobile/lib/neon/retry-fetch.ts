// Mesma correção do painel web (apps/web/lib/neon/retry-fetch.ts). A Data API do Neon mantém um pool de
// conexões, e a PRIMEIRA consulta de cada conexão nova chega ao banco sem o JWT. current_usuario_id()
// transforma isso em HTTP 401 `jwt_ausente` em vez de a RLS devolver uma lista vazia; aqui a requisição é
// repetida e cai numa conexão já aquecida. Nada foi gravado na tentativa que falhou. Ver neon/baseline/README.md.
const MAX_RETRIES = 8;
const backoff = (attempt: number) => Math.min(150 * 2 ** attempt, 2000);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function createRetryFetch(): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(input, init);
      if (response.status !== 401 || attempt >= MAX_RETRIES) return response;
      // 401 por token inválido/expirado tem outra mensagem e não deve ser repetido
      const body = await response.clone().text();
      if (!body.includes('jwt_ausente')) return response;
      await sleep(backoff(attempt));
    }
  };
}
