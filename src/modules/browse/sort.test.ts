import { describe, it, expect } from 'vitest';
import { UNIT_SORTS, DEFAULT_UNIT_SORT, parseUnitSort, rankByRating } from './sort';

/**
 * Search returned everything newest-first — the order villas were entered into
 * the system, which means nothing to a guest comparing four of them.
 */
describe('unit sort catalog', () => {
  it('has a unique key and a content key for every option', () => {
    const keys = UNIT_SORTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const sort of UNIT_SORTS) {
      // The words live in the content layer, never in the catalog.
      expect(sort.labelKey).toBe(`catalog.unit_sorts.${sort.key}.label`);
    }
  });

  it('gives every option either a database ordering or a reason it cannot have one', () => {
    for (const sort of UNIT_SORTS) {
      expect(Boolean(sort.orderBy) !== Boolean(sort.needsRating)).toBe(true);
    }
  });

  it('breaks every tie, so page two never repeats page one', () => {
    // Equal rows come back in whatever order the database likes unless the
    // ordering is total — which silently duplicates villas across pages.
    for (const sort of UNIT_SORTS) {
      if (!sort.orderBy) continue;
      const last = sort.orderBy[sort.orderBy.length - 1];
      expect(Object.keys(last)).toEqual(['id']);
    }
  });
});

describe('reading a sort out of a query string', () => {
  it('defaults when nothing was asked for', () => {
    expect(parseUnitSort(null).key).toBe(DEFAULT_UNIT_SORT.key);
    expect(parseUnitSort('').key).toBe(DEFAULT_UNIT_SORT.key);
    expect(parseUnitSort(undefined).key).toBe(DEFAULT_UNIT_SORT.key);
  });

  it('falls back rather than failing on a value it does not know', () => {
    // A stale bookmark should still show villas. Refusing to search because the
    // ordering was misspelt helps nobody.
    expect(parseUnitSort('price_ascending').key).toBe(DEFAULT_UNIT_SORT.key);
    expect(parseUnitSort('; drop table unit').key).toBe(DEFAULT_UNIT_SORT.key);
  });

  it('returns what was asked for', () => {
    expect(parseUnitSort('price_asc').orderBy?.[0]).toEqual({ baseNightlyThb: 'asc' });
    expect(parseUnitSort('top_rated').needsRating).toBe(true);
  });
});

describe('ranking by rating', () => {
  const at = (iso: string) => new Date(iso);

  it('puts the better-reviewed villa first', () => {
    const ranked = rankByRating([
      { id: 'b', averageRating: 4.1, reviewCount: 10, createdAt: at('2026-01-01') },
      { id: 'a', averageRating: 4.9, reviewCount: 10, createdAt: at('2026-01-01') },
    ]);

    expect(ranked.map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('sorts an unreviewed villa last, not as a zero', () => {
    // Treating unknown as zero buries every villa in its first season below one
    // villa with a single grudging review.
    const ranked = rankByRating([
      { id: 'new', averageRating: null, reviewCount: 0, createdAt: at('2026-06-01') },
      { id: 'poor', averageRating: 1, reviewCount: 3, createdAt: at('2026-01-01') },
    ]);

    expect(ranked.map((u) => u.id)).toEqual(['poor', 'new']);
  });

  it('prefers the villa that earned the same average more often', () => {
    const ranked = rankByRating([
      { id: 'few', averageRating: 4.8, reviewCount: 2, createdAt: at('2026-01-01') },
      { id: 'many', averageRating: 4.8, reviewCount: 40, createdAt: at('2026-01-01') },
    ]);

    expect(ranked.map((u) => u.id)).toEqual(['many', 'few']);
  });

  it('is total, so the same set always ranks the same way', () => {
    const identical = [
      { id: 'z', averageRating: null, reviewCount: 0, createdAt: at('2026-01-01') },
      { id: 'a', averageRating: null, reviewCount: 0, createdAt: at('2026-01-01') },
    ];

    expect(rankByRating(identical).map((u) => u.id)).toEqual(['a', 'z']);
    expect(rankByRating([...identical].reverse()).map((u) => u.id)).toEqual(['a', 'z']);
  });

  it('leaves the caller-s array alone', () => {
    const input = [
      { id: 'b', averageRating: 1, reviewCount: 1, createdAt: at('2026-01-01') },
      { id: 'a', averageRating: 5, reviewCount: 1, createdAt: at('2026-01-01') },
    ];
    rankByRating(input);

    expect(input.map((u) => u.id)).toEqual(['b', 'a']);
  });
});
