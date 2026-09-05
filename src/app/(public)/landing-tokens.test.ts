import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const landing = readFileSync(join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8');

describe('landing tokens (Claude Design board 04)', () => {
  it('sits on ivory rather than white', () => {
    expect(landing).toContain('bg-surface-ivory');
    expect(landing).not.toContain('bg-white');
  });

  it('uses the ring-and-point mark, not a check glyph', () => {
    expect(landing).toContain('TrustMark');
    expect(landing).not.toContain('✓');
  });

  it('uses the sun kicker on the hero', () => {
    expect(landing).toContain('text-kicker');
    expect(landing).toContain('text-brand-sun-soft');
  });
});
