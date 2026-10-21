/**
 * Worker do PWA. Serve os arquivos estáticos do `expo export` (Fase 7) e a rota de mídia:
 *
 *   POST /api/media/presign
 *     { operation: 'upload', filename, contentType, contentLength } -> { uploadUrl, key, expiresAt }
 *     { operation: 'download', keys: string[] }                      -> { urls, expiresAt }
 *
 * Substitui a Edge Function `r2-presign` do Supabase, com as mesmas checagens. A identidade vem do token
 * `neon` do Clerk (Bearer): toda consulta vai à Data API do Neon COM esse token, então a assinatura dele é
 * validada lá e a RLS vale como para o próprio usuário. O Worker só guarda as credenciais do R2.
 */
import { AwsClient } from 'aws4fetch';

export interface Env {
  ASSETS?: Fetcher;
  NEON_DATA_API_URL: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  /** Origens extras liberadas por CORS (desenvolvimento: o PWA roda em outra porta). Separadas por vírgula. */
  ALLOWED_ORIGINS?: string;
}

const EXPIRES_IN_SECONDS = 900;
const MAX_DOWNLOAD_KEYS = 100;
// A mídia é reduzida no aparelho antes do envio; o teto impede que um cliente adulterado suba originais.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type PresignBody = {
  operation?: 'upload' | 'download';
  filename?: string;
  contentType?: string;
  contentLength?: number;
  keys?: string[];
  /** Download: devolve só as chaves autorizadas em vez de recusar o lote inteiro (usado pelo painel admin). */
  partial?: boolean;
};

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Data API do Neon com o token do usuário. Repete o 401 `jwt_ausente` (ver apps/admin/src/lib/neon/retry-fetch.ts). */
async function dataApi<T>(env: Env, token: string, path: string, init?: RequestInit): Promise<T> {
  const base = env.NEON_DATA_API_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (response.ok) return response.json() as Promise<T>;
    const text = await response.text();
    if (response.status === 401 && text.includes('jwt_ausente') && attempt < 8) {
      await new Promise(resolve => setTimeout(resolve, Math.min(150 * 2 ** attempt, 2000)));
      continue;
    }
    // Token ausente, malformado, expirado ou de outro emissor: a Data API recusa com 401 (às vezes 400/403).
    if (response.status === 401 || (path.startsWith('rpc/current_usuario_id') && (response.status === 400 || response.status === 403))) {
      throw new HttpError(401, 'Unauthorized');
    }
    throw new Error(`Data API ${response.status}: ${text.slice(0, 200)}`);
  }
}

async function perfilDoUsuario(env: Env, token: string): Promise<{ usuarioId: string; clienteId: string }> {
  const usuarioId = await dataApi<string | null>(env, token, 'rpc/current_usuario_id', { method: 'POST', body: '{}' });
  if (!usuarioId) throw new HttpError(401, 'Unauthorized');
  const [perfil] = await dataApi<Array<{ cliente_id: string | null; ativo: boolean; perfil: string }>>(
    env, token, `usuarios?select=cliente_id,ativo,perfil&id=eq.${encodeURIComponent(usuarioId)}`,
  );
  if (!perfil?.ativo || !perfil.cliente_id || perfil.perfil === 'superadmin') {
    throw new HttpError(403, 'Tenant access required');
  }
  const [cliente] = await dataApi<Array<{ status: string }>>(
    env, token, `clientes?select=status&id=eq.${encodeURIComponent(perfil.cliente_id)}`,
  );
  if (cliente?.status !== 'ativo') throw new HttpError(403, 'Tenant suspended');
  return { usuarioId, clienteId: perfil.cliente_id };
}

function r2(env: Env) {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const objectUrl = (key: string) =>
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return { client, objectUrl };
}

