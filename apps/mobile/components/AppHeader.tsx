import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  FontFamily,
  FontSizes,
  Palette,
  Radius,
  Spacing,
} from '../lib/constants';
import { BrandMark } from './BrandMark';
import { SyncStatusIndicator } from './SyncStatusIndicator';

type AppHeaderTone = 'light' | 'brand';

interface Props {
  title?: string;
  subtitle?: string;
  tone?: AppHeaderTone;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  tone = 'light',
  showBack,
  onBack,
  rightElement,
  children,
}: Props) {
  const isBrand = tone === 'brand';

  return (
    <View style={[styles.shell, isBrand && styles.shellBrand]}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                onPress={onBack}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.iconButton,
                  isBrand && styles.iconButtonBrand,
                  pressed && (isBrand ? styles.iconButtonBrandPressed : styles.iconButtonPressed),
                ]}
              >
                <ChevronLeft size={22} color={isBrand ? Palette.white : Colors.text} />
              </Pressable>
            ) : (
              <BrandMark size={32} variant={isBrand ? 'onBrand' : 'default'} />
            )}
            <Text style={[styles.appName, isBrand && styles.appNameBrand]}>PrumoQ</Text>
          </View>
          <View style={styles.headerActions}>
            <SyncStatusIndicator />
            {rightElement}
          </View>
        </View>

        {(title || subtitle || children) ? (
          <View style={styles.content}>
            {title ? (
              <Text style={[styles.title, isBrand && styles.titleBrand]} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.subtitle, isBrand && styles.subtitleBrand]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  shellBrand: {
    backgroundColor: Colors.brand,
    borderBottomColor: Colors.brandDark,
  },
  container: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  topRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: Colors.border },
  iconButtonBrand: { backgroundColor: 'rgba(255,255,255,0.1)' },
  iconButtonBrandPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  appName: {
    color: Colors.text,
    fontSize: FontSizes.base,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.25,
  },
  appNameBrand: { color: Palette.white },
  content: {
    paddingTop: Spacing.xs,
    gap: 4,
  },
  title: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    lineHeight: 32,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  titleBrand: { color: Palette.white },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  subtitleBrand: { color: Palette.white, opacity: 0.76 },
});
