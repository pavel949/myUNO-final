import { PrismaClient, BookingStatus } from '@prisma/client';
import { track } from '@/modules/analytics';
import { computePriceBreakdown } from '@/modules/core';

export interface CreateBookingInput {
  unitId: string;
  projectId: string;
  guestIdentityId: string;
  bookingType: 'guest_stay' | 'owner_stay';
  channel: 'direct' | 'airbnb' | 'booking_com' | 'agoda' | 'agent' | 'manual';
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  totalThb: number;
  priceBreakdown?: Record<string, unknown>;
  cancellationPolicySnapshot?: Record<string, unknown>;
  instantBook: boolean;
  holdMinutes?: number;
  requestHours?: number;
  guestNote?: string;
}

export interface ApproveBookingRequestInput {
  bookingId: string;
  holdMinutes?: number;
}

export interface DeclineBookingRequestInput {
  bookingId: string;
  declinedByIdentityId?: string;
}

export interface ConfirmBookingInput {
  bookingId: string;
  paymentReceivedAt: Date;
}

export interface CancelBookingInput {
  bookingId: string;
  cancelledByIdentityId: string;
  reason: string;
  refundAmountThb: number;
}

// PDPA/doc 12: identity rows carry hashedPassword and PII — never include the
// raw relation in anything that reaches an API response. Select only safe fields.
export const SAFE_IDENTITY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  preferredLocale: true,
} as const;

/**
 * Create a new booking.
 * Instant bookings go to pending_payment; request-to-book go to requested.
 */
/**
 * Overlapping booking that actually blocks the dates: confirmed/checked_in,
 * or an unpaid hold that is still live. `requested` never blocks — a request
 * is non-binding until approved.
 */
/**
 * Postgres raises 23P01 when the `booking_no_overlap` exclusion constraint
 * rejects an insert or a status change — the loser of a genuine race, which the
 * pre-flight read cannot catch. Callers already understand DOUBLE_BOOK, so it
 * surfaces as that rather than as a driver-level error.
 */
/**
 * Codes Postgres and Prisma use for "you lost a concurrency fight, try again":
 * serialization failure, deadlock, and Prisma's write-conflict wrapper. They say
 * nothing about availability, so retrying is what turns them into a real answer —
 * on the second pass the winner has committed and the pre-flight read reports a
 * clean DOUBLE_BOOK instead of a driver error reaching the guest.
 */
function isTransientConflict(error: unknown): boolean {
  const seen: string[] = [];
  let cursor: unknown = error;
  for (let depth = 0; cursor && depth < 5; depth += 1) {
    const e = cursor as { message?: unknown; code?: string; cause?: unknown };
    if (typeof e.message === 'string') seen.push(e.message);
    if (typeof e.code === 'string') seen.push(e.code);
    cursor = e.cause;
  }
  const haystack = seen.join('\n');
  return (
    haystack.includes('P2034') ||
    haystack.includes('40001') ||
    haystack.includes('40P01') ||
    haystack.includes('write conflict') ||
    haystack.includes('deadlock')
  );
}

function rethrowAsDoubleBook(error: unknown): never {
  // Already the domain error (the pre-flight read won the race) — pass it through.
  if ((error as { code?: string })?.code === 'DOUBLE_BOOK') throw error;

  // Prisma surfaces the violation in more than one shape: sometimes as a known
  // request error carrying meta.code, sometimes as an unknown request error that
  // only quotes the driver text, and inside a transaction it may be wrapped again.
  // Scanning the message chain covers all of them; `cause` walks the wrapping.
  const seen: string[] = [];
  let cursor: unknown = error;
  for (let depth = 0; cursor && depth < 5; depth += 1) {
    const e = cursor as { message?: unknown; meta?: { code?: string }; code?: string; cause?: unknown };
    if (typeof e.message === 'string') seen.push(e.message);
    if (e.meta?.code) seen.push(e.meta.code);
    if (typeof e.code === 'string') seen.push(e.code);
    cursor = e.cause;
  }
  const haystack = seen.join('\n');
  const isOverlapViolation =
    haystack.includes('23P01') || haystack.includes('booking_no_overlap');

  if (isOverlapViolation) {
    const err = new Error('Dates unavailable — booking already exists');
    (err as any).code = 'DOUBLE_BOOK';
    throw err;
  }
  throw error;
}

