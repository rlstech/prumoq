import { useEffect, useState } from 'react';
import { SyncIndicator, SyncIndicatorTone } from './ui';

interface Props {
  /** `onBrand` na capa do dashboard; `surface` nos cabecalhos claros. */
  tone?: SyncIndicatorTone;
  compact?: boolean;
}

export function SyncStatusIndicator({ tone = 'surface', compact = true }: Props = {}) {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return <SyncIndicator state={online ? 'synced' : 'offline'} compact={compact} tone={tone} />;
}
