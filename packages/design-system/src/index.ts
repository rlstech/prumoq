/**
 * Prumo Mineral — cross-platform design tokens.
 *
 * Keep this package free of React, React Native and browser APIs. Platform
 * adapters live in each application; the visual decisions live here.
 */
export const mineralPalette = {
  plumb: '#163B50',
  plumbDeep: '#0F2C3C',
  plumbPressed: '#0C2533',
  lime: '#D8E568',
  limeSoft: '#F3F7D5',

  basalt: '#142522',
  slate: '#52615B',
  mistText: '#6E7A75',

  limestone: '#F4F1E8',
  mineralWhite: '#FFFEFB',
  fog: '#E4E7E1',
  fogStrong: '#C9D0CA',

  success: '#2D7A4B',
  successSoft: '#E8F4EC',
  danger: '#B23A3A',
  dangerSoft: '#FAEAEA',
  warning: '#986014',
  warningSoft: '#FBF1DD',
  info: '#2D66A8',
  infoSoft: '#E9F0F8',
  neutral: '#52615B',
  neutralSoft: '#EEF0EC',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 37, 34, 0.58)',
} as const;

export const mineralColors = {
  brand: mineralPalette.plumb,
  brandDeep: mineralPalette.plumbDeep,
  brandPressed: mineralPalette.plumbPressed,
  accent: mineralPalette.lime,
  accentSoft: mineralPalette.limeSoft,

  canvas: mineralPalette.limestone,
  surface: mineralPalette.mineralWhite,
  surfaceSecondary: mineralPalette.fog,
  border: mineralPalette.fog,
  borderStrong: mineralPalette.fogStrong,

  text: mineralPalette.basalt,
  textSecondary: mineralPalette.slate,
  textMuted: mineralPalette.mistText,

  success: mineralPalette.success,
  successSoft: mineralPalette.successSoft,
  danger: mineralPalette.danger,
  dangerSoft: mineralPalette.dangerSoft,
  warning: mineralPalette.warning,
  warningSoft: mineralPalette.warningSoft,
  info: mineralPalette.info,
  infoSoft: mineralPalette.infoSoft,
  neutral: mineralPalette.neutral,
  neutralSoft: mineralPalette.neutralSoft,
  focus: mineralPalette.lime,
  overlay: mineralPalette.overlay,
} as const;

export const mineralSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const mineralRadius = {
  control: 6,
  card: 12,
  feature: 20,
  full: 9999,
} as const;

export const mineralBreakpoints = {
  mobile: 767,
  tablet: 768,
  desktop: 1200,
  maxContent: 1440,
  maxForm: 760,
} as const;

export const mineralMotion = {
  quick: 120,
  standard: 180,
  deliberate: 220,
} as const;

export const statusTones = {
  pending: 'neutral',
  inProgress: 'info',
  conforming: 'success',
  nonConforming: 'danger',
  attention: 'warning',
} as const;

/**
 * Canonical PrumoQ symbol geometry. The ring and tail form the Q; the centered
 * cord and faceted weight make the mark read as a plumb bob at small sizes.
 */
export const prumoSymbolGeometry = {
  viewBox: '0 0 64 64',
  ring: { cx: 32, cy: 30, radius: 20, strokeWidth: 6 },
  cordPath: 'M32 7V35',
  cordStrokeWidth: 3.2,
  weightPath: 'M32 32L38 40L35 47L32 53L29 47L26 40Z',
  tailPath: 'M46.5 44.5L55 53',
  tailStrokeWidth: 6,
} as const;

export type MineralColorToken = keyof typeof mineralColors;
export type StatusTone = typeof statusTones[keyof typeof statusTones];

export interface PrumoTheme {
  colors: typeof mineralColors;
  palette: typeof mineralPalette;
  spacing: typeof mineralSpacing;
  radius: typeof mineralRadius;
  breakpoints: typeof mineralBreakpoints;
  motion: typeof mineralMotion;
}

export const prumoTheme: PrumoTheme = {
  colors: mineralColors,
  palette: mineralPalette,
  spacing: mineralSpacing,
  radius: mineralRadius,
  breakpoints: mineralBreakpoints,
  motion: mineralMotion,
};
