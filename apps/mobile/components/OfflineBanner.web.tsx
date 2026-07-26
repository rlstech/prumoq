import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '../lib/constants';
import { SyncIndicator } from './ui';

const offlineLabel = [
  'Modo offline',
  String.fromCharCode(0x2014),
  ' altera',
  String.fromCharCode(0xe7),
  String.fromCharCode(0xf5),
  'es ser',
  String.fromCharCode(0xe3),
  'o sincronizadas quando a conex',
  String.fromCharCode(0xe3),
  'o voltar',
].join('');

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <SyncIndicator state="offline" label={offlineLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.warnBg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
