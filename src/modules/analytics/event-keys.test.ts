import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { $Enums } from '@prisma/client';

/**
 * Every analytics event key used in the codebase must exist in the schema enum.
 *
 * This guard exists because one did not. `AnalyticsBeacon` posted
 * `page_viewed` to `/api/track`, which cast the key `as any` before handing it
 * to Prisma. `page_viewed` is not an `AnalyticsEventKey` — doc 13 models page
 * views as typed, per-page-kind events (`page_unit_viewed` carrying a unitId
 * to feed the listing_engagement signal), not one generic event with a path
 * string. So every page view in production raised a
 * PrismaClientValidationError, was caught, logged, and discarded. It failed
 * that way from 2026-09-05 until it was found in Vercel's runtime errors —
 * never in a test, because the `as any` removed the only thing that would
 * have objected.
 *
 * The beacon and the unauthenticated `/api/track` route are gone; the typed
 * events were already emitted server-side with real dimensions. This keeps the
 * next one from getting in.
 */
describe('analytics event keys', () => {
  const valid = new Set(Object.values($Enums.AnalyticsEventKey) as string[]);

  it('has a non-trivial enum to check against', () => {
    expect(valid.size).toBeGreaterThan(20);
  });

  it('never reintroduces the generic page_viewed key', () => {
    expect(valid.has('page_viewed')).toBe(false);
  });

  it('keeps the typed page-view events doc 13 specifies', () => {
    for (const key of [
      'page_landing_viewed',
      'page_project_viewed',
      'page_unit_viewed',
      'page_audience_viewed',
      'service_catalog_viewed',
    ]) {
      expect(valid.has(key)).toBe(true);
    }
  });

  it('every event-key string literal in src/ is a real event key', () => {
    // Two shapes reach the database. `track(db, 'key', …)` is the server-side
    // call; `eventKey: 'key'` is how the deleted beacon smuggled one through a
    // JSON body and an `as any`. Both are checked, or this guard would miss
    // exactly the bug that prompted it.
    const patterns = [
      "track\\(\\s*[A-Za-z_.]+,\\s*'[a-z_]+'",
      "eventKey:\\s*'[a-z_]+'",
    ];
    let out = '';
    for (const pattern of patterns) {
      try {
        out += execFileSync(
          'grep',
          [
            '-rhoE', pattern, 'src/',
            '--include=*.ts', '--include=*.tsx',
            // Tests describe these shapes in prose; scanning them would make
            // this guard match its own documentation.
            '--exclude=*.test.ts', '--exclude=*.test.tsx',
          ],
          { encoding: 'utf8' }
        );
      } catch {
        // grep exits 1 when nothing matches
      }
    }

    const used = Array.from(new Set(
      out.split('\n')
        .map((line) => /'([a-z_]+)'/.exec(line)?.[1])
        .filter((k): k is string => Boolean(k))
    ));

    expect(used.length).toBeGreaterThan(5);

    const unknown = used.filter((k) => !valid.has(k));
    expect(unknown, `event keys not in AnalyticsEventKey: ${unknown.join(', ')}`).toEqual([]);
  });
});
