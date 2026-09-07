import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * The guard behind Phase 1 of the design system: it is meant to be
 * impossible to write off-system code, not merely discouraged.
 *
 * Two rules from the canvas are mechanical, so they are enforced here rather
 * than left to review:
 *   1. No hex colour outside the theme file and the few files listed below.
 *   2. No px value in an inline `style` prop — widths and spacing come from
 *      the Tailwind theme.
 */

const SRC = join(process.cwd(), 'src');

/**
 * Files allowed to carry literal colours, each for a reason that cannot be
 * met by a Tailwind class. Every entry is a deliberate exception, not debt.
 */
const HEX_ALLOWED = new Set([
  // The chart token file itself. SVG `fill`/`stroke` take a value, not a
  // class, so the series and ramp live here as the single source.
  'components/viz/palette.ts',
  // The swatch catalogue — its job is to print the hex values on screen.
  'app/design/page.tsx',
  // Consumed outside CSS: the PWA manifest and the OG image renderer.
  'app/manifest.ts',
  'app/opengraph-image.tsx',
  // A hand-built HTML string served without Tailwind in scope.
  'app/[vanitySlug]/vanity.ts',
  // Google's sign-in mark. Its colours are fixed by Google's brand terms and
  // are not ours to tokenise.
  'app/login/google-login-button.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.|\.integration\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((f) => ({ rel: relative(SRC, f), body: readFileSync(f, 'utf8') }));

describe('design tokens: no off-system values', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('carries no hex colour outside the theme and its listed exceptions', () => {
    const offenders: string[] = [];
    for (const { rel, body } of files) {
      if (HEX_ALLOWED.has(rel)) continue;
      body.split('\n').forEach((line, i) => {
        // Skip comments — the tokens are often named there for reference.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        const hit = line.match(/#[0-9A-Fa-f]{6}\b/);
        if (hit) offenders.push(`${rel}:${i + 1} ${hit[0]}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('carries no px value in an inline style prop', () => {
    const offenders: string[] = [];
    for (const { rel, body } of files) {
      body.split('\n').forEach((line, i) => {
        if (/style=\{\{[^}]*\d+px/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
