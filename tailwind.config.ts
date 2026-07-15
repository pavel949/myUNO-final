import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors (doc 06 §2.1)
        brand: {
          andaman: '#0E4F4B',
          deep: '#0A3733',
          // Alias of brand.deep — widely used in page gradients
          'andaman-dark': '#0A3733',
          sun: '#D69A3A',
          'sun-soft': '#E7C079',
        },
        // Surfaces (doc 06 §2.1: ivory = page background, paper = cards)
        surface: {
          ivory: '#F5EFE4',
          paper: '#FBF8F1',
          // Alias of surface.ivory — the page background
          background: '#F5EFE4',
        },
        // Text
        text: {
          ink: '#16211F',
          stone: '#7E8C88',
          'stone-2': '#A7B2AE',
          // Alias of text.stone — secondary copy
          secondary: '#7E8C88',
        },
        // Borders
        border: {
          line: '#E6DFD1',
          'line-2': '#DAD1BF',
        },
        // On dark surfaces
        'on-dark': {
          text: '#EAF2F0',
          muted: '#7FA39D',
        },
        // Functional states
        state: {
          success: '#2F7A57',
          'success-soft': '#E4EFE7',
          warning: '#B97F1F',
          'warning-soft': '#F6ECD8',
          error: '#AE4E38',
          'error-soft': '#F5E4DF',
          info: '#0E4F4B',
          'info-soft': '#E3ECEA',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
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
    },
  },
  plugins: [],
};

export default config;
