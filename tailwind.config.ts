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
    // Spacing is set at theme level, not under `extend`, so off-scale values
    // (e.g. `py-10`) do not exist at all — under `extend` Tailwind's rem
    // defaults leaked through and `py-10` rendered 40px instead of 10px
    // (doc 06 §2.3: out-of-system values are physically unavailable).
    spacing: {
      // 4-based scale (doc 06 §2.3)
      0: '0px',
      px: '1px',
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
    // Type, radius, elevation and motion are also set at theme level: only the
    // doc 06 §2.2/§2.3 values exist, so `text-sm`, `rounded-xl`, `shadow-lg`
    // or `duration-500` generate no CSS (an undefined class such as the old
    // `text-micro` silently inherited its parent's size).
    fontSize: {
      // Typography (doc 06 §2.2)
      'display-hero': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      'display-hero-lg': ['56px', { lineHeight: '64px', letterSpacing: '-0.02em' }],
      'display-xl': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em' }],
      'display': ['28px', { lineHeight: '34px' }],
      'title': ['20px', { lineHeight: '26px', fontWeight: '600' }],
      'subtitle': ['16px', { lineHeight: '24px', fontWeight: '500' }],
      'kicker': ['12px', { lineHeight: '16px', letterSpacing: '0.16em', fontWeight: '500' }],
      'body': ['15px', { lineHeight: '23px' }],
      'body-strong': ['15px', { lineHeight: '23px', fontWeight: '600' }],
      'small': ['13px', { lineHeight: '19px' }],
      'num': ['15px', { fontWeight: '500' }],
      // Heading aliases of the doc 06 scale (display-xl / display / title)
      'heading-1': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '600' }],
      'heading-2': ['28px', { lineHeight: '34px', fontWeight: '600' }],
      'heading-3': ['20px', { lineHeight: '26px', fontWeight: '600' }],
    },
    borderRadius: {
      sm: '8px',
      md: '8px',
      lg: '16px',
      full: '9999px',
      none: '0px',
    },
    boxShadow: {
      card: '0 4px 20px -2px rgba(17, 56, 46, 0.06)',
      float: '0 10px 30px -4px rgba(17, 56, 46, 0.12)',
      none: 'none',
    },
    transitionDuration: {
      DEFAULT: '150ms',
      micro: '150ms',
      structural: '250ms',
    },
    extend: {
      colors: tailwindColors,
      fontFamily: {
        numeric: ['var(--font-outfit)', 'var(--font-manrope)', 'sans-serif'],
        display: [
          'var(--font-display-active)',
          'var(--font-manrope)',
          'var(--font-noto-thai)',
          'sans-serif',
        ],
        body: ['var(--font-manrope)', 'var(--font-noto-thai)', 'sans-serif'],
        sans: ['var(--font-manrope)', 'var(--font-noto-thai)', 'sans-serif'],
      },
      fontWeight: {
        display: '600',
        title: '600',
        subtitle: '500',
        body: '400',
        'body-strong': '600',
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
    },
  },
  plugins: [],
};

export default config;
