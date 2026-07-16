/**
 * Chart palette — doc 06 §"Data visualization".
 *
 * Categorical slots were validated with the dataviz palette validator against
 * the card surface (surface.paper #FBF8F1, light mode):
 *   validate_palette.js "#00937F,#D69A3A,#C05840,#4477CC" --mode light --surface "#FBF8F1"
 *   → ALL CHECKS PASS (worst adjacent CVD ΔE 12.8; normal-vision 17.1).
 * Slot 2 (sun gold) sits at 2.32:1 contrast on paper — the relief rule
 * applies: every chart ships direct labels and a table view.
 *
 * Rules (doc 06): assign slots in fixed order, never cycled; ≤4 series, fold
 * the rest into "Other"; status colors (state.*) are never series colors;
 * text always wears text tokens, never a series color.
 */

/** Categorical series slots, fixed order. */
export const CHART_SERIES = ['#00937F', '#D69A3A', '#C05840', '#4477CC'] as const;

/** Sequential ramp (magnitude): andaman teal, light→dark, monotonic lightness. */
export const CHART_SEQUENTIAL = [
  '#DCEEEB',
  '#9CCFC8',
  '#5BA79E',
  '#2E7B74',
  '#0E4F4B',
] as const;

/** Chart chrome. */
export const CHART_GRID = '#E6DFD1'; // border.line — hairline gridlines
export const CHART_AXIS_TEXT = '#7E8C88'; // text.stone
export const CHART_INK = '#16211F'; // text.ink — direct labels
export const CHART_SURFACE = '#FBF8F1'; // surface.paper — spacer gaps ring

/** Format THB without decimals, e.g. ฿12,500. */
export function formatThb(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact THB for axis/direct labels, e.g. ฿12.5k. */
export function formatThbCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `฿${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  return `฿${Math.round(value)}`;
}
