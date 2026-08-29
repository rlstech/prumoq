import { supabase } from './supabase';
// TypeScript resolves the fallback file during native typechecking; Metro picks
// the platform implementation before this file at runtime.
import { signatureStore } from './signature-store.native';

export { signatureStore };
export type SignatureSnapshot = { uri: string };

/**
 * Keeps the user's reusable signature outside of the transient cache.  The
 * document flows always ask for a snapshot, so a later replacement never
 * changes a document that was already signed.
 */
export interface SignatureStore {
  save(userId: string, sourceUri: string): Promise<string>;
  get(userId: string): Promise<string | null>;
  snapshot(userId: string, documentId: string): Promise<SignatureSnapshot | null>;
  /** Downloads an already-signed URL into the local default-signature slot. */
  restoreFromRemote(userId: string, downloadUri: string): Promise<string | null>;
  clear(userId: string): Promise<void>;
}

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
