import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate the caller via Supabase JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as { filename: string; contentType?: string; mimeType?: string };
    const filename = body.filename;
    const contentType = body.contentType ?? body.mimeType ?? 'application/octet-stream';

    // Build deterministic, collision-resistant key:
    // fotos/{empresa_id}/{year}/{month}/{timestamp}_{sanitized_filename}
    // For Phase 1, use user_id as folder; empresa_id resolved in Phase 2
    const now = new Date();
    const year  = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ts    = now.getTime();
    const safe  = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key   = `fotos/${user.id}/${year}/${month}/${ts}_${safe}`;

    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    });

    const command = new PutObjectCommand({
      Bucket:      Deno.env.get('R2_BUCKET_NAME')!,
      Key:         key,
      ContentType: contentType,
    });

    // Presigned URL valid for 15 minutes
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

    return new Response(JSON.stringify({ uploadUrl, key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[r2-presign]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
