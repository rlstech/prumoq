import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Colors, FontFamily, Palette, Radius, Spacing } from '../lib/constants';

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
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0,
    gap: Spacing.md,
  },
  text: {
    fontSize: 13,
    color: Palette.white,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  btn: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  btnText: {
    color: Palette.onAccent,
    fontSize: 14,
    fontFamily: FontFamily.display,
    letterSpacing: 0.3,
  },
});
