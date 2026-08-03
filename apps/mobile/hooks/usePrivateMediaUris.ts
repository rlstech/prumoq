import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function localUri(value: string): string | null {
  if (value.startsWith('pending:')) return value.slice('pending:'.length);
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return null;
}

export function usePrivateMediaUris(keys: string[]): (key: string) => string {
  const stableKeys = useMemo(() => Array.from(new Set(keys.filter(Boolean))).sort(), [JSON.stringify(keys)]);
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const remoteKeys = stableKeys.filter(key => localUri(key) === null);

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

  return (key: string) => localUri(key) ?? signed[key] ?? '';
}
