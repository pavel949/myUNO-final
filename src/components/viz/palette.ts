/**
 * Chart palette — doc 06 §"Data visualization".
 *
 * The values live in `src/lib/design-tokens.ts`, which Tailwind also reads, so
 * a chart series and its `bg-chart-1` swatch cannot drift apart. This module
 * re-exports them under the names the chart components already use, and adds
 * the chrome colours and the THB formatters.
 *
 * Rules (doc 06): assign slots in fixed order, never cycled; ≤4 series, fold
 * the rest into "Other"; status colors (state.*) are never series colors;
 * text always wears text tokens, never a series color.
 */

import { COLOR, CHART_SERIES, CHART_SEQUENTIAL } from '@/lib/design-tokens';

export { CHART_SERIES, CHART_SEQUENTIAL };

/** Chart chrome. */
export const CHART_GRID = COLOR.border.line; // hairline gridlines
export const CHART_AXIS_TEXT = COLOR.text.stone;
export const CHART_INK = COLOR.text.ink; // direct labels
export const CHART_SURFACE = COLOR.surface.paper; // spacer gaps ring

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