async function presignUpload(env: Env, body: PresignBody, usuarioId: string, clienteId: string) {
  if (!body.filename) throw new HttpError(400, 'filename is required');
  const contentType = (body.contentType ?? '').toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) throw new HttpError(400, 'Unsupported media type');
  const length = body.contentLength;
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 1 || length > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, 'Invalid content length');
  }
  const now = new Date();
  const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  // Formato exigido por is_tenant_media_key: fotos/<cliente>/<uuid>/...
  const key = `fotos/${clienteId}/${usuarioId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}_${safe}`;
  const { client, objectUrl } = r2(env);
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(EXPIRES_IN_SECONDS));
  // Tipo e tamanho entram na assinatura (allHeaders: o aws4fetch não os assina por padrão): o PUT precisa
  // mandar exatamente o tipo e o tamanho declarados, e o teto de 5 MB vale de fato.
  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(length) },
    aws: { signQuery: true, allHeaders: true },
  });
  return { uploadUrl: signed.url, key, expiresAt: new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString() };
}

async function presignDownloads(env: Env, token: string, body: PresignBody, clienteId: string) {
  const requested = [...new Set((body.keys ?? []).filter(k => typeof k === 'string' && k))].slice(0, MAX_DOWNLOAD_KEYS);
  if (!requested.length) throw new HttpError(400, 'keys is required');

  // Chaves antigas (antes do multi-tenant) usam `fotos/{usuario_id}/...`: valem só se o usuário dono for
  // do mesmo cliente (mesma regra de antes no painel admin).
  const prefix = `fotos/${clienteId}/`;
  const legacyOwners = [...new Set(requested
    .filter(k => !k.startsWith(prefix) && k.startsWith('fotos/'))
    .map(k => k.split('/')[1])
    .filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
  const sameTenant = new Set<string>();
  if (legacyOwners.length) {
    const rows = await dataApi<Array<{ id: string }>>(
      env, token, `usuarios?select=id&cliente_id=eq.${clienteId}&id=in.(${legacyOwners.join(',')})`,
    );
    for (const row of rows) sameTenant.add(row.id);
  }
  const inTenant = (k: string) => k.startsWith(prefix) || sameTenant.has(k.split('/')[1]);
  if (!body.partial && requested.some(k => !inTenant(k))) {
    throw new HttpError(403, 'Invalid tenant media key');
  }
  const candidates = requested.filter(inTenant);
  if (!candidates.length) return { urls: {}, expiresAt: new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString() };

  // RLS por obra: só passam chaves referenciadas por linhas que o usuário enxerga.
  const accessible = await dataApi<string[] | Array<{ get_accessible_media_keys: string }>>(
    env, token, 'rpc/get_accessible_media_keys', { method: 'POST', body: JSON.stringify({ p_keys: candidates }) },
  );
  const allowed = new Set(accessible.map(item => (typeof item === 'string' ? item : item.get_accessible_media_keys)));
  if (!body.partial && candidates.some(k => !allowed.has(k))) throw new HttpError(403, 'Media access denied');
  const permitted = candidates.filter(k => allowed.has(k));

  const { client, objectUrl } = r2(env);
  const urls: Record<string, string> = {};
  await Promise.all(permitted.map(async key => {
    const url = new URL(objectUrl(key));
    url.searchParams.set('X-Amz-Expires', String(EXPIRES_IN_SECONDS));
    urls[key] = (await client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } })).url;
  }));
  return { urls, expiresAt: new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString() };
}

async function handlePresign(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401, cors);
  let body: PresignBody;
  try {
    body = await request.json() as PresignBody;
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }
  try {
    const { usuarioId, clienteId } = await perfilDoUsuario(env, token);
    const result = (body.operation ?? 'upload') === 'upload'
      ? await presignUpload(env, body, usuarioId, clienteId)
      : await presignDownloads(env, token, body, clienteId);
    return json(result, 200, cors);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
    console.error('[media/presign]', error);
    return json({ error: 'Internal server error' }, 500, cors);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/media/presign') {
      const cors = corsHeaders(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      return handlePresign(request, env, cors);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
