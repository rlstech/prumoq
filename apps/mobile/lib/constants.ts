import {
  mineralBreakpoints,
  mineralColors,
  mineralMotion,
  mineralPalette,
  mineralRadius,
} from '@prumoq/design-system';

/** Native adapter for the shared Prumo Mineral design system. */
export const Palette = {
  brand: mineralColors.brand,
  action: mineralColors.brand,
  actionPressed: mineralColors.brandPressed,
  actionSoft: mineralColors.accentSoft,

  ink: mineralColors.text,
  inkSecondary: mineralColors.textSecondary,
  inkTertiary: mineralColors.textMuted,

  canvas: mineralColors.canvas,
  surface: mineralColors.surface,
  surfaceMuted: mineralColors.surfaceSecondary,
  border: mineralColors.border,
  borderStrong: mineralColors.borderStrong,

  success: mineralColors.success,
  successSoft: mineralColors.successSoft,
  danger: mineralColors.danger,
  dangerSoft: mineralColors.dangerSoft,
  warning: mineralColors.warning,
  warningSoft: mineralColors.warningSoft,
  info: mineralColors.info,
  infoSoft: mineralColors.infoSoft,
  neutral: mineralColors.neutral,
  neutralSoft: mineralColors.neutralSoft,

  white: mineralPalette.white,
  black: mineralPalette.black,
  focus: mineralColors.focus,
  overlay: mineralColors.overlay,
} as const;

/** A named colour from the semantic palette. Prefer these tokens to literals
 * in screens/components so the PWA and native builds keep the same contrast
 * and state treatment. */
export type ColorToken = keyof typeof Palette;

export const Colors = {
  brand: Palette.action,
  brandSignature: mineralColors.accent,
  action: Palette.action,
  actionPressed: Palette.actionPressed,
  actionSoft: Palette.actionSoft,
  brandDark: Palette.actionPressed,
  brandLight: Palette.actionSoft,
  brandMid: Palette.brand,

  ok: Palette.success,
  okBg: Palette.successSoft,
  okMid: mineralColors.success,
  nok: Palette.danger,
  nokBg: Palette.dangerSoft,
  progress: Palette.info,
  progressBg: Palette.infoSoft,
  info: Palette.info,
  infoBg: Palette.infoSoft,
  warn: Palette.warning,
  warnBg: Palette.warningSoft,
  na: Palette.neutral,
  naBg: Palette.neutralSoft,

  surface: Palette.surface,
  surface2: Palette.surfaceMuted,
  bg: Palette.canvas,

  text: Palette.ink,
  textSecondary: Palette.inkSecondary,
  textTertiary: Palette.inkTertiary,

  border: Palette.border,
  borderNormal: Palette.borderStrong,
  focus: Palette.focus,
  overlay: Palette.overlay,
} as const;

/** Public semantic aliases used by new screens. `Colors` remains available as
 * a backwards-compatible alias for the first generation of mobile screens. */
export const SemanticColors = {
  canvas: Palette.canvas,
  surface: Palette.surface,
  surfaceSecondary: Palette.surfaceMuted,
  text: Palette.ink,
  textSecondary: Palette.inkSecondary,
  textMuted: Palette.inkTertiary,
  border: Palette.border,
  borderStrong: Palette.borderStrong,
  brand: Palette.brand,
  action: Palette.action,
  actionPressed: Palette.actionPressed,
  actionSoft: Palette.actionSoft,
  success: Palette.success,
  successSoft: Palette.successSoft,
  danger: Palette.danger,
  dangerSoft: Palette.dangerSoft,
  warning: Palette.warning,
  warningSoft: Palette.warningSoft,
  info: Palette.info,
  infoSoft: Palette.infoSoft,
} as const;

export const Radius = {
  xs: mineralRadius.control,
  sm: mineralRadius.control,
  md: mineralRadius.card,
  lg: mineralRadius.card,
  xl: mineralRadius.feature,
  full: mineralRadius.full,
} as const;

export const Spacing = {
  xxs: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  /** Use for hairline separators only; content spacing stays on a 4px grid. */
  hairline: 1,
} as const;

export const FontSizes = {
  tiny: 12,
  xs: 13,
  sm: 14,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  title: 34,
  display: 42,
} as const;

export const FontFamily = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMonoFallback',
} as const;

export const Typography = {
  display: { fontFamily: FontFamily.bold, fontSize: FontSizes.display, lineHeight: 48, letterSpacing: -1.2 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSizes.xxl, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xl, lineHeight: 28, letterSpacing: -0.25 },
  body: { fontFamily: FontFamily.regular, fontSize: FontSizes.md, lineHeight: 24 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: FontSizes.md, lineHeight: 24 },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, lineHeight: 20 },
  caption: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, lineHeight: 18 },
  button: { fontFamily: FontFamily.semibold, fontSize: FontSizes.md, lineHeight: 20 },
  overline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

export const Elevation = {
  card: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const Motion = {
  quick: mineralMotion.quick,
  standard: mineralMotion.standard,
  deliberate: mineralMotion.deliberate,
} as const;

export const Breakpoints = {
  mobile: mineralBreakpoints.mobile,
  tablet: mineralBreakpoints.tablet,
  desktop: mineralBreakpoints.desktop,
  maxContent: mineralBreakpoints.maxContent,
  maxForm: mineralBreakpoints.maxForm,
} as const;

export const ComponentSize = {
  touch: 44,
  input: 48,
  button: 48,
  tabBar: 72,
  navigationRail: 92,
} as const;

export const ZIndex = {
  base: 0,
  header: 10,
  navigation: 20,
  overlay: 30,
  toast: 40,
} as const;

/** Complete design-token surface for platform-specific adapters. */
export const DesignTokens = {
  colors: SemanticColors,
  palette: Palette,
  spacing: Spacing,
  radius: Radius,
  typography: Typography,
  fontFamily: FontFamily,
  fontSizes: FontSizes,
  elevation: Elevation,
  motion: Motion,
  breakpoints: Breakpoints,
  componentSize: ComponentSize,
  zIndex: ZIndex,
} as const;

// Short alias for consumers that prefer `Tokens.colors.action` notation.
export const Tokens = DesignTokens;
