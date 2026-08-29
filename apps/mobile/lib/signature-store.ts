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

// TypeScript resolves this fallback file during typechecking; Metro always
// picks the platform-specific implementation (.native.ts/.web.ts) before this
// file at runtime — so this file must only re-export the type/value shape,
// never define anything a caller needs to actually run (it will be `undefined`
// at runtime). Platform-agnostic helpers built on top of signatureStore belong
// in signature-defaults.ts instead.
export { signatureStore } from './signature-store.native';