async function findBlockingConflict(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
) {
  const now = new Date();
  return db.booking.findFirst({
    where: {
      unitId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      OR: [
        { status: { in: ['confirmed', 'checked_in'] } },
        { status: 'pending_payment', holdExpiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
}

/**
 * Every live unit of a sellable category that is free for the range (LY-6),
 * in a stable order so assignment is deterministic.
 *
 * One query, not one per unit. The old loop fetched the category then ran two
 * queries per unit, so a forty-villa category cost eighty-one round trips on
 * every search. The overlap and hold-expiry rules are the same ones
 * `findBlockingConflict` applies — a lapsed `pending_payment` hold does not
 * block, a live one does.
 *
 * Returns the whole list rather than the first match because the caller needs
 * somewhere to go when it loses a race: the availability read cannot be held
 * against a concurrent booking, and refusing the guest while a sibling villa
 * stands empty is a lost sale, not a safety measure.
 */
export async function findAvailableUnitsForCategory(
  db: PrismaClient,
  projectId: string,
  categoryKey: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ id: string; instantBook: boolean }>> {
  const now = new Date();
  const overlaps = { startDate: { lt: endDate }, endDate: { gt: startDate } };

  return db.unit.findMany({
    where: {
      projectId,
      categoryKey,
      status: 'live',
      bookings: {
        none: {
          ...overlaps,
          OR: [
            { status: { in: ['confirmed', 'checked_in'] } },
            { status: 'pending_payment', holdExpiresAt: { gt: now } },
          ],
        },
      },
      blockedDates: { none: overlaps },
    },
    orderBy: { name: 'asc' },
    select: { id: true, instantBook: true },
  });
}

/**
 * The first free unit of a category, or null. Kept as the single-answer form of
 * `findAvailableUnitsForCategory` for callers that only want a yes/no.
 */
export async function resolveUnitForCategory(
  db: PrismaClient,
  projectId: string,
  categoryKey: string,
  startDate: Date,
  endDate: Date
): Promise<{ id: string; instantBook: boolean } | null> {
  const [first] = await findAvailableUnitsForCategory(
    db,
    projectId,
    categoryKey,
    startDate,
    endDate
  );
  return first ?? null;
}

export async function createBooking(
  db: PrismaClient,
  input: CreateBookingInput
) {
  const {
    unitId,
    projectId,
    guestIdentityId,
    bookingType,
    channel,
    startDate,
    endDate,
    adults,
    children,
    totalThb,
    priceBreakdown,
    cancellationPolicySnapshot,
    instantBook,
    holdMinutes = 30,
    requestHours = 24,
    guestNote,
  } = input;

  const initialStatus: BookingStatus = instantBook ? 'pending_payment' : 'requested';
  const now = new Date();

  // Availability is decided inside one transaction, and the last word belongs to
  // the `booking_no_overlap` exclusion constraint rather than to the read below.
  // Two concurrent callers can both see a free calendar; only one can commit.
  const claimDates = () => db.$transaction(async (tx) => {
    // Serialize attempts on this unit for the life of the transaction. Without
    // it, concurrent inserts of the same range make Postgres take
    // exclusion-constraint locks in whatever order they arrive, and a stampede
    // deadlocks rather than queues — correct, because the constraint still holds
    // and the loser retries, but needlessly expensive. One lock per unit turns
    // that into an orderly queue; different units are unaffected. The lock is
    // released on commit or rollback, so no path can leak it.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;

    // The constraint cannot test `hold_expires_at > now()` (a predicate has to be
    // immutable), so a lapsed hold still occupies the range until it is retired.
    // Retiring it here means an abandoned checkout never blocks the next guest,
    // even if the scheduled expireHolds job has not run yet.
    await tx.booking.updateMany({
      where: { unitId, status: 'pending_payment', holdExpiresAt: { lte: now } },
      data: { status: 'expired', holdExpiresAt: null },
    });

    // Kept ahead of the insert so the ordinary "those dates are taken" case
    // answers with a clean domain error instead of a constraint violation.
    const conflicting = await findBlockingConflict(tx as PrismaClient, unitId, startDate, endDate);
    if (conflicting) {
      const err = new Error('Dates unavailable — booking already exists');
      (err as any).code = 'DOUBLE_BOOK';
      throw err;
    }

    // A unit can also be unavailable without a booking: an owner hold, a
    // maintenance window, or a stay imported from an OTA. `resolveUnitForCategory`
    // has always honoured these, but the direct path did not — so a villa Airbnb
    // had already sold could be sold again here. The exclusion constraint cannot
    // see across tables, which is why this check has to be inside the same
    // advisory-locked transaction rather than in front of it.
    const blocked = await tx.blockedDate.findFirst({
      where: { unitId, startDate: { lt: endDate }, endDate: { gt: startDate } },
      select: { id: true, reason: true },
    });
    if (blocked) {
      const err = new Error(`Dates unavailable — unit is blocked (${blocked.reason})`);
      (err as any).code = 'DOUBLE_BOOK';
      (err as any).blockReason = blocked.reason;
      throw err;
    }

    return tx.booking.create({
      data: {
        unitId,
        projectId,
        guestIdentityId,
        bookingType,
        channel,
        status: initialStatus,
        startDate,
        endDate,
        adults,
        children,
        totalThb,
        ...(priceBreakdown && { priceBreakdown: priceBreakdown as any }),
        ...(cancellationPolicySnapshot && { cancellationPolicySnapshot: cancellationPolicySnapshot as any }),
        holdExpiresAt: instantBook ? new Date(now.getTime() + holdMinutes * 60 * 1000) : null,
        requestExpiresAt: !instantBook ? new Date(now.getTime() + requestHours * 60 * 60 * 1000) : null,
        guestNote,
      },
      include: {
        unit: true,
        guestIdentity: { select: SAFE_IDENTITY_SELECT },
      },
    });
  });

  let booking;
  for (let attempt = 0; ; attempt += 1) {
    try {
      booking = await claimDates();
      break;
    } catch (error) {
      if (attempt < 2 && isTransientConflict(error)) continue;
      rethrowAsDoubleBook(error);
    }
  }

  // Track analytics event
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  await track(db, 'stay_booking_started', {
    bookingId: booking.id,
    unitId,
    projectId,
    identityId: guestIdentityId,
    channel,
    bookingType,
    nights,
    totalThb,
  }).catch(() => null);

  // Track request event if this is a request-to-book
  if (!instantBook) {
    await track(db, 'stay_booking_requested', {
      bookingId: booking.id,
      unitId,
      projectId,
      identityId: guestIdentityId,
      channel,
      nights,
      totalThb,
    }).catch(() => null);
  }

  return booking;
}

/**
 * Approve a request-to-book booking, moving it to pending_payment.
 */
export async function approveBookingRequest(
  db: PrismaClient,
  input: ApproveBookingRequestInput
) {
  const { bookingId, holdMinutes = 30 } = input;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'requested') {
    throw new Error(`Cannot approve booking with status ${booking.status}`);
  }

  // A request never blocked the calendar, so re-check the dates now —
  // another approval or an instant booking may have taken the villa since.
  const conflict = await findBlockingConflict(
    db,
    booking.unitId,
    booking.startDate,
    booking.endDate,
    booking.id
  );
  let unitId = booking.unitId;
  if (conflict) {
    // A category-booked villa is the operator's choice (LY-6): reassign
    // within the same category when another villa is free — the tariff is
    // category-level, so the approved total stays valid. No category, or
    // none free → refuse; the request stays open for other dates.
    const unit = await db.unit.findUnique({
      where: { id: booking.unitId },
      select: { categoryKey: true },
    });
    const replacement = unit?.categoryKey
      ? await resolveUnitForCategory(
          db,
          booking.projectId,
          unit.categoryKey,
          booking.startDate,
          booking.endDate
        )
      : null;
    if (!replacement) {
      const err = new Error('Dates unavailable — booking already exists');
      (err as any).code = 'DOUBLE_BOOK';
      throw err;
    }
    unitId = replacement.id;
  }

  const now = new Date();
  // `requested` sits outside the exclusion constraint, so this update is the
  // moment the dates are actually claimed — and the moment a race can be lost.
  return db.booking
    .update({
      where: { id: bookingId },
      data: {
        unitId,
        status: 'pending_payment',
        holdExpiresAt: new Date(now.getTime() + holdMinutes * 60 * 1000),
        requestExpiresAt: null,
      },
      include: { unit: { select: { name: true } } },
    })
    .catch(rethrowAsDoubleBook);
}

/**
 * Decline a request-to-book booking.
 */
export async function declineBookingRequest(
  db: PrismaClient,
  input: DeclineBookingRequestInput
) {
  const { bookingId, declinedByIdentityId } = input;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'requested') {
    throw new Error(`Cannot decline booking with status ${booking.status}`);
  }

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'declined',
      requestExpiresAt: null,
      cancelledByIdentityId: declinedByIdentityId,
      cancellationReason: 'declined_by_host',
      cancelledAt: new Date(),
    },
  });
}

