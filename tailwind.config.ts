import type { Config } from 'tailwindcss';
import { tailwindColors } from './src/lib/design-tokens';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: tailwindColors,
      fontFamily: {
        display: [
          'var(--font-outfit)',
          'var(--font-manrope)',
          'var(--font-noto-thai)',
          'sans-serif',
        ],
        body: ['var(--font-manrope)', 'var(--font-noto-thai)', 'sans-serif'],
        sans: ['var(--font-manrope)', 'var(--font-noto-thai)', 'sans-serif'],
      },
      fontSize: {
        // Typography (doc 06 §2.2)
        'display-xl': ['40px', { lineHeight: '44px', letterSpacing: '-1%' }],
        'display': ['28px', { lineHeight: '34px' }],
        'title': ['20px', { lineHeight: '26px', fontWeight: '600' }],
        'subtitle': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'kicker': ['12px', { lineHeight: '16px', letterSpacing: '24%', fontWeight: '500' }],
        'body': ['15px', { lineHeight: '23px' }],
        'body-strong': ['15px', { lineHeight: '23px', fontWeight: '600' }],
        'small': ['13px', { lineHeight: '19px' }],
        'num': ['15px', { fontWeight: '500' }],
        // Heading aliases of the doc 06 scale (display-xl / display / title)
        'heading-1': ['40px', { lineHeight: '44px', letterSpacing: '-1%', fontWeight: '600' }],
        'heading-2': ['28px', { lineHeight: '34px', fontWeight: '600' }],
        'heading-3': ['20px', { lineHeight: '26px', fontWeight: '600' }],
      },
      fontWeight: {
        display: '600',
        title: '600',
        subtitle: '500',
        body: '400',
        'body-strong': '600',
      },
      spacing: {
        // 4-based scale (doc 06 §2.3)
        4: '4px',
        8: '8px',
        12: '12px',
        16: '16px',
        20: '20px',
        24: '24px',
        32: '32px',
        40: '40px',
        44: '44px',
        48: '48px',
        56: '56px',
        64: '64px',
        80: '80px',
        96: '96px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 33, 31, 0.06)',
        float: '0 8px 24px rgba(14, 79, 75, 0.16)',
      },
      transitionDuration: {
        micro: '150ms',
        structural: '250ms',
      },
      animation: {
        pulse: 'pulse 1.2s ease-in-out infinite',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      maxWidth: {
        content: '1080px',
      },
      // Button floors (board 21, the Russian pass). Buttons size from their
      // content plus padding; this is only a floor so a one-word label still
      // reads as a button. It is never a fixed width — `Забронировать` is 86%
      // longer than `Reserve` and must be allowed to grow.
      minWidth: {
        'btn-sm': '80px',
        'btn-md': '96px',
        'btn-lg': '112px',
      },
      // Fixed widths that are layout, not rhythm, so they sit outside the
      // 4-based spacing scale. `field-*` are the inline text inputs that sit
      // in a table row; `panel` is the notification popover; `thumb` is the
      // unit-list image.
      // TODO(design): board 20 replaces the inline `field-*` inputs with a
      // sheet on mobile — these widths go with that change.
      width: {
        'field-sm': '140px',
        'field-md': '150px',
        'field-lg': '200px',
        panel: '320px',
        thumb: '72px',
      },
      maxHeight: {
        panel: '360px',
      },
    },
  },
  plugins: [],
};

export default config;
