import 'server-only';
import { AwsClient } from 'aws4fetch';
import type { Database } from '@prumoq/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// Links temporários de leitura para fotos/assinaturas no R2. Antes passava pela Edge Function
// `r2-presign` do Supabase; com Neon + Clerk a assinatura acontece aqui, no servidor Next, com as
// mesmas checagens: usuário ativo de um cliente ativo (superadmin não), chave dentro do prefixo do
// cliente e `get_accessible_media_keys` executada com o token do próprio usuário (RLS por obra).
const EXPIRES_IN_SECONDS = 900;
const BATCH_SIZE = 100;

let r2Client: AwsClient | null = null;

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Falha ao autorizar anexos: credenciais do R2 não configuradas.');
  }
  // aws4fetch (Web Crypto) em vez do AWS SDK: roda no Cloudflare Workers e é o mesmo do Worker do PWA.
  r2Client ??= new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = (key: string) =>
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return { client: r2Client, objectUrl };
}

async function getTenantId(client: SupabaseClient<Database>): Promise<string> {
  const { data: usuarioId } = await client.rpc('current_usuario_id');
  if (!usuarioId) throw new Error('Falha ao autorizar anexos: usuário não autenticado.');

  const { data: profile } = await client
    .from('usuarios')
    .select('cliente_id, ativo, perfil')
    .eq('id', usuarioId as string)
    .maybeSingle();
  if (!profile?.ativo || !profile.cliente_id || profile.perfil === 'superadmin') {
    throw new Error('Falha ao autorizar anexos: acesso de cliente necessário.');
  }

  const { data: cliente } = await client
    .from('clientes')
    .select('status')
    .eq('id', profile.cliente_id)
    .maybeSingle();
  if (cliente?.status !== 'ativo') throw new Error('Falha ao autorizar anexos: cliente suspenso.');

  return profile.cliente_id;
}

// Chaves antigas (antes do multi-tenant) usam `fotos/{usuario_id}/...`. Só valem se esse usuário for do
// mesmo cliente: senão bastaria gravar numa linha própria a chave de um arquivo de outro cliente.
async function filterTenantKeys(
  client: SupabaseClient<Database>,
  clienteId: string,
  keys: string[],
): Promise<string[]> {
  const prefix = `fotos/${clienteId}/`;
  const legacyOwners = Array.from(new Set(keys
    .filter((key) => !key.startsWith(prefix) && key.startsWith('fotos/'))
    .map((key) => key.split('/')[1])
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))));

  const sameTenantUsers = new Set<string>();
  if (legacyOwners.length) {
    const { data } = await client
      .from('usuarios')
      .select('id')
      .eq('cliente_id', clienteId)
      .in('id', legacyOwners);
    for (const row of data ?? []) sameTenantUsers.add(row.id);
  }

  return keys.filter((key) => key.startsWith(prefix) || sameTenantUsers.has(key.split('/')[1]));
}

export async function signPrivateMedia(
  client: SupabaseClient<Database>,
  input: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const keys = Array.from(new Set(input.filter((value): value is string =>
    Boolean(value) && !value!.startsWith('http') && !value!.startsWith('data:') &&
    !value!.startsWith('pending:') && !value!.startsWith('blob:'),
  )));
  if (!keys.length) return new Map();

  // Anexo não autorizado fica fora do mapa (a tela mostra "sem foto") em vez de derrubar a página toda.
  const clienteId = await getTenantId(client);
  const tenantKeys = await filterTenantKeys(client, clienteId, keys);

  const r2 = getR2();
  const result = new Map<string, string>();
  for (let index = 0; index < tenantKeys.length; index += BATCH_SIZE) {
    const batch = tenantKeys.slice(index, index + BATCH_SIZE);
    const { data: accessible, error } = await client.rpc('get_accessible_media_keys', { p_keys: batch });
    if (error) throw new Error(`Falha ao autorizar anexos: ${error.message}`);
    const allowed = new Set((accessible ?? []) as string[]);
    const permitted = batch.filter((key) => allowed.has(key));

    const signed = await Promise.all(permitted.map(async (key) => {
      const url = new URL(r2.objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(EXPIRES_IN_SECONDS));
      const request = await r2.client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
      return [key, request.url] as const;
    }));
    for (const [key, url] of signed) result.set(key, url);
  }
  const denied = keys.length - result.size;
  if (denied) console.warn(`[signPrivateMedia] ${denied} anexo(s) sem autorização ficaram sem link.`);
  return result;
}
