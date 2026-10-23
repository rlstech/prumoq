import { NEON_TOKEN_TEMPLATE, obterToken } from './auth/clerk';

// Cliente da rota de mídia do Worker do PWA (worker/index.ts). Em produção o Worker serve o próprio PWA,
// então a rota é relativa; em desenvolvimento o PWA (Expo, :8081) chama o `wrangler dev` (:8787).
function endpoint(): string {
  const base = process.env.EXPO_PUBLIC_MEDIA_API_URL?.trim().replace(/\/+$/, '') ?? '';
  return `${base}/api/media/presign`;
}

export class ErroMidiaApi extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ErroMidiaApi';
  }
}

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const token = await obterToken(NEON_TOKEN_TEMPLATE);
  if (!token) throw new Error('Sem sessão para enviar as gravações');
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // O texto "failed <status>" é o que sync-failure.ts usa para classificar (4xx definitivo, 5xx/401 transitório).
    throw new ErroMidiaApi(response.status, `Presign failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function assinarUpload(info: { filename: string; contentType: string; contentLength: number }) {
  return chamar<{ uploadUrl: string; key: string }>({ operation: 'upload', ...info });
}

/** Links temporários (15 min) de leitura. O Worker aceita até 100 chaves por chamada. */
export async function assinarDownloads(keys: string[]): Promise<Record<string, string>> {
  const unicas = [...new Set(keys)];
  const lotes: string[][] = [];
  for (let i = 0; i < unicas.length; i += 100) lotes.push(unicas.slice(i, i + 100));
  const respostas = await Promise.all(lotes.map(lote =>
    chamar<{ urls: Record<string, string> }>({ operation: 'download', keys: lote })));
  return Object.assign({}, ...respostas.map(r => r.urls ?? {}));
}