/**
 * Confirm a pending_payment booking (payment received).
 */
export async function confirmBooking(
  db: PrismaClient,
  input: ConfirmBookingInput
) {
  const { bookingId } = input;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'pending_payment') {
    throw new Error(`Cannot confirm booking with status ${booking.status}`);
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'confirmed',
      holdExpiresAt: null,
    },
  });

  // Track analytics event
  const nights = Math.ceil(
    (updated.endDate.getTime() - updated.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  await track(db, 'stay_confirmed', {
    bookingId: updated.id,
    unitId: updated.unitId,
    projectId: updated.projectId,
    identityId: updated.guestIdentityId,
    channel: updated.channel,
    nights,
    totalThb: updated.totalThb,
  }).catch(() => null);

  return updated;
}

/**
 * Cancel a booking and issue a refund.
 */
export async function cancelBooking(
  db: PrismaClient,
  input: CancelBookingInput
) {
  const { bookingId, cancelledByIdentityId, reason, refundAmountThb } = input;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // 'requested' included per doc 02 §3.1 — guest may withdraw a request freely.
  const cancellableStatuses: BookingStatus[] = ['requested', 'pending_payment', 'confirmed', 'checked_in'];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new Error(`Cannot cancel booking with status ${booking.status}`);
  }

  const cancelled = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledByIdentityId,
      cancellationReason: reason,
      refundAccruedThb: refundAmountThb,
      holdExpiresAt: null,
      requestExpiresAt: null,
    },
  });

  // Track analytics event
  const nights = Math.ceil(
    (cancelled.endDate.getTime() - cancelled.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  await track(db, 'stay_cancelled', {
    bookingId: cancelled.id,
    unitId: cancelled.unitId,
    projectId: cancelled.projectId,
    identityId: cancelled.guestIdentityId,
    nights,
    reason,
    refundThb: refundAmountThb,
  }).catch(() => null);

  return cancelled;
}

/**
 * Check in a guest (confirmed → checked_in).
 */
export async function checkInBooking(
  db: PrismaClient,
  bookingId: string,
  checkedInAt: Date = new Date()
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'confirmed') {
    throw new Error(`Cannot check in booking with status ${booking.status}`);
  }

  const checkedIn = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'checked_in',
      checkedInAt,
    },
  });

  await track(db, 'stay_checked_in', {
    bookingId: checkedIn.id,
    unitId: checkedIn.unitId,
    projectId: checkedIn.projectId,
    identityId: checkedIn.guestIdentityId,
  }).catch(() => null);

  return checkedIn;
}

