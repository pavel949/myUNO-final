import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Spacing comes only from the doc 06 §2.3 scale.
 *
 * The scale used to sit under `theme.extend.spacing`, which *adds* to
 * Tailwind's rem defaults instead of replacing them. Every off-scale class in
 * the codebase was written as a literal pixel value (`py-10` meaning 10px), but
 * Tailwind silently resolved it to its rem default (`py-10` = 2.5rem = 40px):
 * search chips rendered ~99px tall, badges carried 24px of vertical padding,
 * timeline dots were 40px circles. Nothing failed, so nothing noticed.
 *
 * Two guards make the rule structural instead of aspirational:
 *  1. the scale is defined at theme level, so an off-scale class generates no
 *     CSS at all (it is visibly unstyled in review, not quietly wrong);
 *  2. this test fails on any off-scale spacing utility in source, so it never
 *     reaches review in the first place.
 */

const SCALE = ['0', 'px', '4', '8', '12', '16', '20', '24', '32', '40', '44', '48', '56', '64', '80', '96'];

const SPACING_UTILITIES =
  'p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|' +
  'w|h|min-w|min-h|max-w|max-h|size|inset|inset-x|inset-y|top|right|bottom|left|start|end|' +
  'translate-x|translate-y|scroll-m|scroll-mt|scroll-mb|scroll-p|scroll-pt|basis|indent|border-spacing';

// A class token: optional variant prefixes (`md:`, `hover:`), optional
// negative, the utility, then a numeric value. Arbitrary values (`w-[240px]`)
// are a deliberate, reviewable escape hatch and are not matched.
const CLASS = new RegExp(
  `(?<![\\w\\-\\[])(?:[a-z0-9\\-\\[\\]&:]+:)*-?(?:${SPACING_UTILITIES})-(\\d+(?:\\.\\d+)?)(?![\\w.\\-/\\]])`,
  'g',
);

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

describe('spacing scale (doc 06 §2.3)', () => {
  it('is defined at theme level, replacing the defaults rather than extending them', async () => {
    // Loaded by path: the config sits outside src/, beyond the module-boundary
    // import rule, and this is the one test that must read it as built.
    const { default: config } = await import(join(process.cwd(), 'tailwind.config.ts'));
    const theme = config.theme as Record<string, unknown> & { extend?: Record<string, unknown> };
    expect(theme.extend?.spacing).toBeUndefined();
    expect(Object.keys(theme.spacing as Record<string, string>).sort()).toEqual([...SCALE].sort());
    for (const [key, value] of Object.entries(theme.spacing as Record<string, string>)) {
      expect(value).toBe(key === 'px' ? '1px' : `${key}px`);
    }
  });

  it('no source file uses an off-scale spacing utility', () => {
    const scale = new Set(SCALE);
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(CLASS)) {
        if (!scale.has(match[1])) offenders.push(`${relative(process.cwd(), file)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
