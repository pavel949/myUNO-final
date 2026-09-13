import { Prisma } from '@prisma/client';

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
  orderBy?: Prisma.UnitOrderByWithRelationInput[];
  needsRating?: true;
  /** Price ordering is resolved after canonical InventoryCategory/RatePlan pricing. */
  needsPrice?: true;
}

export const UNIT_SORTS: readonly UnitSort[] = [
  {
    key: 'recommended',
    labelKey: 'catalog.unit_sorts.recommended.label',
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  },
  {
    key: 'price_asc',
    labelKey: 'catalog.unit_sorts.price_asc.label',
    needsPrice: true,
  },
  {
    key: 'price_desc',
    labelKey: 'catalog.unit_sorts.price_desc.label',
    needsPrice: true,
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
