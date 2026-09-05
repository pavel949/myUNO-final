import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const buying = readFileSync(join(process.cwd(), 'src/app/buying/page.tsx'), 'utf8');
const juristic = readFileSync(join(process.cwd(), 'src/app/juristic/page.tsx'), 'utf8');

describe('buy and juristic tokens (Claude Design board 08)', () => {
  it('sits buying on ivory with a display title', () => {
    expect(buying).toContain('bg-surface-ivory');
    expect(buying).toContain('text-display-xl');
    expect(buying).toContain('buying.structure_body');
  });

  it('does not invent a sale price or lease term', () => {
    expect(buying).not.toContain('฿12M');
    expect(buying).not.toContain('30-year');
  });

  it('uses chips and readable dates on the juristic board', () => {
    expect(juristic).toContain('bg-surface-ivory');
    expect(juristic).toContain('Chip');
    expect(juristic).toContain('toLocaleDateString');
    expect(juristic).not.toContain('sv-SE');
    expect(juristic).not.toContain('text-xsmall');
  });
});
