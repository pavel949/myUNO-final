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
   * The database ordering, when the database can express it. Price sorts are
   * intentionally absent because effective price is date/rate-plan dependent
   * and is resolved by the search pricing engine before pagination.
   */
  orderBy?: Prisma.UnitOrderByWithRelationInput[];
  /**
   * True when ordering needs each unit's review average, which lives across
   * `review` → `booking` → `unit` rather than in a column.
   */
  needsRating?: true;
  /**
   * True when ordering needs the canonical effective price, which depends on
   * the dates and rate plan and so cannot be a column ordering. The API
   * resolves prices across all candidates and orders them before paginating.
   *
   * Declared here rather than inferred from the key in the API: this catalog
   * exists so the API, the picker and the tests cannot disagree about what a
   * sort is, and a sort that simply has no ordering by oversight should not
   * look identical to one that deliberately defers it.
   */
  needsEffectivePrice?: true;
}

/**
 * Every database-expressible sort has a deterministic tie-breaker so page two
 * cannot repeat a villa page one already showed. Price ties are broken in the
 * API after canonical effective prices are resolved.
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
    needsEffectivePrice: true,
  },
  {
    key: 'price_desc',
    labelKey: 'catalog.unit_sorts.price_desc.label',
    needsEffectivePrice: true,
  },
  {
    key: 'bedrooms_desc',
    labelKey: 'catalog.unit_sorts.bedrooms_desc.label',
    orderBy: [{ bedrooms: 'desc' }, { id: 'asc' }],
  },
  {
    key: 'capacity_desc',
    labelKey: 'catalog.unit_sorts.capacity_desc.label',
    orderBy: [{ maxGuests: 'desc' }, { id: 'asc' }],
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
