import { useStatus } from '@powersync/react-native';
import { StyleSheet, View } from 'react-native';
import { SyncIndicator } from './ui';

export function OfflineBanner() {
  const status = useStatus();
  const isSyncing = Boolean(status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading);

  if (status.connected && !isSyncing) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <SyncIndicator
        state={isSyncing ? 'syncing' : 'offline'}
        label={isSyncing ? 'Sincronizando\u2026' : 'Modo offline \u2014 dados salvos localmente'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
