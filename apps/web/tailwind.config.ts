import type { Config } from 'tailwindcss';
import { mineralPalette } from '@prumoq/design-system';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: mineralPalette.plumb,
          dark: mineralPalette.plumbDeep,
          light: mineralPalette.limeSoft,
          mid: mineralPalette.lime,
        },
        accent: {
          DEFAULT: mineralPalette.lime,
          soft: mineralPalette.limeSoft,
        },
        ok: { DEFAULT: mineralPalette.success, bg: mineralPalette.successSoft, mid: mineralPalette.success },
        nok: { DEFAULT: mineralPalette.danger, bg: mineralPalette.dangerSoft },
        pg: { DEFAULT: mineralPalette.info, bg: mineralPalette.infoSoft },
        warn: { DEFAULT: mineralPalette.warning, bg: mineralPalette.warningSoft },
        na: { DEFAULT: mineralPalette.neutral, bg: mineralPalette.neutralSoft },
        // Interface surfaces
        'bg-0': mineralPalette.limestone,
        'bg-1': mineralPalette.mineralWhite,
        'bg-2': mineralPalette.fog,
        'txt': mineralPalette.basalt,
        'txt-2': mineralPalette.slate,
        'txt-3': mineralPalette.mistText,
        sidebar: mineralPalette.basalt,
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['13px', { lineHeight: '18px' }],
        'base': ['15px', { lineHeight: '22px' }],
        'md': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '26px' }],
        'xl': ['22px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '34px' }],
        '3xl': ['40px', { lineHeight: '44px' }],
      },
      borderRadius: {
        'sm': '6px',
        DEFAULT: '6px',
        'lg': '12px',
        'xl': '20px',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,37,34,.05)',
        float: '0 18px 50px rgba(20,37,34,.16)',
      },
    },
  },
  plugins: [],
};

export default config;
