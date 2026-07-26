import { AlertCircle, Check, CheckCircle2, LucideIcon, RefreshCw, WifiOff, X } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal as NativeModal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  Elevation,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';

export function Screen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.screenContent, contentStyle]}>{children}</View>;
}

export function Container({
  children,
  style,
  narrow = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  narrow?: boolean;
}) {
  return (
    <View style={[styles.container, narrow && styles.containerNarrow, style]}>
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'accent' | 'danger' | 'success';
}) {
  return <View style={[styles.card, cardTone[tone], style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  Icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  Icon?: LucideIcon;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const palette = buttonPalette[variant];
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        style,
        focused && styles.focusVisible,
        pressed && { backgroundColor: palette.pressed },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <>
          {Icon ? <Icon size={18} color={palette.text} strokeWidth={2.2} /> : null}
          <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  Icon,
  selected = false,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  selected?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.iconButtonSelected,
        disabled && styles.disabled,
        style,
        focused && styles.focusVisible,
        pressed && styles.iconButtonPressed,
      ]}
    >
      <Icon size={20} color={selected ? Colors.brand : Colors.textSecondary} />
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  multiline,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        style={[
          styles.input,
          multiline && styles.textArea,
          error && styles.inputError,
          focused && !error && styles.inputFocused,
          style,
        ]}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={Colors.textTertiary}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: { value: T; label: string; Icon?: LucideIcon }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={styles.segmented}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(option => {
        const selected = option.value === value;
        const Icon = option.Icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}
          >
            {Icon ? <Icon size={16} color={selected ? Colors.brand : Colors.textSecondary} /> : null}
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  Icon?: LucideIcon;
}) {
  const content = (
    <>
      {Icon ? <Icon size={14} color={selected ? Colors.brand : Colors.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Stepper<T extends string>({
  steps,
  current,
}: {
  steps: readonly { key: T; label: string }[];
  current: T;
}) {
  const currentIndex = Math.max(0, steps.findIndex(step => step.key === current));
  return (
    <View
      style={styles.stepper}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps.length, now: currentIndex + 1 }}
    >
      {steps.map((step, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotActive]}>
              {done ? (
                <Check size={14} color={Colors.surface} strokeWidth={2.6} />
              ) : (
                <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.stepLabel, active && styles.stepLabelActive]}
            >
              {step.label}
            </Text>
            {index < steps.length - 1 ? (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function BottomActionBar({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryLoading,
  primaryDisabled,
  helper,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  helper?: string;
}) {
  return (
    <View style={styles.actionBar}>
      <View style={styles.actionBarInner}>
        {helper ? <Text style={styles.actionHelper}>{helper}</Text> : null}
        <View style={styles.actionButtons}>
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
          ) : null}
          <View style={styles.actionPrimary}>
            <Button
              label={primaryLabel}
              onPress={onPrimary}
              loading={primaryLoading}
              disabled={primaryDisabled}
              fullWidth
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  Icon,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  Icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={24} color={Colors.textSecondary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <AlertCircle size={18} color={Colors.nok} strokeWidth={2.3} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View accessibilityLabel="Carregando" style={[styles.skeleton, style]} />;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/**
 * Small semantic status primitive. It always renders an icon when supplied,
 * keeping status meaning available to colour-blind users and screen readers.
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  Icon,
  size = 'md',
  accessibilityLabel,
}: {
  label: string;
  tone?: BadgeTone;
  Icon?: LucideIcon;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
}) {
  const palette = badgePalette[tone];
  const small = size === 'sm';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { backgroundColor: palette.background, borderColor: palette.border }, small && styles.badgeSm]}
    >
      {Icon ? <Icon size={small ? 13 : 14} color={palette.text} strokeWidth={2.3} /> : null}
      <Text style={[styles.badgeText, { color: palette.text }, small && styles.badgeTextSm]}>{label}</Text>
    </View>
  );
}

/** A compact progress indicator shared by dashboard cards and the checklist. */
export function Progress({
  value,
  label,
  tone = 'brand',
  height = 6,
  showValue = false,
}: {
  value: number;
  label?: string;
  tone?: BadgeTone;
  height?: number;
  showValue?: boolean;
}) {
  const bounded = Math.min(100, Math.max(0, value));
  const color = progressPalette[tone];
  return (
    <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: bounded }}>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
      <View style={[styles.progressTrack, { height }]}>
        <View style={[styles.progressFill, { width: `${bounded}%` as `${number}%`, height, backgroundColor: color }]} />
      </View>
      {showValue ? <Text style={styles.progressValue}>{Math.round(bounded)}%</Text> : null}
    </View>
  );
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

/** Connection state with icon, text and colour (never colour-only). */
export function SyncIndicator({
  state,
  label,
  compact = false,
}: {
  state: SyncState;
  label?: string;
  compact?: boolean;
}) {
  const config = syncConfig[state];
  const Icon = config.Icon;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? config.label}
      style={[styles.sync, compact && styles.syncCompact, { backgroundColor: config.background }]}
    >
      <Icon size={compact ? 14 : 16} color={config.color} strokeWidth={2.2} />
      {!compact ? <Text style={[styles.syncText, { color: config.color }]}>{label ?? config.label}</Text> : null}
    </View>
  );
}

/** Native modal/sheet shell. Platform-specific presentation details stay in
 * one component while the content remains shared by the PWA and native apps. */
export function ModalSheet({
  visible,
  onClose,
  title,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <NativeModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            {title ? <Text style={styles.modalTitle}>{title}</Text> : <View />}
            <IconButton label="Fechar" onPress={onClose} Icon={X} />
          </View>
          <View style={styles.modalContent}>{children}</View>
          {actions ? <View style={styles.modalActions}>{actions}</View> : null}
        </View>
      </View>
    </NativeModal>
  );
}

export type ToastTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

export function Toast({
  message,
  tone = 'neutral',
  visible = true,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  tone?: ToastTone;
  visible?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  if (!visible) return null;
  const config = toastPalette[tone];
  const Icon = config.Icon;
  return (
    <View accessible accessibilityRole="alert" style={[styles.toast, { backgroundColor: config.background, borderColor: config.border }]}>
      <Icon size={18} color={config.color} strokeWidth={2.2} />
      <Text style={[styles.toastText, { color: config.color }]}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="ghost" style={styles.toastAction} /> : null}
      {onDismiss ? <IconButton label="Fechar aviso" onPress={onDismiss} Icon={X} /> : null}
    </View>
  );
}

const badgePalette: Record<BadgeTone, { background: string; border: string; text: string }> = {
  neutral: { background: Colors.surface2, border: Colors.border, text: Colors.textSecondary },
  brand: { background: Colors.brandLight, border: Colors.brandSignature, text: Colors.brand },
  success: { background: Colors.okBg, border: Colors.ok, text: Colors.ok },
  danger: { background: Colors.nokBg, border: Colors.nok, text: Colors.nok },
  warning: { background: Colors.warnBg, border: Colors.warn, text: Colors.warn },
  info: { background: Colors.infoBg, border: Colors.info, text: Colors.info },
};

const progressPalette: Record<BadgeTone, string> = {
  neutral: Colors.na,
  brand: Colors.brand,
  success: Colors.ok,
  danger: Colors.nok,
  warning: Colors.warn,
  info: Colors.info,
};

const syncConfig: Record<SyncState, { color: string; background: string; label: string; Icon: LucideIcon }> = {
  synced: { color: Colors.ok, background: Colors.okBg, label: 'Sincronizado', Icon: CheckCircle2 },
  syncing: { color: Colors.info, background: Colors.infoBg, label: 'Sincronizando…', Icon: RefreshCw },
  offline: { color: Colors.warn, background: Colors.warnBg, label: 'Offline — salvo neste dispositivo', Icon: WifiOff },
  error: { color: Colors.nok, background: Colors.nokBg, label: 'Falha na sincronização', Icon: AlertCircle },
};

// Keep the labels in source ASCII so the same bundle renders correctly on all
// terminals/build agents regardless of their default code page.
Object.assign(syncConfig, {
  syncing: { color: Colors.info, background: Colors.infoBg, label: 'Sincronizando\u2026', Icon: RefreshCw },
  offline: { color: Colors.warn, background: Colors.warnBg, label: 'Offline \u2014 salvo neste dispositivo', Icon: WifiOff },
  error: { color: Colors.nok, background: Colors.nokBg, label: 'Falha na sincroniza\u00e7\u00e3o', Icon: AlertCircle },
});

const toastPalette: Record<ToastTone, { color: string; background: string; border: string; Icon: LucideIcon }> = {
  neutral: { color: Colors.text, background: Colors.surface, border: Colors.border, Icon: AlertCircle },
  success: { color: Colors.ok, background: Colors.okBg, border: Colors.ok, Icon: CheckCircle2 },
  danger: { color: Colors.nok, background: Colors.nokBg, border: Colors.nok, Icon: AlertCircle },
  warning: { color: Colors.warn, background: Colors.warnBg, border: Colors.warn, Icon: AlertCircle },
  info: { color: Colors.info, background: Colors.infoBg, border: Colors.info, Icon: AlertCircle },
};

const cardTone: Record<string, ViewStyle> = {
  default: {},
  soft: { backgroundColor: Colors.surface2 },
  accent: { backgroundColor: Colors.brandLight, borderColor: Colors.brandSignature },
  danger: { backgroundColor: Colors.nokBg, borderColor: Colors.nok },
  success: { backgroundColor: Colors.okBg, borderColor: Colors.ok },
};

const buttonPalette: Record<ButtonVariant, { background: string; pressed: string; border: string; text: string }> = {
  primary: { background: Colors.brand, pressed: Colors.brandDark, border: Colors.brand, text: '#FFFFFF' },
  secondary: { background: Colors.surface, pressed: Colors.surface2, border: Colors.borderNormal, text: Colors.text },
  ghost: { background: 'transparent', pressed: Colors.surface2, border: 'transparent', text: Colors.textSecondary },
  danger: { background: Colors.nok, pressed: Colors.text, border: Colors.nok, text: Colors.surface },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  screenContent: { width: '100%', alignSelf: 'center' },
  container: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
  },
  containerNarrow: { maxWidth: Breakpoints.maxForm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Elevation.card,
  },
  button: {
    minHeight: ComponentSize.button,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  focusVisible: {
    borderColor: Colors.focus,
    shadowColor: Colors.focus,
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
    lineHeight: 20,
  },
  iconButton: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSelected: { backgroundColor: Colors.brandLight },
  iconButtonPressed: { backgroundColor: Colors.surface2 },
  field: { gap: 6 },
  fieldLabel: { ...Typography.label, color: Colors.text },
  input: {
    minHeight: ComponentSize.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.md,
  },
  inputFocused: {
    borderColor: Colors.focus,
    borderWidth: 2,
    shadowColor: Colors.focus,
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  textArea: { minHeight: 112, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.nok, borderWidth: 1.5 },
  fieldError: { ...Typography.caption, color: Colors.nok },
  fieldHint: { ...Typography.caption, color: Colors.textSecondary },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    gap: 4,
  },
  segment: {
    minHeight: ComponentSize.touch,
    flex: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentSelected: { backgroundColor: Colors.surface, ...Elevation.card },
  segmentPressed: { backgroundColor: Colors.border },
  segmentText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.medium },
  segmentTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  chip: {
    minHeight: ComponentSize.touch,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipSelected: { backgroundColor: Colors.brandLight, borderColor: Colors.brandSignature },
  chipText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.medium },
  chipTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  stepper: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative', gap: 5 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  stepNumber: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  stepNumberActive: { color: Colors.surface },
  stepLabel: { ...Typography.caption, color: Colors.textTertiary, maxWidth: 92 },
  stepLabelActive: { color: Colors.text, fontFamily: FontFamily.semibold },
  stepLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.border,
    left: '50%',
    right: '-50%',
    top: 13,
  },
  stepLineDone: { backgroundColor: Colors.brand },
  actionBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    ...Elevation.floating,
  },
  actionBarInner: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    gap: Spacing.sm,
  },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  actionPrimary: { flex: 1, maxWidth: 360 },
  actionHelper: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { ...Typography.heading, color: Colors.text, textAlign: 'center' },
  emptyDescription: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 420 },
  errorBanner: {
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
    borderWidth: 1,
    borderColor: Colors.nok,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  errorBannerText: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.medium, flex: 1 },
  skeleton: { minHeight: 18, backgroundColor: Colors.surface2, borderRadius: Radius.sm },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionHeadingText: { flex: 1, gap: 3 },
  eyebrow: {
    ...Typography.caption,
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: { ...Typography.heading, color: Colors.text },
  sectionDescription: { ...Typography.body, color: Colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  badgeSm: { minHeight: 24, paddingHorizontal: Spacing.sm - 2 },
  badgeText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  badgeTextSm: { fontSize: FontSizes.tiny, lineHeight: 16 },
  progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary, minWidth: 68 },
  progressTrack: {
    flex: 1,
    minWidth: 40,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.surface2,
  },
  progressFill: { borderRadius: Radius.full, minWidth: 0 },
  progressValue: { ...Typography.caption, color: Colors.textSecondary, minWidth: 34, textAlign: 'right' },
  sync: {
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  syncCompact: { width: 28, height: 28, paddingHorizontal: 0, justifyContent: 'center' },
  syncText: { ...Typography.caption, fontFamily: FontFamily.medium },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    maxHeight: '90%',
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Elevation.floating,
  },
  modalHeader: {
    minHeight: 60,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  modalTitle: { ...Typography.heading, color: Colors.text, flex: 1 },
  modalContent: { padding: Spacing.lg },
  modalActions: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.sm },
  toast: {
    width: '100%',
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Elevation.floating,
  },
  toastText: { ...Typography.bodyMedium, flex: 1 },
  toastAction: { minHeight: 36, paddingHorizontal: Spacing.sm, borderWidth: 0 },
});
