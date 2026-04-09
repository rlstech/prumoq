import type { Config } from 'tailwindcss';

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
          DEFAULT: '#E84A1A',
          dark:    '#C03A10',
          light:   '#FDF0EC',
          mid:     '#F5784A',
        },
        ok:   { DEFAULT: '#2E7D32', bg: '#E8F5E9', mid: '#4CAF50' },
        nok:  { DEFAULT: '#C62828', bg: '#FFEBEE' },
        pg:   { DEFAULT: '#1565C0', bg: '#E3F2FD' },
        warn: { DEFAULT: '#E65100', bg: '#FFF3E0' },
        na:   { DEFAULT: '#666666', bg: '#F2F2F2' },
        // Interface surfaces
        'bg-0': '#F7F6F3',
        'bg-1': '#FFFFFF',
        'bg-2': '#F1EFE8',
        'txt':  '#1A1A18',
        'txt-2':'#5C5B57',
        'txt-3':'#9C9A93',
        sidebar: '#1A1A18',
      },
      fontSize: {
        'xs':   ['11px', { lineHeight: '1.4' }],
        'sm':   ['12px', { lineHeight: '1.4' }],
        'base': ['13px', { lineHeight: '1.5' }],
        'md':   ['15px', { lineHeight: '1.5' }],
        'lg':   ['17px', { lineHeight: '1.4' }],
        'xl':   ['19px', { lineHeight: '1.3' }],
        '2xl':  ['22px', { lineHeight: '1.3' }],
        '3xl':  ['28px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'sm': '6px',
        DEFAULT: '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
