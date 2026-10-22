import {
  mineralBreakpoints,
  mineralMotion,
  trenaBorder,
  trenaColors,
  trenaPalette,
  trenaRadius,
} from '@prumoq/design-system';

/** Adaptador do PWA para a identidade Trena (packages/design-system). */
export const Palette = {
  brand: trenaColors.brand,
  action: trenaColors.brand,
  actionPressed: trenaColors.brandPressed,
  actionSoft: trenaColors.accentSoft,

  ink: trenaColors.text,
  inkSecondary: trenaColors.textSecondary,
  inkTertiary: trenaColors.textMuted,

  canvas: trenaColors.canvas,
  surface: trenaColors.surface,
  surfaceMuted: trenaColors.surfaceSecondary,
  border: trenaColors.border,
  borderStrong: trenaColors.borderStrong,

  success: trenaColors.success,
  successSoft: trenaColors.successSoft,
  danger: trenaColors.danger,
  dangerSoft: trenaColors.dangerSoft,
  warning: trenaColors.warning,
  warningSoft: trenaColors.warningSoft,
  info: trenaColors.info,
  infoSoft: trenaColors.infoSoft,
  neutral: trenaColors.neutral,
  neutralSoft: trenaColors.neutralSoft,

  white: trenaPalette.white,
  black: trenaPalette.black,
  focus: trenaColors.focus,
  overlay: trenaColors.overlay,

  /** Amarelo trena: só ação principal, item ativo e destaque. Texto sobre ele é sempre grafite. */
  accent: trenaColors.accent,
  accentPressed: trenaPalette.tapeYellowPressed,
  onAccent: trenaPalette.graphite,
  /** Linhas e texto secundário sobre o grafite (cabeçalho, menu inferior). */
  onBrandLine: trenaPalette.graphiteLine,
  onBrandMuted: trenaPalette.steelLight,
} as const;

/** A named colour from the semantic palette. Prefer these tokens to literals
 * in screens/components so the PWA and native builds keep the same contrast
 * and state treatment. */
export type ColorToken = keyof typeof Palette;

export const Colors = {
  brand: Palette.action,
  brandSignature: trenaColors.accent,
  action: Palette.action,
  actionPressed: Palette.actionPressed,
  actionSoft: Palette.actionSoft,
  brandDark: Palette.actionPressed,
  brandLight: Palette.actionSoft,
  brandMid: Palette.brand,

  ok: Palette.success,
  okBg: Palette.successSoft,
  okMid: trenaColors.success,
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
  xs: trenaRadius.control,
  sm: trenaRadius.control,
  md: trenaRadius.card,
  lg: trenaRadius.card,
  xl: trenaRadius.feature,
  full: trenaRadius.full,
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
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  /** Títulos, botões e rótulos de seção (Barlow Condensed, geralmente em caixa alta). */
  display: 'BarlowCondensed_700Bold',
  displaySemibold: 'BarlowCondensed_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const Typography = {
  // Títulos em Barlow Condensed: a condensada é mais estreita, por isso os tamanhos sobem um pouco.
  display: { fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, letterSpacing: 0 },
  title: { fontFamily: FontFamily.display, fontSize: 30, lineHeight: 32, letterSpacing: 0 },
  heading: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 28, letterSpacing: 0.1 },
  body: { fontFamily: FontFamily.regular, fontSize: FontSizes.md, lineHeight: 24 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: FontSizes.md, lineHeight: 24 },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, lineHeight: 20 },
  caption: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, lineHeight: 18 },
  button: {
    fontFamily: FontFamily.display,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  overline: {
    fontFamily: FontFamily.display,
    fontSize: FontSizes.sm,
    lineHeight: 18,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  },
  /** Título em caixa alta: saudação, nomes de obra, cabeçalhos de card. */
  displayCaps: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
  },
  /** Números de destaque (KPIs, percentuais, prazos). */
  metric: { fontFamily: FontFamily.monoBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
} as const;

/** Espessura das bordas: na identidade Trena os cards se separam por borda, não por sombra. */
export const BorderWidth = {
  hairline: trenaBorder.hairline,
  card: trenaBorder.card,
  control: trenaBorder.control,
} as const;

export const Elevation = {
  /** Sem sombra: o card se destaca pela borda (BorderWidth.card). */
  card: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
  /** Joined answer control (ChoiceToggle): icon over label needs the extra
   * height, and it buys an equal-thirds target of ~118×56 on a 390pt screen. */
  choice: 56,
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
