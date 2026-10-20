import { useEffect, useMemo, useState } from 'react';
import { isRemoteMediaKey, localMediaUri } from '../lib/media-uri';
import { assinarDownloads } from '../lib/media-api';

export function usePrivateMediaUris(keys: string[]): (key: string) => string {
  const stableKeys = useMemo(() => Array.from(new Set(keys.filter(Boolean))).sort(), [JSON.stringify(keys)]);
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const remoteKeys = stableKeys.filter(isRemoteMediaKey);

    async function authorize() {
      if (!remoteKeys.length) {
        if (active) setSigned({});
        return;
      }
      let urls: Record<string, string>;
      try {
        urls = await assinarDownloads(remoteKeys);
      } catch (error) {
        // Offline ou sem permissão: a foto remota simplesmente não aparece; tenta de novo depois.
        if (!active) return;
        console.warn('[media] authorization failed:', error instanceof Error ? error.message : error);
        refreshTimer = setTimeout(authorize, 60 * 1000);
        return;
      }
      if (!active) return;
      setSigned(urls);
      refreshTimer = setTimeout(authorize, 10 * 60 * 1000);
    }

    void authorize();
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [stableKeys.join('\n')]);

  return (key: string) => localMediaUri(key) ?? signed[key] ?? '';
}
