import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing, Typography } from '../lib/constants';

interface Props {
  itemTitle: string;
  ncId: string;
}

export function NCReinspectionBanner({ itemTitle }: Props) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon}>
        <RotateCcw size={20} color={Colors.info} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Reinspeção de NC aberta</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{itemTitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.progressBg,
    borderWidth: 1,
    borderColor: '#B9D0EA',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...Typography.bodyMedium, fontFamily: FontFamily.semibold, color: Colors.info },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
});
