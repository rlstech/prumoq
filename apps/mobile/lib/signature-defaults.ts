import { signatureStore } from './signature-store';
import { supabase } from './supabase';

/**
 * The default signature lives on whichever device it was captured on until
 * PowerSync uploads it; `usuarios.assinatura_padrao_url` is the synced source
 * of truth. A fresh install or a different device has no local file yet even
 * though the profile already shows the signature as configured — this
 * re-hydrates the local cache from R2 in that case, so users are never asked
 * to re-register a signature that already exists.
 *
 * Returns null only when there is genuinely no signature to use yet (never
 * configured anywhere, or still `pending:` on a device that hasn't synced).
 *
 * Deliberately NOT in signature-store.ts: that file is a TypeScript-only
 * fallback Metro never bundles (it always picks .native.ts/.web.ts instead),
 * so anything defined only there is `undefined` at runtime.
 */
export async function ensureDefaultSignature(
  userId: string,
  assinaturaPadraoUrl: string | null | undefined,
): Promise<string | null> {
  const local = await signatureStore.get(userId);
  if (local) return local;
  if (!assinaturaPadraoUrl || assinaturaPadraoUrl.startsWith('pending:')) return null;

  try {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: { operation: 'download', keys: [assinaturaPadraoUrl] },
    });
    if (error) return null;
    const downloadUrl = (data as { urls?: Record<string, string> } | null)?.urls?.[assinaturaPadraoUrl];
    if (!downloadUrl) return null;
    return await signatureStore.restoreFromRemote(userId, downloadUrl);
  } catch {
    return null;
  }
}
