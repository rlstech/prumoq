import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';

interface Props {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showBack, onBack, rightElement, children }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={18} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.appName}>PrumoQ</Text>
        {rightElement ?? (
          <View style={styles.side}>
            <MoreHorizontal size={20} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </View>

      {(title || subtitle || children) && (
        <View style={styles.content}>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  side: {
    width: 36,
    alignItems: 'center',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: '#fff',
    fontSize: FontSizes.base,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    paddingTop: Spacing.xs,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: FontSizes.xl,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSizes.sm,
  },
});
