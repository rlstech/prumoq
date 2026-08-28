/**
 * Client-side identifiers for offline-first writes.
 *
 * PowerSync needs the row id before the record ever reaches the server, so the
 * id is minted here. `crypto.randomUUID` is used when the runtime exposes it
 * (Hermes with the Expo crypto polyfill, and every browser the PWA supports);
 * the manual v4 template stays as the fallback so the native bundle keeps
 * working where it is missing.
 */
export function uuid(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = (Math.random() * 16) | 0;
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/** Timestamp for `created_at`/`updated_at` columns. */
export function now(): string {
  return new Date().toISOString();
}

/** `YYYY-MM-DD` for `date` columns, derived from the same instant as `now()`. */
export function today(): string {
  return now().slice(0, 10);
}
