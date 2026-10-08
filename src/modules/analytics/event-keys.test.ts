import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
      /\btrack\(\s*[A-Za-z_.]+,\s*'([a-z_]+)'/g,
      /\beventKey:\s*'([a-z_]+)'/g,
    ];
    const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      // Tests describe these shapes in prose; scanning them would make this
      // guard match its own documentation.
      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
    });
    const used = new Set<string>();
    for (const path of sourceFiles(join(process.cwd(), 'src'))) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) used.add(match[1]);
      }
    }

    expect(used.size).toBeGreaterThan(5);

    const unknown = [...used].filter((k) => !valid.has(k));
    expect(unknown, `event keys not in AnalyticsEventKey: ${unknown.join(', ')}`).toEqual([]);
  });
});
