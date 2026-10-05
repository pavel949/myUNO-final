import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const list = read('src/app/homes/page.tsx');
const detail = read('src/app/homes/[id]/page.tsx');

describe('Stitch long-term surface adaptation', () => {
  it('uses lease-first discovery and contextual rails on canonical commercial homes', () => {
    expect(list).toContain("name=\"moveIn\"");
    expect(list).toContain("name=\"leaseTermMonths\"");
    expect(list).toContain("name=\"pets\"");
    expect(list).toContain("home.leaseTerms.minimumLeaseMonths");
    expect(list).toContain("lg:sticky lg:top-96");
    expect(detail).toContain("home.leaseTerms.monthlyRentThb");
    expect(detail).toContain("homes.detail.responsibility");
    expect(detail).toContain("href=\"#lead-form\"");
  });

  it('does not copy unsupported claims from the visual reference', () => {
    const source = (list + detail).toLowerCase();
    for (const unsupported of [
      'escrow guarantee',
      '24/7 legal',
      'no intermediary markup',
      'no agency markup',
      'first payment calculator',
    ]) {
      expect(source).not.toContain(unsupported);
    }
  });
});
