import { SyncIndicator } from './ui';

/** TypeScript fallback; Expo resolves the native/web variants at runtime. */
export function SyncStatusIndicator() {
  return <SyncIndicator state="synced" compact />;
}
