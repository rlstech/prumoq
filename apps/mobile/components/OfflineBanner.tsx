import { useStatus } from '@powersync/react-native';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Spacing } from '../lib/constants';

export function OfflineBanner() {
  const status = useStatus();

  if (status.connected) return null;

  const isSyncing = status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading;

  return (
    <View style={styles.banner}>
      <WifiOff size={14} color={Colors.warn} />
      <Text style={styles.text}>
        {isSyncing ? 'Sincronizando...' : 'Modo offline — dados salvos localmente'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warnBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warn + '33',
  },
  text: {
    fontSize: FontSizes.sm,
    color: Colors.warn,
    fontWeight: '500',
    flex: 1,
  },
});
