import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GetObjectCommand, PutObjectCommand, S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  operation?: 'upload' | 'download';
  filename?: string;
  contentType?: string;
  mimeType?: string;
  key?: string;
  keys?: string[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('usuarios')
      .select('cliente_id, ativo, perfil')
      .eq('id', user.id)
      .single();
    if (!profile?.ativo || !profile.cliente_id || profile.perfil === 'superadmin') {
      return json({ error: 'Tenant access required' }, 403);
    }
    const { data: cliente } = await supabase.from('clientes').select('status').eq('id', profile.cliente_id).single();
    if (cliente?.status !== 'ativo') return json({ error: 'Tenant suspended' }, 403);

    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
    const bucket = Deno.env.get('R2_BUCKET_NAME')!;
    const body = await req.json() as RequestBody;

    if ((body.operation ?? 'upload') === 'upload') {
      if (!body.filename) return json({ error: 'filename is required' }, 400);
      const now = new Date();
      const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const random = crypto.randomUUID();
      const key = `fotos/${profile.cliente_id}/${user.id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${random}_${safe}`;
      const contentType = body.contentType ?? body.mimeType ?? 'application/octet-stream';
      const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 900 });
      return json({ uploadUrl, key, expiresAt: new Date(Date.now() + 900_000).toISOString() });
    }

    const requested = [...new Set([...(body.keys ?? []), ...(body.key ? [body.key] : [])])].slice(0, 100);
    if (!requested.length) return json({ error: 'key or keys is required' }, 400);
    const prefix = `fotos/${profile.cliente_id}/`;
    if (requested.some(key => !key.startsWith(prefix))) return json({ error: 'Invalid tenant media key' }, 403);

    const { data: accessible, error: accessError } = await supabase.rpc('get_accessible_media_keys', { p_keys: requested });
    if (accessError) throw accessError;
    const allowed = new Set((accessible ?? []) as string[]);
    if (requested.some(key => !allowed.has(key))) return json({ error: 'Media access denied' }, 403);

    const expiresIn = 900;
    const urls = Object.fromEntries(await Promise.all(requested.map(async key => [
      key,
      await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),
    ])));
    return json({ urls, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
  } catch (error) {
    console.error('[r2-presign]', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
