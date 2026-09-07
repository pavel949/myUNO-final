import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Money reaches the screen through one door, and arrives in satang.
 *
 * `MoneyAmount` states the contract in its own header — "every caller hands
 * satang, MoneyAmount divides by 100 and renders baht. Never pass an
 * already-divided baht number here" — and `formatBaht` prefixes the ฿ sign
 * itself. Both were violated, in opposite directions, on live screens:
 *
 *   - the unit detail page multiplied an already-satang column by 100 before
 *     handing it to `MoneyAmount`, rendering a ฿5,479 villa at ฿547,900;
 *   - the provider remittances table wrote `฿{formatBaht(...)}`, rendering
 *     `฿฿1,234`.
 *
 * Neither is catchable by types — both sides are `number` — and neither breaks
 * a test, because the component renders whatever arithmetic it is handed. They
 * are catchable by reading the source, which is what this does.
 *
 * This is deliberately narrow. It does not try to decide whether an arbitrary
 * value is satang or baht: that depends on which service produced it, and this
 * codebase converts in the page or the API route and renders raw in the client,
 * so a blanket rule would be mostly false positives. It pins only the two
 * shapes that are wrong no matter where the number came from.
 */

const SRC_ROOT = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

const files = sourceFiles(SRC_ROOT).map((path) => ({
  path: path.slice(process.cwd().length + 1),
  source: readFileSync(path, 'utf8'),
}));

describe('the money display boundary', () => {
  it('finds source files to check (the scan still works)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  /**
   * Screens that multiply back up to satang before rendering.
   *
   * Each one is correct today, because the producer behind it converted to
   * baht first: `owner.service.ts` returns `revenueThisMonth` through
   * `satangToBaht`, and `/api/pricing/breakdown` divides every line at its
   * response boundary. The multiplication puts back what they took away.
   *
   * They are listed rather than allowed silently because the round trip is
   * the shape these bugs grow in. It is lossy — `satangToBaht` rounds, so
   * satang → baht → satang is not an identity — and it means a component can
   * hold two values of the same name in two different units. That is exactly
   * what happened in `unit-client.tsx`: `breakdown.total` arrives in baht from
   * the pricing route and needs the ×100, while `unit.baseNightlyThb` arrives
   * in raw satang from `getPublicUnitById` and had one anyway, rendering a
   * ฿5,479 villa at ฿547,900.
   *
   * The durable fix is for those producers to keep satang all the way to the
   * screen, at which point these entries disappear. Until then, a new entry
   * here should be justified, not just added.
   */
  const BAHT_PRODUCER_ROUND_TRIPS = new Set([
    'src/app/units/[id]/unit-client.tsx',
    'src/app/owner/client.tsx',
    'src/app/owner/units/[unitId]/client.tsx',
  ]);

  it('scales a value into MoneyAmount only where a producer already divided it', () => {
    const offenders = files
      .filter(({ source }) => /satang=\{[^}]*\*\s*100/.test(source))
      .map(({ path }) => path)
      .filter((path) => !BAHT_PRODUCER_ROUND_TRIPS.has(path));

    expect(
      offenders,
      'MoneyAmount takes satang and divides it itself — scaling a value that is already satang renders it 100x too high'
    ).toEqual([]);
  });

  it('does not let the round-trip list go stale', () => {
    const stillRoundTripping = [...BAHT_PRODUCER_ROUND_TRIPS].filter((path) =>
      files.some((file) => file.path === path && /satang=\{[^}]*\*\s*100/.test(file.source))
    );

    expect(
      stillRoundTripping.length,
      'a listed file no longer multiplies back up — remove it from BAHT_PRODUCER_ROUND_TRIPS'
    ).toBe(BAHT_PRODUCER_ROUND_TRIPS.size);
  });

  it('never prefixes a ฿ sign onto a formatter that already writes one', () => {
    const offenders = files
      .filter(({ source }) => /฿\{\s*formatBaht(Compact)?\(/.test(source))
      .map(({ path }) => path);

    expect(
      offenders,
      'formatBaht and formatBahtCompact emit the ฿ themselves — a literal ฿ in front renders ฿฿'
    ).toEqual([]);
  });
});
