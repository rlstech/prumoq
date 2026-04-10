import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Colors, Radius, Spacing } from '../lib/constants';

export function InstallBanner() {
  const { canInstall, install } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Instale o PrumoQ na tela inicial</Text>
      <Pressable style={styles.btn} onPress={install}>
        <Text style={styles.btnText}>Instalar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.progressBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  text: {
    fontSize: 13,
    color: Colors.progress,
    fontWeight: '500',
    flex: 1,
  },
  btn: {
    backgroundColor: Colors.progress,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
