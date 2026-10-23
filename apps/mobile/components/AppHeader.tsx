import { ChevronLeft, type IconComponent } from '../lib/icons';
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

/** Ação redonda do cabeçalho (busca, PDF, filtro). */
export function HeaderIconButton({
  Icon,
  label,
  onPress,
  active = false,
  badge,
}: {
  Icon: IconComponent;
  label: string;
  onPress: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, pressed && styles.iconButtonPressed]}
    >
      <Icon size={21} color={active ? Palette.white : Colors.text} strokeWidth={1.9} />
      {badge ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
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
        {/* Trena Suave: telas internas sem logotipo. Com voltar, a linha de cima
            leva o botão redondo e as ações; nas abas raiz o título sobe para ela. */}
        <View style={styles.topRow}>
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
          ) : title ? (
            <Text
              accessibilityRole="header"
              style={[styles.title, styles.titleInline, isBrand && styles.titleBrand]}
              numberOfLines={2}
            >
              {title}
            </Text>
          ) : <View />}
          <View style={styles.headerActions}>
            <SyncStatusIndicator compact short />
            {rightElement}
          </View>
        </View>

        {((showBack && title) || subtitle || children) ? (
          <View style={styles.content}>
            {showBack && title ? (
              <Text accessibilityRole="header" style={[styles.title, isBrand && styles.titleBrand]} numberOfLines={2}>
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
  iconButton: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: Colors.surface2 },
  iconButtonActive: { backgroundColor: Colors.brand },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: { fontFamily: FontFamily.monoBold, fontSize: 10, color: Palette.onAccent },
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
  titleInline: { flex: 1, minWidth: 0 },
  titleBrand: { color: Palette.white },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  subtitleBrand: { color: Palette.white, opacity: 0.76 },
});
