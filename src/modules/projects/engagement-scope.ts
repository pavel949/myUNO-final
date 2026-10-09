import type { Prisma } from '@prisma/client';

/** Current operating authority uses a half-open mandate period [start, end). */
export function currentEngagementWhere(now: Date = new Date()): Prisma.UnitEngagementWhereInput {
  return {
    status: 'active',
    AND: [
      { OR: [{ startsOn: null }, { startsOn: { lte: now } }] },
      { OR: [{ endsOn: null }, { endsOn: { gt: now } }] },
    ],
  };
}
