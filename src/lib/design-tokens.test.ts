import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COLOR, CHART_SERIES, CHART_SEQUENTIAL, tailwindColors } from './design-tokens';

/**
 * One definition per colour.
 *
 * The canvas's first ground rule is "no hex codes outside the token file", and
 * its Phase 1 done-condition is a grep that returns nothing. It did not: nine
 * files carried hex literals, every one a *copy* of a theme value — the chart
 * palette, the OG image, the PWA manifest, an SVG trust mark, a raw HTML 404,
 * and worst of all `/design`, the page a person opens to check what the tokens
 * are.
 *
 * A copy is not a style problem. It is a value that can drift from the theme
 * with nothing to notice, because no screen renders both. This test makes the
 * rule true instead of aspirational: the theme is built from
 * `design-tokens.ts`, and no other source file may name a colour in hex.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/**
 * Colours that are not ours to define.
 *
 * Google's mark must be drawn in Google's colours — board 18 requires the
 * Google sign-in button, and re-tinting a third party's logo in andaman would
 * be both wrong and against their brand terms. This is the only exemption, and
 * it is an identity, not a style choice.
 */
const FOREIGN_BRAND_MARKS = new Set(['src/app/login/google-login-button.tsx']);

describe('the token file is the only place a colour is defined', () => {
  it('finds no hex literal anywhere else in src', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => path.slice(process.cwd().length + 1))
      .filter((path) => path !== 'src/lib/design-tokens.ts')
      .filter((path) => !FOREIGN_BRAND_MARKS.has(path))
      .filter((path) => /#[0-9a-fA-F]{6}\b/.test(readFileSync(join(process.cwd(), path), 'utf8')));

    expect(
      offenders,
      'these files name a colour in hex — import it from @/lib/design-tokens, or use the Tailwind class'
    ).toEqual([]);
  });

  it('builds the Tailwind theme from the same values the code imports', () => {
    // Not a tautology: `tailwindColors` is what Tailwind compiles into
    // `bg-brand-andaman`, and `COLOR` is what a canvas fill or an OG image
    // reads. The pairing here is the reason a swatch and a chart cannot drift.
    expect(tailwindColors.brand.andaman).toBe(COLOR.brand.andaman);
    expect(tailwindColors.surface.ivory).toBe(COLOR.surface.ivory);
    expect(tailwindColors.state.error).toBe(COLOR.state.error);
    expect(tailwindColors.chart[1]).toBe(CHART_SERIES[0]);
    expect(tailwindColors.chart['seq-5']).toBe(CHART_SEQUENTIAL[4]);
  });

  it('keeps the chart palette at the validated four, and the ramp at five', () => {
    // The four were validated together for CVD separation on paper; adding a
    // fifth series silently breaks that, which is why doc 06 says fold the
    // rest into "Other" rather than cycle the palette.
    expect(CHART_SERIES).toHaveLength(4);
    expect(CHART_SEQUENTIAL).toHaveLength(5);
    expect(new Set(CHART_SERIES).size).toBe(4);
  });

  it('never lets a status colour double as a series colour', () => {
    const statuses = new Set<string>([
      COLOR.state.success,
      COLOR.state.warning,
      COLOR.state.error,
    ]);
    for (const series of CHART_SERIES) {
      expect(statuses.has(series), `${series} is both a status and a series colour`).toBe(false);
    }
  });
});