/**
 * Check out a guest (checked_in → checked_out).
 */
export async function checkOutBooking(
  db: PrismaClient,
  bookingId: string,
  checkedOutAt: Date = new Date()
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'checked_in') {
    throw new Error(`Cannot check out booking with status ${booking.status}`);
  }

  const checkedOut = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'checked_out',
      checkedOutAt,
    },
  });

  await track(db, 'stay_checked_out', {
    bookingId: checkedOut.id,
    unitId: checkedOut.unitId,
    projectId: checkedOut.projectId,
    identityId: checkedOut.guestIdentityId,
  }).catch(() => null);

  return checkedOut;
}

/**
 * Complete a booking (checked_out → completed).
 */
export async function completeBooking(
  db: PrismaClient,
  bookingId: string
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'checked_out') {
    throw new Error(`Cannot complete booking with status ${booking.status}`);
  }

  const completed = await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'completed',
    },
  });

  // Track analytics event
  const nights = Math.ceil(
    (completed.endDate.getTime() - completed.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  await track(db, 'stay_completed', {
    bookingId: completed.id,
    unitId: completed.unitId,
    projectId: completed.projectId,
    identityId: completed.guestIdentityId,
    nights,
  }).catch(() => null);

  return completed;
}

export interface StayExtensionResult {
  bookingId: string;
  currentEndDate: Date;
  newEndDate: Date;
  additionalNights: number;
  /** Price of the added nights alone — what the guest still owes. */
  addedThb: number;
  /** The booking's balance after this extension is added to it. */
  balanceDueThb: number;
  newTotalThb: number;
}

/**
 * Extend a stay that is already under way (doc 07 F-GUEST-7 → F-GUEST-9).
 *
 * A stay in progress has exactly one date affordance: push the end date
 * later. The start date is history by then, so it is never touched here —
 * a guest who wants a different shape of booking cancels and rebooks.
 *
 * The added nights are availability-checked against the rest of the calendar,
 * priced on their own, and recorded as an unpaid balance. Collecting that
 * balance is the caller's job (a `stay_balance` checkout through the finance
 * seam) — this module never reaches into payments.
 */
export async function requestExtension(
  db: PrismaClient,
  bookingId: string,
  newEndDate: Date,
  actorIdentityId?: string
): Promise<StayExtensionResult> {
  // Read, check and write are one transaction under the per-unit advisory lock,
  // the same guard `createBooking` takes. Before this the three were separate
  // statements: two guests could each be told their extension was available and
  // both could commit. The exclusion constraint would have caught the resulting
  // overlap, but as a raw Postgres error rather than a refusal the caller could
  // act on — and only for bookings, never for blocks.
  const { booking, updated, additionalNights, addedThb, newTotalThb, balanceDueThb } =
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { unit: true },
      });
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.unitId}))`;

      if (booking.status !== 'checked_in') {
        throw new Error(`Cannot request extension for booking with status ${booking.status}`);
      }

      if (newEndDate <= booking.endDate) {
        throw new Error('New end date must be after current end date');
      }

      // The added nights are the only ones in question — the nights already being
      // slept in are this booking's own and cannot conflict with anything.
      const conflicting = await tx.booking.findFirst({
        where: {
          unitId: booking.unitId,
          id: { not: bookingId },
          startDate: { lt: newEndDate },
          endDate: { gt: booking.endDate },
          OR: [
            { status: { in: ['confirmed', 'checked_in'] } },
            { status: 'pending_payment', holdExpiresAt: { gt: new Date() } },
          ],
        },
      });

      if (conflicting) {
        const err = new Error('The unit is already booked for those nights');
        (err as any).code = 'DOUBLE_BOOK';
        throw err;
      }

      // A unit can be unavailable without a booking, and the extension path never
      // looked: an owner hold, a maintenance window, or nights already sold on an
      // OTA would all have been extended straight over.
      const blocked = await tx.blockedDate.findFirst({
        where: {
          unitId: booking.unitId,
          startDate: { lt: newEndDate },
          endDate: { gt: booking.endDate },
        },
        select: { id: true, reason: true },
      });
      if (blocked) {
        const err = new Error(`The unit is unavailable for those nights (${blocked.reason})`);
        (err as any).code = 'DOUBLE_BOOK';
        (err as any).blockReason = blocked.reason;
        throw err;
      }

      const additionalNights = Math.ceil(
        (newEndDate.getTime() - booking.endDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const addedThb = additionalNights * (booking.unit?.baseNightlyThb ?? 0);
      const newTotalThb = booking.totalThb + addedThb;
      const balanceDueThb = (booking.balanceDueThb || 0) + addedThb;

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          endDate: newEndDate,
          totalThb: newTotalThb,
          balanceDueThb,
        },
      });

      // F-GUEST-9 writes a BookingChange for every date move, so the stay's shape
      // is always reconstructable from its own history. Inside the transaction:
      // a stay whose dates moved without a record of the move is worse than one
      // that did not move at all.
      await tx.bookingChange.create({
        data: {
          bookingId,
          changeType: 'dates',
          oldValue: {
            startDate: booking.startDate.toISOString(),
            endDate: booking.endDate.toISOString(),
            totalThb: booking.totalThb,
          },
          newValue: {
            startDate: booking.startDate.toISOString(),
            endDate: newEndDate.toISOString(),
            totalThb: newTotalThb,
          },
          priceDeltaThb: addedThb,
          actorIdentityId: actorIdentityId ?? booking.guestIdentityId,
        },
      });

      return { booking, updated, additionalNights, addedThb, newTotalThb, balanceDueThb };
    });

  await track(db, 'stay_extension_requested', {
    bookingId,
    unitId: booking.unitId,
    projectId: booking.projectId,
    identityId: booking.guestIdentityId,
    addedNights: additionalNights,
  }).catch(() => null);

  return {
    bookingId,
    currentEndDate: booking.endDate,
    newEndDate: updated.endDate,
    additionalNights,
    addedThb,
    balanceDueThb,
    newTotalThb,
  };
}

/**
 * Mark a booking as no-show (tracking event; status remains checked_out until resolved).
 */
export interface ChangeDatesResult {
  bookingId: string;
  previousStartDate: Date;
  previousEndDate: Date;
  startDate: Date;
  endDate: Date;
  previousTotalThb: number;
  totalThb: number;
  /** Positive when the guest owes more; collected through the finance seam. */
  balanceDueThb: number;
  /** Positive when the stay got cheaper; accrued, not paid out here. */
  refundAccruedThb: number;
}

/**
 * Move a booking's dates (F-GUEST-9, the general case).
 *
 * `requestExtension` only ever pushes the end date out. A guest whose flight
 * moves needs the whole range to shift, and one cutting a trip short needs it to
 * shrink — neither of which that function can express, so the only route was
 * cancel and rebook. That loses the booking, the price the guest agreed, and
 * frequently the guest.
 *
 * Repricing is a full recomputation for the new range rather than an adjustment
 * of the old total: nights move across seasons, and a delta calculated from the
 * old nightly rate would quietly undercharge a stay that shifted into a peak.
 *
 * The difference lands as a balance to collect or a refund accrued. Neither is
 * settled here — the finance seam owns money, this module owns the stay.
 */
export async function changeBookingDates(
  db: PrismaClient,
  input: {
    bookingId: string;
    startDate: Date;
    endDate: Date;
    actorIdentityId?: string;
  }
): Promise<ChangeDatesResult> {
  const { bookingId, startDate, endDate, actorIdentityId } = input;

  if (endDate <= startDate) {
    throw new Error('The new end date must be after the new start date');
  }

  const changeable: BookingStatus[] = ['pending_payment', 'confirmed', 'checked_in'];

  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { unit: true },
    });
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.unitId}))`;

    if (!changeable.includes(booking.status)) {
      throw new Error(`Cannot change the dates of a booking with status ${booking.status}`);
    }

    // A stay in progress cannot have its start moved — the guest is already in
    // the villa, and rewriting the arrival would falsify the register the TM30
    // filing was made from.
    if (booking.status === 'checked_in' && startDate.getTime() !== booking.startDate.getTime()) {
      throw new Error('A stay that has begun can change its departure, not its arrival');
    }

    // Excluding itself: the booking's own current nights are not a conflict with
    // the nights it is moving to, and overlap between old and new is the usual
    // case rather than the exception.
    const conflicting = await findBlockingConflict(
      tx as PrismaClient,
      booking.unitId,
      startDate,
      endDate,
      bookingId
    );
    if (conflicting) {
      const err = new Error('The unit is already booked for those dates');
      (err as any).code = 'DOUBLE_BOOK';
      throw err;
    }

    const blocked = await tx.blockedDate.findFirst({
      where: {
        unitId: booking.unitId,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { id: true, reason: true },
    });
    if (blocked) {
      const err = new Error(`The unit is unavailable for those dates (${blocked.reason})`);
      (err as any).code = 'DOUBLE_BOOK';
      (err as any).blockReason = blocked.reason;
      throw err;
    }

    const breakdown = await computePriceBreakdown(
      tx as PrismaClient,
      booking.unitId,
      startDate,
      endDate,
      booking.adults + booking.children
    );

    const previousTotalThb = booking.totalThb;
    const totalThb = breakdown.total_thb;
    const difference = totalThb - previousTotalThb;

    const balanceDueThb =
      difference > 0 ? booking.balanceDueThb + difference : booking.balanceDueThb;
    const refundAccruedThb =
      difference < 0 ? booking.refundAccruedThb + Math.abs(difference) : booking.refundAccruedThb;

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { startDate, endDate, totalThb, balanceDueThb, refundAccruedThb },
    });

    // The price breakdown is immutable once set, so the new pricing lives on the
    // change row rather than overwriting the terms the booking was sold under.
    await tx.bookingChange.create({
      data: {
        bookingId,
        changeType: 'dates',
        oldValue: {
          startDate: booking.startDate.toISOString(),
          endDate: booking.endDate.toISOString(),
          totalThb: previousTotalThb,
        },
        newValue: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalThb,
          priceBreakdown: { ...breakdown } as any,
        } as any,
        priceDeltaThb: difference,
        actorIdentityId: actorIdentityId ?? booking.guestIdentityId,
      },
    });

    return {
      bookingId,
      previousStartDate: booking.startDate,
      previousEndDate: booking.endDate,
      startDate: updated.startDate,
      endDate: updated.endDate,
      previousTotalThb,
      totalThb,
      balanceDueThb,
      refundAccruedThb,
    };
  });

  // stay_modified already covers a change to a booking's shape (doc 13); a date
  // move is exactly that, so no new event key is minted for it.
  await track(db, 'stay_modified', {
    bookingId,
    priceDeltaThb: result.totalThb - result.previousTotalThb,
  }).catch(() => null);

  return result;
}

