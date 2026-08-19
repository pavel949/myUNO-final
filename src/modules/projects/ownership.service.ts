import { PrismaClient } from '@prisma/client';

/**
 * Ownership history for a unit.
 *
 * `Unit.ownerIdentityId` answers "who owns this now" and is read in about ninety
 * places, so it stays. What it could never answer is "who owned it in March",
 * and that question has money attached: an owner statement, a payout, or a fee
 * earned last year is only defensible if the platform can still say who held
 * title when it was earned.
 *
 * So the scalar becomes a denormalisation of this table rather than the fact
 * itself. Both are written in one transaction, and `ownership_period_no_overlap`
 * stops two concurrent transfers leaving a unit with two owners on one day.
 */

export interface SetUnitOwnerInput {
  unitId: string;
  /** Null hands the unit back to no recorded owner (offboarding, pre-sale). */
  ownerIdentityId: string | null;
  /** The day the new owner takes title. Defaults to today. */
  effectiveFrom?: Date;
  recordedByIdentityId?: string;
  note?: string;
}

/** Midnight UTC for the given day — periods are dates, not instants. */
function asDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Record a change of title.
 *
 * Closes the open period the day the new owner takes over, opens the next one,
 * and moves the unit's scalar to match — all in one transaction, so the two can
 * never disagree.
 */
export async function setUnitOwner(db: PrismaClient, input: SetUnitOwnerInput) {
  const { unitId, ownerIdentityId, recordedByIdentityId, note } = input;
  const effectiveFrom = asDate(input.effectiveFrom ?? new Date());

  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      select: { id: true, ownerIdentityId: true },
    });
    if (!unit) {
      throw new Error('Unit not found');
    }

    if (unit.ownerIdentityId === ownerIdentityId) {
      // Nothing changed. Recording a period here would be a lie about a
      // transfer that never happened.
      return { changed: false as const };
    }

    const open = await tx.ownershipPeriod.findFirst({
      where: { unitId, endsOn: null },
      orderBy: { startsOn: 'desc' },
    });

    if (open) {
      if (effectiveFrom < open.startsOn) {
        throw new Error(
          'Ownership cannot start before the period it replaces — correct the earlier record first.'
        );
      }
      // Half-open ranges, the same convention bookings use: the outgoing owner
      // holds up to but not including the day the incoming one takes over.
      await tx.ownershipPeriod.update({
        where: { id: open.id },
        data: { endsOn: effectiveFrom },
      });
    }

    const period = ownerIdentityId
      ? await tx.ownershipPeriod.create({
          data: {
            unitId,
            ownerIdentityId,
            startsOn: effectiveFrom,
            note,
            recordedByIdentityId,
          },
        })
      : null;

    await tx.unit.update({
      where: { id: unitId },
      data: { ownerIdentityId },
    });

    return { changed: true as const, period, closedPeriodId: open?.id ?? null };
  });
}

/**
 * Who held title on a given day, or null if nobody did.
 *
 * This is the question a statement, a payout, or a fee calculation should ask —
 * never `unit.ownerIdentityId`, which only ever describes today.
 */
export async function getOwnerAt(
  db: PrismaClient,
  unitId: string,
  on: Date
): Promise<string | null> {
  const day = asDate(on);

  const period = await db.ownershipPeriod.findFirst({
    where: {
      unitId,
      startsOn: { lte: day },
      OR: [{ endsOn: null }, { endsOn: { gt: day } }],
    },
    select: { ownerIdentityId: true },
  });

  return period?.ownerIdentityId ?? null;
}

/** The full chain of title the platform holds for a unit, oldest first. */
export async function getOwnershipHistory(db: PrismaClient, unitId: string) {
  return db.ownershipPeriod.findMany({
    where: { unitId },
    orderBy: { startsOn: 'asc' },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Open the first period for a unit that has an owner but no history — the case
 * a unit created before this table existed, or created directly through Prisma
 * rather than through `setUnitOwner`. Idempotent.
 */
export async function ensureOwnershipRecorded(
  db: PrismaClient,
  unitId: string,
  startsOn?: Date
) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { ownerIdentityId: true, createdAt: true },
  });
  if (!unit?.ownerIdentityId) return null;

  const existing = await db.ownershipPeriod.findFirst({ where: { unitId } });
  if (existing) return existing;

  return db.ownershipPeriod.create({
    data: {
      unitId,
      ownerIdentityId: unit.ownerIdentityId,
      startsOn: asDate(startsOn ?? unit.createdAt),
      note: 'Opened from unit.owner_identity_id; no earlier ownership was recorded.',
    },
  });
}
