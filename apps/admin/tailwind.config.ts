import type { Config } from 'tailwindcss';
import { trenaPalette } from '@prumoq/design-system';

/**
 * Identidade Trena Suave (a mesma do PWA) na densidade de mesa.
 * As chaves são as do antigo Prumo Mineral, para as telas não mudarem de classe.
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: trenaPalette.graphite,
          dark: trenaPalette.graphiteDeep,
          light: trenaPalette.tapeYellowSoft,
          mid: trenaPalette.tapeYellow,
          line: trenaPalette.graphiteLine,
        },
        accent: {
          DEFAULT: trenaPalette.tapeYellow,
          pressed: trenaPalette.tapeYellowPressed,
          soft: trenaPalette.tapeYellowSoft,
        },
        ok: { DEFAULT: trenaPalette.success, bg: trenaPalette.successSoft, mid: trenaPalette.success },
        nok: { DEFAULT: trenaPalette.danger, bg: trenaPalette.dangerSoft },
        pg: { DEFAULT: trenaPalette.info, bg: trenaPalette.infoSoft },
        warn: { DEFAULT: trenaPalette.warning, bg: trenaPalette.warningSoft },
        na: { DEFAULT: trenaPalette.neutral, bg: trenaPalette.neutralSoft },
        // Superfícies
        'bg-0': trenaPalette.concrete,
        'bg-1': trenaPalette.white,
        'bg-2': trenaPalette.concreteDeep,
        'bg-hover': '#F6F5F2',
        // Bordas: divisor no tom do concreto; contorno de campo em junta.
        'brd-0': trenaPalette.concrete,
        'brd-1': trenaPalette.joint,
        'brd-2': trenaPalette.jointStrong,
        'txt': trenaPalette.graphite,
        'txt-2': trenaPalette.steel,
        // Um pouco mais escuro que steelMuted: passa 4,5:1 também sobre o concreto.
        'txt-3': '#646A71',
        sidebar: trenaPalette.graphite,
        'on-brand': trenaPalette.steelLight,
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['15px', { lineHeight: '22px' }],
        'md': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '26px' }],
        'xl': ['22px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '34px' }],
        '3xl': ['36px', { lineHeight: '40px' }],
      },
      borderRadius: {
        'sm': '8px',
        DEFAULT: '12px',
        'md': '16px',
        'lg': '20px',
        'xl': '24px',
        '2xl': '32px',
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        wordmark: ['"Barlow Condensed"', 'Figtree', 'sans-serif'],
      },
      boxShadow: {
        card: 'none',
        float: '0 24px 60px rgba(28,31,34,.22)',
      },
    },
  },
  plugins: [],
};

export default config;
