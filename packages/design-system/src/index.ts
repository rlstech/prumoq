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

/**
 * SVG do "Q de face" como texto, para HTML montado à mão (relatórios, favicon,
 * painel). `ink` pinta o Q, o fio e o taco; o peso é sempre amarelo trena.
 * `tile` desenha o ladrilho grafite de ícone de app em volta.
 */
export function faceSymbolSvg(options: {
  ink?: string;
  ribs?: boolean;
  tile?: boolean;
  className?: string;
  size?: number;
  title?: string;
} = {}): string {
  const g = faceSymbolGeometry;
  const ink = options.ink ?? (options.tile ? trenaPalette.white : trenaPalette.graphite);
  const ribs = options.ribs ?? true;
  const size = options.size ? ` width="${options.size}" height="${options.size}"` : '';
  const cls = options.className ? ` class="${options.className}"` : '';
  const a11y = options.title ? `role="img" aria-label="${options.title}"` : 'aria-hidden="true"';
  const glyph = [
    `<circle cx="${g.ring.cx}" cy="${g.ring.cy}" r="${g.ring.radius}" fill="none" stroke="${ink}" stroke-width="${g.ring.strokeWidth}"/>`,
    `<path d="M${g.cordTop.x} ${g.cordTop.top}V${g.cordTop.bottom}M${g.cordBottom.x} ${g.cordBottom.top}V${g.cordBottom.bottom}" stroke="${ink}" stroke-width="${g.cordTop.strokeWidth}"/>`,
    `<rect x="${g.taco.x}" y="${g.taco.y}" width="${g.taco.width}" height="${g.taco.height}" rx="${g.taco.radius}" fill="${ink}"/>`,
    `<path d="${g.weightPath}" fill="${trenaPalette.tapeYellow}"/>`,
    ribs
      ? `<path d="${g.ribs.y.map(y => `M${g.weight.x} ${y}H${g.weight.x + g.weight.width}`).join('')}" stroke="${trenaPalette.graphite}" stroke-width="${g.ribs.strokeWidth}"/>`
      : '',
  ].join('');
  if (!options.tile) {
    return `<svg xmlns="http://www.w3.org/2000/svg"${cls}${size} viewBox="${g.fittedViewBox}" ${a11y}>${glyph}</svg>`;
  }
  // Mesma proporção do favicon do PWA (prumoq-face.svg): marca a 78% no ladrilho de 64.
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls}${size} viewBox="0 0 64 64" ${a11y}><rect width="64" height="64" rx="13" fill="${trenaPalette.graphite}"/><g transform="translate(32 32) scale(0.78) translate(-26 -33)">${glyph}</g></svg>`;
}

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
