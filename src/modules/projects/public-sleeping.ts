import type { Prisma } from '@prisma/client';

/** Public documentary facts only. Never select free-text names, notes or access data. */
export const PUBLIC_SLEEPING_SPACES_QUERY = {
  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  select: { spaceType: true, sortOrder: true, beds: {
    orderBy: { bedType: 'asc' }, select: { bedType: true, count: true },
  } },
} satisfies Prisma.SleepingSpaceFindManyArgs;

export const PUBLIC_BED_TYPES = ['double', 'king', 'queen', 'single', 'sofa_bed'] as const;
export type PublicBedType = typeof PUBLIC_BED_TYPES[number];
export type PublicSleepingSpace = {
  spaceType: 'bedroom' | 'living_room';
  sortOrder: number;
  beds: Array<{ bedType: PublicBedType; count: number }>;
};

type SleepingRow = { spaceType: string; sortOrder: number; beds: Array<{ bedType: string; count: number }> };

/** Explicit output allowlist also protects against extra fields returned by a mock/reader. */
export function publicSleepingSpaces(rows: readonly SleepingRow[] = []): PublicSleepingSpace[] {
  return rows.flatMap((row): PublicSleepingSpace[] => {
    if (row.spaceType !== 'bedroom' && row.spaceType !== 'living_room') return [];
    if (!Number.isSafeInteger(row.sortOrder) || row.sortOrder < 0) return [];
    const beds = row.beds.filter(bed => PUBLIC_BED_TYPES.includes(bed.bedType as PublicBedType) &&
      Number.isSafeInteger(bed.count) && bed.count > 0)
      .map(bed => ({ bedType: bed.bedType as PublicBedType, count: bed.count }));
    if (!beds.length) return [];
    return [{ spaceType: row.spaceType, sortOrder: row.sortOrder, beds }];
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}
