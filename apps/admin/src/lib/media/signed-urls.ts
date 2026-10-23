import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';
import { getClerkToken } from '@/lib/auth/clerk-browser';

// Links temporários (15 min) de leitura para fotos/assinaturas no R2. A assinatura acontece no Worker do PWA
// (`POST /api/media/presign`, apps/mobile/worker), com as mesmas checagens de antes: cliente ativo, chave no
// prefixo do cliente e `get_accessible_media_keys` com o token do próprio usuário (RLS por obra).
// `partial: true`: anexo sem autorização fica fora do mapa (a tela mostra "sem foto") em vez de derrubar a página.
const BATCH_SIZE = 100;

function endpoint(): string {
  const base = import.meta.env.VITE_MEDIA_API_URL?.trim().replace(/\/+$/, '') ?? '';
  return `${base}/api/media/presign`;
}

export async function signPrivateMedia(
  _client: SupabaseClient<Database>,
  input: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const keys = Array.from(new Set(input.filter((value): value is string =>
    Boolean(value) && !value!.startsWith('http') && !value!.startsWith('data:') &&
    !value!.startsWith('pending:') && !value!.startsWith('blob:'),
  )));
  if (!keys.length) return new Map();

  const token = await getClerkToken(NEON_TOKEN_TEMPLATE);
  if (!token) throw new Error('Falha ao autorizar anexos: usuário não autenticado.');

  const result = new Map<string, string>();
  for (let index = 0; index < keys.length; index += BATCH_SIZE) {
    const batch = keys.slice(index, index + BATCH_SIZE);
    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'download', keys: batch, partial: true }),
    });
    if (!response.ok) throw new Error(`Falha ao autorizar anexos (HTTP ${response.status}).`);
    const { urls } = await response.json() as { urls: Record<string, string> };
    for (const [key, url] of Object.entries(urls)) result.set(key, url);
  }
  const denied = keys.length - result.size;
  if (denied) console.warn(`[signPrivateMedia] ${denied} anexo(s) sem autorização ficaram sem link.`);
  return result;
}
