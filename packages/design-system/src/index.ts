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
  /** Verde legível sobre o grafite (indicador de sync no cabeçalho). */
  successOnDark: '#4CC06E',
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

/**
 * Trena Suave: cantos de seixo. Chips e miniaturas em 12, controles em 16,
 * blocos internos em 20, cartões em 24, destaques em 32; botões em pílula.
 */
export const trenaRadius = {
  chip: 12,
  control: 16,
  tile: 20,
  card: 24,
  feature: 32,
  full: 9999,
} as const;

/** Bordas só em campos de formulário: cartões se separam do concreto pelo tom. */
export const trenaBorder = {
  hairline: 1,
  card: 1,
  control: 1.5,
} as const;

/**
 * Símbolo "Q de face" (PWA), numa grade de 64 unidades.
 *
 * O Q do nome com a perninha trocada por um prumo de face: cordão, taco
 * deitado e peso cilíndrico de fundo reto, com a mesma largura do taco (é o
 * que identifica a ferramenta). Fio e taco seguem a cor do Q; o peso é sempre
 * amarelo trena. Os frisos do peso só aparecem em tamanhos grandes.
 *
 * `apps/mobile/scripts/generate-brand-assets.mjs` repete estes números (roda
 * em node puro): se mudar aqui, mude lá.
 */
export const faceSymbolGeometry = {
  grid: 64,
  ring: { cx: 25, cy: 23, radius: 15, strokeWidth: 7 },
  cordTop: { x: 38, top: 33, bottom: 39, strokeWidth: 2.6 },
  taco: { x: 30.5, y: 38.5, width: 15, height: 6.5, radius: 2.4 },
  cordBottom: { x: 38, top: 45, bottom: 48, strokeWidth: 2.6 },
  weight: { x: 30.5, y: 48, width: 15, height: 13.5, bottomRadius: 2 },
  ribs: { y: [52.5, 57], strokeWidth: 1.1 },
  weightPath: 'M30.5 48H45.5V59.5Q45.5 61.5 43.5 61.5H32.5Q30.5 61.5 30.5 59.5Z',
  /** Caixa desenhada: do anel (6.5, 4.5) ao peso (45.5, 61.5). */
  visualBounds: { left: 6.5, right: 45.5, top: 4.5, bottom: 61.5 },
  /** viewBox quadrado centrado na caixa desenhada (centro 26, 33). */
  fittedViewBox: '-3 4 58 58',
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

/**
 * Ícones Seixo: traços desenhados numa grade de 24 (traço 1,8, pontas e
 * junções redondas). O PWA ainda repete estes `d` em `apps/mobile/lib/icons.tsx`;
 * o admin desenha a partir daqui (`apps/admin/src/components/icons.tsx`).
 */
export const seixoIconPaths = {
  Plumb: 'M12 2.5v5M8 7.5h8L12 21.5z',
  Home: 'M4 10.8L11 5a1.6 1.6 0 0 1 2 0l7 5.8V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z',
  LayoutGrid: 'M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
  Building2: 'M6 21V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V21M3.5 21h17M9.5 8h1M13.5 8h1M9.5 11.5h1M13.5 11.5h1M9.5 15h1M13.5 15h1M10.5 21v-2.5h3V21',
  AlertTriangle: 'M10.3 5.2a2 2 0 0 1 3.4 0l6.6 11.3a2 2 0 0 1-1.7 3H5.4a2 2 0 0 1-1.7-3zM12 10v3.5M12 16.4v.1',
  ClipboardCheck: 'M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M9.5 3.5h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zM9 13.5l2 2 4-4',
  ClipboardList: 'M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M9.5 3.5h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zM9 11h6M9 15h4',
  Star: 'M12 4.5l2.2 4.5 4.9.7-3.5 3.4.8 4.9-4.4-2.3-4.4 2.3.8-4.9-3.5-3.4 4.9-.7z',
  HardHat: 'M3.5 17.5h17M5.5 17.5V15a6.5 6.5 0 0 1 13 0v2.5M10 8.8V6.5a2 2 0 0 1 4 0v2.3',
  Ruler: 'M4.5 15.5L15.5 4.5a1.5 1.5 0 0 1 2.1 0l1.9 1.9a1.5 1.5 0 0 1 0 2.1L8.5 19.5a1.5 1.5 0 0 1-2.1 0l-1.9-1.9a1.5 1.5 0 0 1 0-2.1zM8 12l1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5',
  Landmark: 'M4 9.5L12 5l8 4.5M5 20h14M6.5 10v7M10 10v7M14 10v7M17.5 10v7',
  Users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.3a3 3 0 0 1 0 5.4M17.5 14a5.5 5.5 0 0 1 3 5',
  Layers: 'M12 4.5l7.5 4-7.5 4-7.5-4zM4.5 12.5l7.5 4 7.5-4M4.5 16.5l7.5 4 7.5-4',
  LogOut: 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h9',
  Printer: 'M7 9V4.5h10V9M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v6H7z',
  ScanLine: 'M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16M7 12h10',
  RefreshCw: 'M19 12a7 7 0 0 1-12.5 4.3M5 12a7 7 0 0 1 12.5-4.3M17.5 4v3.7h-3.7M6.5 20v-3.7h3.7',
  History: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3h3M12 8v4l2.5 2.5',
  Clock3: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4.5l3 2',
  CalendarDays: 'M6.5 6h11A1.5 1.5 0 0 1 19 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-11A1.5 1.5 0 0 1 6.5 6zM5 10.5h14M9 4v3.5M15 4v3.5M9 14.5h.01M12 14.5h.01M15 14.5h.01',
  Camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  Search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.5 16.5L20 20',
  MapPin: 'M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ChevronRight: 'M10 6l6 6-6 6',
  ChevronLeft: 'M14 6l-6 6 6 6',
  ChevronDown: 'M6 10l6 6 6-6',
  ChevronUp: 'M6 14l6-6 6 6',
  ChevronsLeft: 'M12 6l-6 6 6 6M18 6l-6 6 6 6',
  ChevronsRight: 'M12 6l6 6-6 6M6 6l6 6-6 6',
  Check: 'M5 12.5l4.5 4.5L19 7.5',
  X: 'M7 7l10 10M17 7L7 17',
  Plus: 'M12 5v14M5 12h14',
  Minus: 'M6 12h12',
  Menu: 'M4.5 7h15M4.5 12h15M4.5 17h15',
  ArrowRight: 'M5 12h14M13 6l6 6-6 6',
  ArrowLeft: 'M19 12H5M11 6l-6 6 6 6',
} as const;

export type SeixoIconName = keyof typeof seixoIconPaths;
