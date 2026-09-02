import { useEffect, useMemo, useState } from 'react';
import { isRemoteMediaKey, localMediaUri } from '../lib/media-uri';
import { supabase } from '../lib/supabase';

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
      const { data, error } = await supabase.functions.invoke('r2-presign', {
        body: { operation: 'download', keys: remoteKeys },
      });
      if (!active) return;
      if (error) {
        console.warn('[media] authorization failed:', error.message);
        setSigned({});
        return;
      }
      setSigned((data as { urls?: Record<string, string> } | null)?.urls ?? {});
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
