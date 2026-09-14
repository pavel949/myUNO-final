/**
 * The colour tokens, once (doc 06 §2.1, canvas board 01).
 *
 * Tailwind reads this file to build the theme, so `bg-brand-andaman` and
 * `COLOR.brand.andaman` are the same value by construction rather than by
 * anyone remembering. That is the whole point: the values were duplicated as
 * hex literals in nine places Tailwind classes cannot reach — a chart canvas,
 * an OG image, the PWA manifest, a raw HTML 404 response, an SVG mark — and a
 * copy is a value that can drift from the theme silently, because nothing
 * renders both side by side.
 *
 * Use a Tailwind class wherever one works. Import from here only where the
 * consumer is not CSS: canvas and SVG fills, `next/og`, the manifest, and
 * strings of HTML built on the server.
 */

export const COLOR = {
  brand: {
    andaman: '#0E4F4B',
    deep: '#0A3733',
    sun: '#D69A3A',
    sunSoft: '#E7C079',
  },
  surface: {
    ivory: '#F5EFE4',
    paper: '#FBF8F1',
  },
  text: {
    ink: '#16211F',
    stone: '#7E8C88',
    stone2: '#A7B2AE',
  },
  border: {
    line: '#E6DFD1',
    line2: '#DAD1BF',
  },
  onDark: {
    text: '#EAF2F0',
    muted: '#7FA39D',
  },
  state: {
    success: '#2F7A57',
    successSoft: '#E4EFE7',
    warning: '#B97F1F',
    warningSoft: '#F6ECD8',
    error: '#AE4E38',
    errorSoft: '#F5E4DF',
    info: '#0E4F4B',
    infoSoft: '#E3ECEA',
  },
} as const;

/**
 * Categorical chart slots, in fixed order, never cycled (doc 06 §"Data
 * visualization"). Validated against the card surface:
 *
 *   validate_palette.js "#00937F,#D69A3A,#C05840,#4477CC" --mode light --surface "#FBF8F1"
 *   → ALL CHECKS PASS (worst adjacent CVD ΔE 12.8; normal-vision 17.1).
 *
 * Slot 2 (sun gold) sits at 2.32:1 on paper, so the relief rule applies: every
 * chart ships direct labels and a table view. Status colours are never series
 * colours, and no series colour is ever worn by text.
 */
export const CHART_SERIES = ['#00937F', '#D69A3A', '#C05840', '#4477CC'] as const;

/** Sequential ramp (magnitude): andaman teal, light→dark, monotonic lightness. */
export const CHART_SEQUENTIAL = [
  '#DCEEEB',
  '#9CCFC8',
  '#5BA79E',
  '#2E7B74',
  '#0E4F4B',
] as const;

/**
 * The Tailwind `colors` block, built from the tokens above.
 *
 * The aliases are kept because they are in wide use across the product and
 * renaming every call site is a bigger change than this one; each is a second
 * name for a value defined once here, never a second value.
 */
export const tailwindColors = {
  brand: {
    andaman: COLOR.brand.andaman,
    deep: COLOR.brand.deep,
    'andaman-dark': COLOR.brand.deep,
    'andaman-soft': COLOR.state.infoSoft,
    sun: COLOR.brand.sun,
    'sun-soft': COLOR.brand.sunSoft,
  },
  surface: {
    ivory: COLOR.surface.ivory,
    paper: COLOR.surface.paper,
    background: COLOR.surface.ivory,
  },
  text: {
    ink: COLOR.text.ink,
    stone: COLOR.text.stone,
    'stone-2': COLOR.text.stone2,
    secondary: COLOR.text.stone,
  },
  border: {
    line: COLOR.border.line,
    'line-2': COLOR.border.line2,
  },
  'on-dark': {
    text: COLOR.onDark.text,
    muted: COLOR.onDark.muted,
  },
  state: {
    success: COLOR.state.success,
    'success-soft': COLOR.state.successSoft,
    warning: COLOR.state.warning,
    'warning-soft': COLOR.state.warningSoft,
    error: COLOR.state.error,
    'error-soft': COLOR.state.errorSoft,
    info: COLOR.state.info,
    'info-soft': COLOR.state.infoSoft,
  },
  chart: {
    1: CHART_SERIES[0],
    2: CHART_SERIES[1],
    3: CHART_SERIES[2],
    4: CHART_SERIES[3],
    'seq-1': CHART_SEQUENTIAL[0],
    'seq-2': CHART_SEQUENTIAL[1],
    'seq-3': CHART_SEQUENTIAL[2],
    'seq-4': CHART_SEQUENTIAL[3],
    'seq-5': CHART_SEQUENTIAL[4],
  },
} as const;
