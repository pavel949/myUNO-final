# myUNO Design Tokens & Tailwind Theme Specification
**Target Environment:** Claude Code / Cursor / Next.js / Tailwind CSS v3 & v4  
**Design System Name:** Andaman Sanctuary & Architectural Living  
**Date:** October 2026 | **Version:** 2.4-canonical

---

## 1. Quick Start: Tailwind Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
      },
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        brand: {
          primary: '#11382e',      // Andaman Emerald / Deep Pine
          'primary-hover': '#0c2821',
          'primary-light': '#184d3f',
          surface: '#effcf9',      // Soft Mint-Ivory background
          'surface-dim': '#cfddd9', // Border and muted lines
          'surface-card': '#ffffff',// Elevated cards and sheets
          'surface-subtle': '#e9f5f2', // Nested container / secondary item
          brass: '#d19a5b',        // Amber Brass / Luxury Accent
          'brass-hover': '#b88244',
          'brass-light': '#fdf6ee',
        },
        navy: {
          deep: '#081713',         // PMS & SuperAdmin Sidebar Background
          card: '#0f241e',         // Dark Mode Card Background
          hover: '#18382f',        // Dark Mode Hover Highlight
          border: '#1d4237',       // Dark Mode Subtlety
        },
        status: {
          success: '#10b981',      // Clean / Confirmed / TM.30 OK
          'success-bg': '#ecfdf5',
          warning: '#f59e0b',      // Pending Audit / Inspection needed
          'warning-bg': '#fffbeb',
          danger: '#ef4444',       // Out of Order (OOD) / Work Order urgent
          'danger-bg': '#fef2f2',
          info: '#0284c7',          // Informational note / OTA sync
          'info-bg': '#f0f9ff',
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        sans: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        DEFAULT: '8px',          // ROUND_EIGHT standard
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        pill: '9999px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(17, 56, 46, 0.05)',
        card: '0 4px 20px -2px rgba(17, 56, 46, 0.06)',
        dropdown: '0 10px 30px -4px rgba(17, 56, 46, 0.12)',
        modal: '0 20px 40px -8px rgba(17, 56, 46, 0.20)',
        'glow-brass': '0 0 16px rgba(209, 154, 91, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 2. Global CSS Variables (`globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand Foundation */
    --color-primary: #11382e;
    --color-primary-rgb: 17, 56, 46;
    --color-primary-hover: #0c2821;
    --color-primary-light: #184d3f;

    /* Surfaces */
    --color-surface-base: #effcf9;
    --color-surface-card: #ffffff;
    --color-surface-subtle: #e9f5f2;
    --color-surface-dim: #cfddd9;

    /* Accent & Metals */
    --color-brass: #d19a5b;
    --color-brass-light: #fdf6ee;
    --color-brass-hover: #b88244;

    /* Dark Consoles (PMS / SuperAdmin Sidebar) */
    --color-sidebar-bg: #081713;
    --color-sidebar-card: #0f241e;
    --color-sidebar-hover: #18382f;
    --color-sidebar-border: #1d4237;

    /* Text & Contrasts */
    --color-text-main: #0c2821;
    --color-text-secondary: #4a635d;
    --color-text-muted: #7d9690;
    --color-text-inverse: #effcf9;

    /* Standard Radius */
    --radius-default: 8px;
    --radius-card: 16px;
    --radius-pill: 9999px;
  }
}

/* Tabular figures for PMS Tape Chart, Folios & Financial P&L */
.font-tabular {
  font-variant-numeric: tabular-nums;
}

/* Custom scrollbars for PMS & Tape Charts */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: var(--color-surface-subtle);
}
::-webkit-scrollbar-thumb {
  background: var(--color-surface-dim);
  border-radius: var(--radius-pill);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
```

---

## 3. Typography Hierarchy

| Role | Font Family | Tailwind Classes | Usage Example |
|---|---|---|---|
| **Hero & Display** | Outfit | `font-display text-4xl sm:text-5xl font-bold tracking-tight text-brand-primary` | Заголовки лендингов, Hero на главной |
| **Section Title** | Outfit | `font-display text-2xl lg:text-3xl font-bold text-brand-primary` | Названия секций («Комплексы», «Манифест») |
| **Card Heading** | Outfit | `font-display text-lg lg:text-xl font-semibold text-brand-primary` | Названия апартаментов, вилл, услуг |
| **Metric / KPI** | Outfit + Tabular | `font-display text-3xl font-bold font-tabular text-brand-primary` | ฿12,450, 94.2% загрузка фонда |
| **UI Body Main** | Manrope | `font-sans text-sm sm:text-base font-normal text-brand-primary/90 leading-relaxed` | Описания, статьи, правила |
| **Subtle Label** | Manrope | `font-sans text-xs font-medium uppercase tracking-wider text-brand-primary/60` | Подписи полей формы, заголовки колонок |
| **Monospace / ID** | Mono | `font-mono text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded` | Фолио `#UN-84920`, замки Salto KS |

---

## 4. Canonical Reusable UI Component Recipes

### Primary Button (Andaman Emerald CTA)
```tsx
<button className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-brand-primary text-brand-surface font-sans text-sm font-semibold hover:bg-brand-primary-hover active:scale-[0.98] transition shadow-subtle">
  <span>Забронировать</span>
</button>
```

### Luxury Accent Button (Brass)
```tsx
<button className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-brand-brass text-white font-sans text-sm font-semibold hover:bg-brand-brass-hover active:scale-[0.98] transition shadow-subtle">
  <span>Получить расчет ROI</span>
</button>
```

### White Elevated Card
```tsx
<div className="bg-brand-surface-card border border-brand-surface-dim/70 rounded-2xl p-6 shadow-card hover:shadow-dropdown transition-all">
  {/* Card Content */}
</div>
```

### Operational Status Badges (Pills)
```tsx
{/* Success / Clean */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
  Чисто / Готов к заселению
</span>

{/* In-House / Active */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
  Проживает (In-House)
</span>

{/* Out of Order / Urgent */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
  Ремонт / OOD
</span>
```

### PMS & SuperAdmin Dark Navigation Item
```tsx
<a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-surface-dim hover:text-white hover:bg-navy-hover transition-colors">
  <IconTapeChart className="w-4 h-4 text-brand-brass" />
  <span>Шахматка бронирований</span>
</a>
```

---

## 5. Instructions for Claude Code / Cursor

1. Поместите `tailwind.config.ts` в корень Next.js проекта или объедините с существующим объектом конфигурации.
2. Убедитесь, что шрифты **Outfit** и **Manrope** подключены через `next/font/google` в `src/app/layout.tsx`.
3. Для всех таблиц, графиков бронирований (Tape Chart) и финансовых показателей используйте утилиту `font-tabular` для устранения дёргания ширины цифр.
4. Основные интерактивные элементы и модальные окна должны использовать скругление `rounded-lg` (8px) или `rounded-2xl` (16px), сохраняя строгий архитектурный ритм без чрезмерных скруглений.
