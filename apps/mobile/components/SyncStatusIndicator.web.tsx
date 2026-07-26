import { useEffect, useState } from 'react';
import { SyncIndicator } from './ui';

export function SyncStatusIndicator() {
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
  return <SyncIndicator state={online ? 'synced' : 'offline'} compact />;
}