export async function markNoShow(
  db: PrismaClient,
  bookingId: string
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'checked_out' && booking.status !== 'completed') {
    throw new Error(`Cannot mark no-show for booking with status ${booking.status}`);
  }

  // Track analytics event (doc 13: no-show is a behavioral marker, not a status)
  const nights = Math.ceil(
    (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  await track(db, 'stay_no_show', {
    bookingId: booking.id,
    unitId: booking.unitId,
    projectId: booking.projectId,
    identityId: booking.guestIdentityId,
    nights,
  }).catch(() => null);

  return booking;
}

/**
 * Expire pending_payment holds (scheduler job).
 */
export async function expireHolds(db: PrismaClient, now: Date = new Date()) {
  const expiredBookings = await db.booking.findMany({
    where: {
      status: 'pending_payment',
      holdExpiresAt: { lte: now },
    },
  });

  const expired = await db.booking.updateMany({
    where: {
      status: 'pending_payment',
      holdExpiresAt: { lte: now },
    },
    data: {
      status: 'expired',
      holdExpiresAt: null,
    },
  });

  // Track analytics events for each expired booking
  for (const booking of expiredBookings) {
    const nights = Math.ceil(
      (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    await track(db, 'stay_hold_expired', {
      bookingId: booking.id,
      unitId: booking.unitId,
      projectId: booking.projectId,
      identityId: booking.guestIdentityId,
      nights,
      totalThb: booking.totalThb,
    }).catch(() => null);
  }

  return expired.count;
}

/**
 * Auto-decline request-to-book bookings past their deadline (scheduler job).
 */
export async function autoDeclineRequests(db: PrismaClient, now: Date = new Date()) {
  const declined = await db.booking.updateMany({
    where: {
      status: 'requested',
      requestExpiresAt: { lte: now },
    },
    data: {
      status: 'declined',
      requestExpiresAt: null,
      cancellationReason: 'auto_declined_timeout',
      cancelledAt: now,
    },
  });

  return declined.count;
}

/**
 * Get a single booking by ID.
 */
export async function getBooking(db: PrismaClient, bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      unit: true,
      guestIdentity: { select: SAFE_IDENTITY_SELECT },
      guests: true,
      changes: true,
    },
  });
}

/**
 * Get bookings for a unit in a date range.
 */
export async function getUnitBookings(
  db: PrismaClient,
  unitId: string,
  startDate?: Date,
  endDate?: Date
) {
  return db.booking.findMany({
    where: {
      unitId,
      startDate: startDate ? { gte: startDate } : undefined,
      endDate: endDate ? { lte: endDate } : undefined,
    },
    orderBy: { startDate: 'asc' },
  });
}

/**
 * Get bookings for a guest.
 */
export async function getGuestBookings(db: PrismaClient, guestIdentityId: string) {
  return db.booking.findMany({
    where: { guestIdentityId },
    orderBy: { startDate: 'desc' },
  });
}
