import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Type, radius, elevation and motion come only from doc 06 §2.2–2.3.
 *
 * Same failure as the spacing scale (see spacing-scale.test.ts), in the other
 * token groups: `text-micro` was used 33 times and defined nowhere, so it
 * generated no CSS and every "micro" label silently inherited its parent's
 * size; `rounded-xl`, `rounded-2xl`, `shadow-lg` and `duration-700` all
 * resolved to Tailwind defaults outside the design system.
 *
 * Guard 1: these groups are set at theme level, so only doc 06 values exist.
 * Guard 2: this test fails on any utility from Tailwind's default scales that
 * the theme no longer defines, so the class never reaches review unstyled.
 */

const TYPE = ['display-hero', 'display-hero-lg', 'display-xl', 'display', 'title', 'subtitle', 'kicker',
  'body', 'body-strong', 'small', 'num', 'heading-1', 'heading-2', 'heading-3'];
const RADIUS = ['sm', 'md', 'lg', 'full', 'none'];
const SHADOW = ['card', 'float', 'none'];
const DURATION = ['DEFAULT', 'micro', 'structural'];

// Utilities from Tailwind's default scales that the theme does not define.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['type', /^text-(xs|sm|base|lg|xl|[2-9]xl|micro)$/],
  ['radius', /^rounded(-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(-(xs|xl|2xl|3xl))?$/],
  ['shadow', /^shadow(-(sm|md|lg|xl|2xl|inner))?$/],
  ['duration', /^duration-\d+$/],
];
// A bare `rounded`/`shadow` is only a class inside a class list, not prose.
const LOOKS_LIKE_CLASS_LIST = /(^|\s)(p|px|py|m|mt|mb|border|bg|text|flex|grid|inline-flex)(-|\s|$)/;
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

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

describe('design token scales (doc 06 §2.2–2.3)', () => {
  it('defines type, radius, shadow and motion at theme level, not under extend', async () => {
    const { default: config } = await import(join(process.cwd(), 'tailwind.config.ts'));
    const theme = config.theme as Record<string, Record<string, unknown>> & { extend?: Record<string, unknown> };
    for (const group of ['fontSize', 'borderRadius', 'boxShadow', 'transitionDuration']) {
      expect(theme.extend?.[group], group).toBeUndefined();
    }
    expect(Object.keys(theme.fontSize).sort()).toEqual([...TYPE].sort());
    expect(Object.keys(theme.borderRadius).sort()).toEqual([...RADIUS].sort());
    expect(Object.keys(theme.boxShadow).sort()).toEqual([...SHADOW].sort());
    expect(Object.keys(theme.transitionDuration).sort()).toEqual([...DURATION].sort());
  });

  it('no source file uses a type, radius, shadow or duration utility outside the scale', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const literal of readFileSync(file, 'utf8').matchAll(STRING_LITERAL)) {
        const body = literal[2];
        for (const token of body.split(/\s+/)) {
          const utility = token.split(':').pop() ?? '';
          for (const [group, pattern] of FORBIDDEN) {
            if (!pattern.test(utility)) continue;
            const bare = utility === 'rounded' || utility === 'shadow';
            if (bare && !LOOKS_LIKE_CLASS_LIST.test(body)) continue;
            offenders.push(`${relative(process.cwd(), file)}: ${group} ${token}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
