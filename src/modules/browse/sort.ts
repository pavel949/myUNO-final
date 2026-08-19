import { Prisma } from '@prisma/client';

/**
 * How a list of villas is ordered.
 *
 * Search returned everything newest-first, which is the order the villas were
 * entered into the system — an internal fact with no meaning to a guest. A
 * prospect comparing four villas wants them cheapest-first, or biggest-first,
 * or best-reviewed-first, and could not ask for any of it.
 *
 * The catalog is defined once, here, so the API, the picker, and the tests
 * cannot disagree about what a valid sort is. Labels are content keys — the
 * words themselves live in the content layer (doc 05), not in this file.
 */

export type UnitSortKey =
  | 'recommended'
  | 'price_asc'
  | 'price_desc'
  | 'bedrooms_desc'
  | 'capacity_desc'
  | 'top_rated';

export interface UnitSort {
  key: UnitSortKey;
  labelKey: string;
  /**
   * The database ordering, when the database can express it. Absent for sorts
   * that need a value no column holds.
   */
  orderBy?: Prisma.UnitOrderByWithRelationInput[];
  /**
   * True when ordering needs each unit's review average, which lives across
   * `review` → `booking` → `unit` rather than in a column.
   */
  needsRating?: true;
}

/**
 * Every sort has a second key to break ties, so two villas at the same price
 * come back in the same order on every request. Without it, page two can repeat
 * a villa page one already showed — the database is free to order equal rows
 * however it likes.
 */
export const UNIT_SORTS: readonly UnitSort[] = [
  {
    key: 'recommended',
    labelKey: 'catalog.unit_sorts.recommended.label',
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  },
  {
    key: 'price_asc',
    labelKey: 'catalog.unit_sorts.price_asc.label',
    orderBy: [{ baseNightlyThb: 'asc' }, { id: 'asc' }],
  },
  {
    key: 'price_desc',
    labelKey: 'catalog.unit_sorts.price_desc.label',
    orderBy: [{ baseNightlyThb: 'desc' }, { id: 'asc' }],
  },
  {
    key: 'bedrooms_desc',
    labelKey: 'catalog.unit_sorts.bedrooms_desc.label',
    orderBy: [{ bedrooms: 'desc' }, { baseNightlyThb: 'asc' }, { id: 'asc' }],
  },
  {
    key: 'capacity_desc',
    labelKey: 'catalog.unit_sorts.capacity_desc.label',
    orderBy: [{ maxGuests: 'desc' }, { baseNightlyThb: 'asc' }, { id: 'asc' }],
  },
  {
    key: 'top_rated',
    labelKey: 'catalog.unit_sorts.top_rated.label',
    needsRating: true,
  },
] as const;

export const DEFAULT_UNIT_SORT: UnitSort = UNIT_SORTS[0];

/**
 * Read a sort out of a query string.
 *
 * An unrecognised value falls back to the default rather than failing the
 * request: a stale bookmark or a mistyped link should still show villas, and
 * refusing to search because the ordering was misspelt helps nobody.
 */
export function parseUnitSort(value: string | null | undefined): UnitSort {
  if (!value) return DEFAULT_UNIT_SORT;
  return UNIT_SORTS.find((s) => s.key === value) ?? DEFAULT_UNIT_SORT;
}

export interface RatedForSort {
  id: string;
  averageRating: number | null;
  reviewCount: number;
  createdAt: Date;
}

/**
 * Order units best-reviewed first.
 *
 * A villa nobody has reviewed sorts last, never as a zero. It is unknown, not
 * bad, and treating the two the same buries every villa on its first season
 * below one villa with a single grudging review.
 *
 * Reviews are then broken by count — between two villas averaging 4.8, the one
 * with forty reviews has earned the position more than the one with two — and
 * finally by newest, so the order is total and stable.
 */
export function rankByRating(units: readonly RatedForSort[]): RatedForSort[] {
  return [...units].sort((a, b) => {
    const aRated = a.averageRating !== null;
    const bRated = b.averageRating !== null;
    if (aRated !== bRated) return aRated ? -1 : 1;
    if (aRated && bRated && a.averageRating !== b.averageRating) {
      return (b.averageRating as number) - (a.averageRating as number);
    }
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
