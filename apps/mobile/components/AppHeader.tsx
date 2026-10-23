import { ChevronLeft } from '../lib/icons';
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
  Typography,
} from '../lib/constants';
import { BrandMark } from './BrandMark';
import { BrandWordmark } from './BrandWordmark';
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
                <ChevronLeft size={22} color={isBrand ? Palette.white : Colors.text} strokeWidth={1.9} />
              </Pressable>
            ) : (
              <BrandMark size={32} variant={isBrand ? 'onBrand' : 'default'} />
            )}
            <BrandWordmark fontSize={FontSizes.base} variant={isBrand ? 'onBrand' : 'default'} />
          </View>
          <View style={styles.headerActions}>
            {/* Com ações à direita o indicador vira só o ícone, para caber na linha. */}
            <SyncStatusIndicator compact={!!rightElement} short />
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
  // Trena Suave: o cabeçalho é o próprio concreto, sem faixa nem borda.
  shell: {
    backgroundColor: Colors.bg,
  },
  shellBrand: {
    backgroundColor: Colors.brand,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  container: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
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
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: Colors.surface2 },
  iconButtonBrand: { backgroundColor: 'rgba(255,255,255,0.1)' },
  iconButtonBrandPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  content: {
    paddingTop: Spacing.sm,
    gap: 4,
  },
  title: {
    ...Typography.title,
    color: Colors.text,
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
