// Design tokens from design-system.md — mirrors CSS variables for use in StyleSheet
export const Colors = {
  brand:        '#E84A1A',
  brandDark:    '#C03A10',
  brandLight:   '#FDF0EC',
  brandMid:     '#F5784A',

  ok:           '#2E7D32',
  okBg:         '#E8F5E9',
  okMid:        '#4CAF50',
  nok:          '#C62828',
  nokBg:        '#FFEBEE',
  progress:     '#1565C0',
  progressBg:   '#E3F2FD',
  warn:         '#E65100',
  warnBg:       '#FFF3E0',
  na:           '#666666',
  naBg:         '#F2F2F2',

  // Surfaces
  surface:      '#FFFFFF',
  surface2:     '#F1EFE8',
  bg:           '#F7F6F3',

  // Text
  text:         '#1A1A18',
  textSecondary:'#5C5B57',
  textTertiary: '#9C9A93',

  // Borders
  border:       'rgba(0,0,0,0.08)',
  borderNormal: 'rgba(0,0,0,0.12)',
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
} as const;

export const FontSizes = {
  tiny:  12, // era 10
  xs:    13, // era 11
  sm:    14, // era 12
  base:  15, // era 13/14
  md:    16, // novo
  lg:    18, // era 16/17
  xl:    21, // era 19
  xxl:   24, // era 22
  title: 32, // era 28
} as const;
