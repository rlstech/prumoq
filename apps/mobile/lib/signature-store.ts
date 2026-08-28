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
  clear(userId: string): Promise<void>;
}

// TypeScript resolves the fallback file during native typechecking; Metro picks
// the platform implementation before this file at runtime.
export { signatureStore } from './signature-store.native';
