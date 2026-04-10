import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../lib/constants';

interface Props {
  label: string;
  value: number | string;
  Icon?: LucideIcon;
  color?: string;
  onPress?: () => void;
}

export function KPICard({ label, value, Icon, color = Colors.brand, onPress }: Props) {
  const content = (
    <View style={styles.card}>
      {Icon && <Icon size={18} color={color} />}
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
});
