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
 * Canonical PrumoQ symbol geometry, on a 32-unit grid.
 *
 * The plumb line drops from the ring of the "O" and ends in the faceted
 * weight — the instrument the product is named after. Numeric fields exist so
 * non-SVG renderers (the React Native mark, icon generators) draw the exact
 * same shape as the SVG paths.
 */
export const prumoSymbolGeometry = {
  viewBox: '0 0 32 32',
  /** Lado da grade do viewBox, para renderizadores que nao leem SVG. */
  grid: 32,
  ring: { cx: 16, cy: 13.2, radius: 6, strokeWidth: 2.1 },
  cord: { x: 16, top: 19.2, bottom: 23.4, strokeWidth: 1.7 },
  weight: { cx: 16, cy: 25.95, halfWidth: 2.3, halfHeight: 2.75 },
  cordPath: 'M16 19.2V23.4',
  weightPath: 'M16 23.2L18.3 25.5L16 28.7L13.7 25.5Z',
  /**
   * Visual bounds of the drawn mark inside the grid — the ring starts at 6.15
   * and the weight ends at 28.7, so the optical centre sits below the centre
   * of the box. Use it to centre the mark inside a tile or an app icon.
   */
  visualBounds: { top: 6.15, bottom: 28.7, left: 8.95, right: 23.05 },
} as const;

/**
 * Trena — identidade do PWA de campo.
 *
 * Grafite e amarelo de trena: o máximo de contraste para ler sob sol. O admin
 * continua no Prumo Mineral; as chaves de `trenaColors` espelham as de
 * `mineralColors` para que o adaptador de cada app troque uma pela outra.
 */
export const trenaPalette = {
  graphite: '#1C1F22',
  graphiteDeep: '#141618',
  graphitePressed: '#0F1112',
  graphiteLine: '#3A3F44',
  tapeYellow: '#FFC21A',
  tapeYellowPressed: '#E6AC00',
  tapeYellowSoft: '#FFF3CC',

  steel: '#5B6168',
  steelMuted: '#6B7178',
  steelLight: '#B9BEC3',

  concrete: '#ECEAE6',
  concreteDeep: '#E3E0DA',
  white: '#FFFFFF',
  joint: '#CFCBC3',
  jointStrong: '#9C978E',

  success: '#1F7A3A',
  successSoft: '#E6F2E9',
  danger: '#C8281E',
  dangerSoft: '#FBE9E7',
  warning: '#B85400',
  warningSoft: '#FFF0E0',
  info: '#2459A8',
  infoSoft: '#E7EEF8',
  neutral: '#5B6168',
  neutralSoft: '#E9E8E4',

  black: '#000000',
  overlay: 'rgba(28, 31, 34, 0.62)',
} as const;

export const trenaColors = {
  brand: trenaPalette.graphite,
  brandDeep: trenaPalette.graphiteDeep,
  brandPressed: trenaPalette.graphitePressed,
  accent: trenaPalette.tapeYellow,
  accentSoft: trenaPalette.tapeYellowSoft,

  canvas: trenaPalette.concrete,
  surface: trenaPalette.white,
  surfaceSecondary: trenaPalette.concreteDeep,
  border: trenaPalette.joint,
  borderStrong: trenaPalette.jointStrong,

  text: trenaPalette.graphite,
  textSecondary: trenaPalette.steel,
  textMuted: trenaPalette.steelMuted,

  success: trenaPalette.success,
  successSoft: trenaPalette.successSoft,
  danger: trenaPalette.danger,
  dangerSoft: trenaPalette.dangerSoft,
  warning: trenaPalette.warning,
  warningSoft: trenaPalette.warningSoft,
  info: trenaPalette.info,
  infoSoft: trenaPalette.infoSoft,
  neutral: trenaPalette.neutral,
  neutralSoft: trenaPalette.neutralSoft,
  focus: trenaPalette.tapeYellow,
  overlay: trenaPalette.overlay,
} as const satisfies Record<keyof typeof mineralColors, string>;

/** Cantos quase retos: bordas no lugar de sombras. */
export const trenaRadius = {
  control: 3,
  card: 4,
  feature: 6,
  full: 9999,
} as const;

/** Espessura das bordas de cards e controles. */
export const trenaBorder = {
  hairline: 1,
  card: 1.5,
  control: 2,
} as const;

export type MineralColorToken = keyof typeof mineralColors;
export type TrenaColorToken = keyof typeof trenaColors;
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
