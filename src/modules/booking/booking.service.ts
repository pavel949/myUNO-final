import { PrismaClient, BookingStatus, Prisma } from '@prisma/client';
import { track } from '@/modules/analytics';
import { assertLayantaraBookingAuthority, excludedSourceControlledUnits } from './source-authority';
import { createNotification } from '@/modules/comms';
import { notifyBookingRequested } from './notify-requested';
import { notifyBookingModified } from './notify-modified';
import { computePriceBreakdown } from '@/modules/core';
import { calendarDayIn, toCalendarDay, DEFAULT_TIME_ZONE } from '@/lib/date';
import { ensureDepositPreauthOnStayConfirmed } from '@/modules/finance';
import {
  formatDeclineCancellationReason,
  isBookingRequestDeclineReason,
} from './request-decline-reasons';

export interface CreateBookingInput {
  unitId: string;
  projectId: string;
  guestIdentityId: string;
  bookingType: 'guest_stay' | 'owner_stay';
  channel: 'direct' | 'airbnb' | 'booking_com' | 'agoda' | 'agent' | 'manual' | 'expedia' | 'trip_com';
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  /** Not counted toward occupancy — an infant needs a cot, not a bed. */
  infants?: number;
  /** Checked against the unit's pet policy, not against its bed count. */
  pets?: number;
  totalThb: number;
  /**
   * Maximum authoritative total the guest explicitly accepted on review.
   * Applies to direct-unit review and category allocation, where a race may
   * move the stay to a sibling unit. Never used as the authoritative price.
   */
  acceptedMaxTotalThb?: number;
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
  reasonCode?: string;
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

  const candidates = await db.unit.findMany({
    where: {
      projectId,
      categoryKey,
      status: 'live',
      // A live unit inside an archived or draft project is not sellable. The
      // unit status alone said it was, so archiving a project stopped its
      // pages without stopping its sales.
      project: { status: 'live' },
      // Explicit commercial eligibility for typed projects. Untyped legacy
      // supply keeps its original behavior until onboarding migration.
      AND: [{ OR: [
        { project: { projectType: null } },
        { commercialOfferings: { some: {
          offeringType: { in: ['short_term_stay', 'short_stay'] }, status: 'active',
        } } },
      ] }],
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
  const excluded = await excludedSourceControlledUnits(db,candidates.map(unit=>unit.id));
  return candidates.filter(unit=>!excluded.includes(unit.id));
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
    infants = 0,
    pets = 0,
    totalThb: suppliedTotalThb,
    acceptedMaxTotalThb,
    priceBreakdown: suppliedPriceBreakdown,
    cancellationPolicySnapshot,
    instantBook,
    holdMinutes = 30,
    requestHours = 24,
    guestNote,
  } = input;

  await assertLayantaraBookingAuthority(db, unitId);
  const now = new Date();

  // Guest-stay money is authoritative only when computed here. API routes may
  // pre-quote for UX, but no caller can persist a different total/snapshot.
  // Owner stays keep their explicit zero/manual commercial semantics.
  let totalThb = suppliedTotalThb;
  let priceBreakdown = suppliedPriceBreakdown;
  if (bookingType === 'guest_stay') {
    const authoritative = await computePriceBreakdown(
      db,
      unitId,
      startDate,
      endDate,
      adults + children,
      now,
      pets
    );
    if (
      acceptedMaxTotalThb !== undefined &&
      (!Number.isSafeInteger(acceptedMaxTotalThb) ||
        acceptedMaxTotalThb < 0 ||
        authoritative.total_thb > acceptedMaxTotalThb)
    ) {
      const err = new Error('The stay price changed after review. A new quote and consent are required.');
      (err as { code?: string }).code = 'REQUOTE_REQUIRED';
      throw err;
    }
    totalThb = authoritative.total_thb;
    priceBreakdown = {
      ...authoritative,
      ...(suppliedPriceBreakdown &&
      typeof suppliedPriceBreakdown === 'object' &&
      'inventory_category_id' in suppliedPriceBreakdown
        ? { inventory_category_id: suppliedPriceBreakdown.inventory_category_id }
        : {}),
    };
  }

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
    await assertLayantaraBookingAuthority(tx, unitId);

    // A caller may ask for approval, but cannot grant instant-book authority.
    // Read the current unit again at the writer, including category fallbacks.
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      select: { instantBook: true, projectId: true },
    });
    if (!unit || unit.projectId !== projectId) throw new Error('Booking unit not found');
    const canInstantBook = instantBook === true && unit.instantBook;
    const initialStatus: BookingStatus = canInstantBook ? 'pending_payment' : 'requested';

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
        infants,
        pets,
        totalThb,
        ...(priceBreakdown && { priceBreakdown: priceBreakdown as any }),
        ...(cancellationPolicySnapshot && { cancellationPolicySnapshot: cancellationPolicySnapshot as any }),
        holdExpiresAt: canInstantBook ? new Date(now.getTime() + holdMinutes * 60 * 1000) : null,
        requestExpiresAt: !canInstantBook ? new Date(now.getTime() + requestHours * 60 * 60 * 1000) : null,
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
  if (booking.status === 'requested') {
    await track(db, 'stay_booking_requested', {
      bookingId: booking.id,
      unitId,
      projectId,
      identityId: guestIdentityId,
      channel,
      nights,
      totalThb,
    }).catch(() => null);

    await notifyBookingRequested(db, booking.id, requestHours).catch(() => null);
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
    const err = new Error(`Cannot approve booking with status ${booking.status}`);
    (err as Error & { code: string }).code = 'BOOKING_STATE_CHANGED';
    throw err;
  }
  await assertLayantaraBookingAuthority(db, booking.unitId);

  // A request does not reserve capacity. Claim one candidate at a time under
  // the same per-unit lock used by bookings, manual blocks and iCal imports.
  // Separate transactions avoid holding two unit locks in opposite orders when
  // simultaneous approvals need different category replacements.
  const claimCandidate = (unitId: string, categoryKey?: string) => db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;

    const current = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!current) throw new Error(`Booking ${bookingId} not found`);
    if (current.status !== 'requested') {
      const err = new Error(`Cannot approve booking with status ${current.status}`);
      (err as Error & { code: string }).code = 'BOOKING_STATE_CHANGED';
      throw err;
    }
    const now = new Date();
    // The scheduler may run late. Its pending status is not authority to
    // approve a request after the guest's response window has closed.
    if (current.requestExpiresAt && current.requestExpiresAt <= now) {
      const err = new Error('Booking request has expired');
      (err as Error & { code: string }).code = 'BOOKING_REQUEST_EXPIRED';
      throw err;
    }
    const sellableUnit = await tx.unit.findFirst({
      where: {
        id: unitId,
        projectId: current.projectId,
        status: 'live',
        project: { status: 'live' },
        ...(categoryKey !== undefined ? { categoryKey } : {}),
        ...(current.bookingType === 'guest_stay' ? {
          AND: [{ OR: [
            { project: { projectType: null } },
            { commercialOfferings: { some: {
              offeringType: { in: ['short_term_stay', 'short_stay'] }, status: 'active',
            } } },
          ] }],
        } : {}),
      },
      select: { id: true },
    });
    if (!sellableUnit) {
      const err = new Error('The requested villa is no longer eligible for this stay');
      (err as Error & { code: string }).code = 'DOUBLE_BOOK';
      throw err;
    }
    await assertLayantaraBookingAuthority(tx, unitId);

    await tx.booking.updateMany({
      where: { unitId, status: 'pending_payment', holdExpiresAt: { lte: now } },
      data: { status: 'expired', holdExpiresAt: null },
    });
    const conflict = await findBlockingConflict(
      tx as PrismaClient, unitId, current.startDate, current.endDate, bookingId
    );
    const block = await tx.blockedDate.findFirst({
      where: {
        unitId,
        startDate: { lt: current.endDate },
        endDate: { gt: current.startDate },
      },
      select: { reason: true },
    });
    if (conflict || block) {
      const err = new Error('Dates unavailable — booking or block already exists');
      (err as Error & { code: string; blockReason?: string }).code = 'DOUBLE_BOOK';
      if (block) (err as Error & { blockReason: string }).blockReason = block.reason;
      throw err;
    }

    // A replacement may have a dated unit override. Store its actual price,
    // but never raise the guest's accepted total without a fresh acceptance.
    const repriced = unitId !== current.unitId && current.bookingType === 'guest_stay'
      ? await computePriceBreakdown(
          tx as PrismaClient, unitId, current.startDate, current.endDate,
          current.adults + current.children, now, current.pets
        )
      : null;
    if (repriced && repriced.total_thb > current.totalThb) {
      const err = new Error('Replacement price exceeds the accepted request total');
      (err as Error & { code: string }).code = 'REQUOTE_REQUIRED';
      throw err;
    }

    // The status predicate also prevents two staff approvals of the same
    // request from silently moving a hold to different physical villas.
    return tx.booking.update({
      where: { id: bookingId, status: 'requested' },
      data: {
        unitId,
        ...(repriced ? { totalThb: repriced.total_thb, priceBreakdown: repriced as any } : {}),
        status: 'pending_payment',
        holdExpiresAt: new Date(now.getTime() + holdMinutes * 60 * 1000),
        requestExpiresAt: null,
      },
      include: { unit: { select: { name: true } } },
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === 'P2025') {
        const err = new Error('Booking request was already answered');
        (err as Error & { code: string }).code = 'BOOKING_STATE_CHANGED';
        throw err;
      }
      throw error;
    });
  }).catch(rethrowAsDoubleBook);

  try {
    return await claimCandidate(booking.unitId);
  } catch (originalError) {
    if ((originalError as { code?: string })?.code !== 'DOUBLE_BOOK') throw originalError;

    const unit = await db.unit.findUnique({
      where: { id: booking.unitId }, select: { categoryKey: true },
    });
    if (!unit?.categoryKey) throw originalError;
    const replacements = await findAvailableUnitsForCategory(
      db, booking.projectId, unit.categoryKey, booking.startDate, booking.endDate
    );
    let needsRequote = false;
    for (const replacement of replacements) {
      if (replacement.id === booking.unitId) continue;
      try {
        return await claimCandidate(replacement.id, unit.categoryKey);
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === 'REQUOTE_REQUIRED') needsRequote = true;
        else if (code !== 'DOUBLE_BOOK') throw error;
      }
    }
    if (needsRequote) {
      const err = new Error('No available replacement matches the accepted request price');
      (err as Error & { code: string }).code = 'REQUOTE_REQUIRED';
      throw err;
    }
    throw originalError;
  }
}

/**
 * Decline a request-to-book booking.
 */
export async function declineBookingRequest(
  db: PrismaClient,
  input: DeclineBookingRequestInput
) {
  const { bookingId, declinedByIdentityId, reasonCode } = input;

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'requested') {
    const err = new Error(`Cannot decline booking with status ${booking.status}`);
    (err as Error & { code: string }).code = 'BOOKING_STATE_CHANGED';
    throw err;
  }

  if (reasonCode !== undefined && !isBookingRequestDeclineReason(reasonCode)) {
    throw new Error(`Invalid decline reason: ${reasonCode}`);
  }

  const cancellationReason = reasonCode
    ? formatDeclineCancellationReason(reasonCode)
    : 'declined_by_host';

  return db.booking.update({
    // Approval and decline can arrive together. Only one response may win.
    where: { id: bookingId, status: 'requested' },
    data: {
      status: 'declined',
      requestExpiresAt: null,
      cancelledByIdentityId: declinedByIdentityId,
      cancellationReason,
      cancelledAt: new Date(),
    },
  }).catch((error: unknown) => {
    if ((error as { code?: string })?.code === 'P2025') {
      const err = new Error('Booking request was already answered');
      (err as Error & { code: string }).code = 'BOOKING_STATE_CHANGED';
      throw err;
    }
    throw error;
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

  await ensureDepositPreauthOnStayConfirmed(db, updated.id, updated.unitId).catch(() => null);

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
/**
 * Why a check-in is refused. Each code maps to a content key
 * (`booking.checkin.blocked.<code>`) so the operator sees the reason in their
 * own language.
 */
export type CheckInBlockCode =
  | 'not_confirmed'
  | 'before_arrival'
  | 'after_departure'
  | 'guests_incomplete'
  | 'passport_missing';

export class CheckInBlockedError extends Error {
  constructor(public readonly code: CheckInBlockCode, message: string) {
    super(message);
    this.name = 'CheckInBlockedError';
  }
}

export interface CheckInCandidate {
  status: BookingStatus;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  infants: number;
  guests: Array<{ nationality: string | null; passportNumber: string | null }>;
}

/**
 * The check-in rule, as one pure decision (null = allowed).
 *
 * Check-in starts the TM30 clock — immigration must be notified within 24h of
 * a foreign guest's arrival (CLAUDE.md legal non-negotiables, doc 07 F-OPS-2) —
 * and the filings are created from the registered party. So a check-in is only
 * real when:
 *  - it happens inside the stay, judged on the property's calendar day: never
 *    weeks ahead of arrival, never after the departure day;
 *  - every person in the party (adults, children and infants: TM30 covers all
 *    foreigners) is registered with a nationality;
 *  - every non-Thai guest has a passport number on file.
 * Before this rule, a confirmed booking could be checked in 40 days early with
 * nobody registered, and no TM30 obligation was ever created.
 */
export function assessCheckIn(booking: CheckInCandidate, today: string): CheckInBlockCode | null {
  if (booking.status !== 'confirmed') return 'not_confirmed';
  if (today < toCalendarDay(booking.startDate)) return 'before_arrival';
  if (today >= toCalendarDay(booking.endDate)) return 'after_departure';
  const partySize = booking.adults + booking.children + booking.infants;
  const registered = booking.guests.filter(guest => guest.nationality?.trim());
  if (registered.length < partySize) return 'guests_incomplete';
  const foreignWithoutPassport = registered.some(
    guest => guest.nationality!.trim().toUpperCase() !== 'TH' && !guest.passportNumber?.trim(),
  );
  if (foreignWithoutPassport) return 'passport_missing';
  return null;
}

export async function checkInBooking(
  db: PrismaClient,
  bookingId: string,
  checkedInAt: Date = new Date()
) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      guests: { select: { nationality: true, passportNumber: true } },
      project: { select: { timezone: true } },
    },
  });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const blocked = assessCheckIn(
    booking,
    calendarDayIn(checkedInAt, booking.project.timezone ?? DEFAULT_TIME_ZONE),
  );
  if (blocked) {
    throw new CheckInBlockedError(
      blocked,
      blocked === 'not_confirmed'
        ? `Cannot check in booking with status ${booking.status}`
        : `Cannot check in booking ${bookingId}: ${blocked}`,
    );
  }

  // Readiness is derived from canonical operational tasks generated by the
  // previous departure. Any open cleaning/inspection obligation blocks the
  // next arrival; there is no UI-only "ready" flag to drift from operations.
  // Joins the caller's transaction when given one (the check-in route commits
  // the transition and its TM30 filings together); a transaction client has
  // no $transaction of its own.
  const inTransaction = <T,>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
    typeof (db as { $transaction?: unknown }).$transaction === 'function'
      ? db.$transaction(fn)
      : fn(db as unknown as Prisma.TransactionClient);
  const checkedIn = await inTransaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.unitId}))`;
    const readinessBlockers = await tx.operationalTask.findMany({
      where: {
        unitId: booking.unitId,
        taskType: { in: ['turnover_cleaning', 'turnover_inspection'] },
        status: { in: ['planned', 'assigned', 'in_progress', 'inspected'] },
      },
      select: { id: true, taskType: true, status: true, dueAt: true },
      orderBy: [{ dueAt: 'asc' }, { taskType: 'asc' }],
    });
    if (readinessBlockers.length) {
      const error = new Error('Unit is not ready for check-in');
      (error as Error & { code?: string; blockers?: typeof readinessBlockers }).code =
        'UNIT_NOT_READY';
      (error as Error & { blockers?: typeof readinessBlockers }).blockers = readinessBlockers;
      throw error;
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'checked_in',
        checkedInAt,
      },
    });
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

  // State transition and turnover obligations commit atomically. A failed task
  // write must never leave a checked-out stay with no readiness work behind it.
  const checkedOut = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.unitId}))`;
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'checked_out',
        checkedOutAt,
      },
    });

    await Promise.all((['turnover_cleaning', 'turnover_inspection'] as const).map((taskType) =>
      tx.operationalTask.upsert({
        where: {
          bookingId_taskType: {
            bookingId: updated.id,
            taskType,
          },
        },
        create: {
          projectId: updated.projectId,
          unitId: updated.unitId,
          bookingId: updated.id,
          taskType,
          status: 'planned',
          dueAt: checkedOutAt,
        },
        update: { dueAt: checkedOutAt },
      })
    ));
    return updated;
  });

  await track(db, 'stay_checked_out', {
    bookingId: checkedOut.id,
    unitId: checkedOut.unitId,
    projectId: checkedOut.projectId,
    identityId: checkedOut.guestIdentityId,
  }).catch(() => null);

  // The deposit pre-authorization is deliberately NOT released here.
  //
  // It used to be, unconditionally, on every check-out. That defeated the
  // damage-claim flow entirely: `fileDepositClaim` allows a claim for
  // `booking.deposit.claim_window_hours` (48 by default) *after* check-out, and
  // `captureDepositPreauthOnClaim` refuses anything that is not still
  // `authorized`. So the claim window opened at exactly the moment the deposit
  // became uncapturable, and `getStaysOpenToClaim` — which shows staff the
  // hours they have left to act — was counting down against a hold that no
  // longer existed.
  //
  // Release is now `releaseExpiredDepositPreauths` (a scheduled job), which
  // voids the hold once the window has closed with nothing outstanding. That
  // makes the documented window real without deciding when a deposit *should*
  // be released, which is still open (Q46).

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
    /**
     * A new party, when the guest is changing it. Carried here rather than
     * applied separately afterwards so it is priced, validated and recorded in
     * the same transaction as the dates — see the note at the re-price below.
     */
    adults?: number;
    children?: number;
  }
): Promise<ChangeDatesResult> {
  const { bookingId, startDate, endDate, actorIdentityId } = input;

  for (const [name, value] of [
    ['adults', input.adults],
    ['children', input.children],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${name} must be a whole number, zero or more`);
    }
  }
  if (input.adults !== undefined && input.adults < 1) {
    throw new Error('A stay needs at least one adult');
  }

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

    // The party is priced here, with the dates, rather than written
    // afterwards. The route used to apply adults/children with a bare
    // `booking.update` once this function had already returned, which meant a
    // party change was never re-priced and never checked against the unit's
    // capacity — `computePriceBreakdown` refuses a party over `max_guests`,
    // and that check was simply being stepped around. Occupancy is
    // adults + children; infants are excluded by the same convention the
    // breakdown uses.
    const adults = input.adults ?? booking.adults;
    const children = input.children ?? booking.children;
    const partyChanged = adults !== booking.adults || children !== booking.children;

    const breakdown = await computePriceBreakdown(
      tx as PrismaClient,
      booking.unitId,
      startDate,
      endDate,
      adults + children
    );

    const previousTotalThb = booking.totalThb;
    const totalThb = breakdown.total_thb;
    const difference = totalThb - previousTotalThb;

    // Keep one net financial position. A later decrease first cancels an
    // unpaid balance; a later increase first cancels an outstanding refund
    // credit. Never leave the booking owing money in both directions.
    let balanceDueThb = booking.balanceDueThb;
    let refundAccruedThb = booking.refundAccruedThb;
    if (difference > 0) {
      const offset = Math.min(difference, refundAccruedThb);
      refundAccruedThb -= offset;
      balanceDueThb += difference - offset;
    } else if (difference < 0) {
      let credit = Math.abs(difference);
      const offset = Math.min(credit, balanceDueThb);
      balanceDueThb -= offset;
      credit -= offset;

      if (credit > 0) {
        // A refund liability cannot exceed money actually received for this
        // booking after refunds already reserved or completed.
        const payments = await tx.payment.findMany({
          where: {
            bookingId,
            purpose: { in: ['stay', 'stay_balance'] },
            status: 'succeeded',
          },
          include: {
            refunds: {
              where: { status: { in: ['requested', 'processing', 'succeeded'] } },
              select: { amountThb: true },
            },
          },
        });
        const netPaidAvailable = payments.reduce(
          (sum, payment) =>
            sum +
            payment.amountThb -
            payment.refunds.reduce((refundSum, refund) => refundSum + refund.amountThb, 0),
          0
        );
        const roomForRefund = Math.max(0, netPaidAvailable - refundAccruedThb);
        refundAccruedThb += Math.min(credit, roomForRefund);
      }
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        startDate,
        endDate,
        totalThb,
        balanceDueThb,
        refundAccruedThb,
        ...(partyChanged && { adults, children }),
      },
    });

    // The price breakdown is immutable once set, so the new pricing lives on the
    // change row rather than overwriting the terms the booking was sold under.
    await tx.bookingChange.create({
      data: {
        bookingId,
        changeType: partyChanged ? 'party' : 'dates',
        oldValue: {
          startDate: booking.startDate.toISOString(),
          endDate: booking.endDate.toISOString(),
          totalThb: previousTotalThb,
          ...(partyChanged && { adults: booking.adults, children: booking.children }),
        },
        newValue: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalThb,
          ...(partyChanged && { adults, children }),
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

  await notifyBookingModified(db, result).catch(() => null);

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
    include: {
      unit: { select: { name: true } },
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

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Track analytics events and notify guests (N-04) for each expired booking
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

    await createNotification(db, {
      identityId: booking.guestIdentityId,
      type: 'stay_hold_expired',
      titleKey: 'notify.stay.hold_expired.title',
      bodyKey: 'notify.stay.hold_expired.body',
      params: {
        booking_id: booking.id,
        unit_name: booking.unit.name,
        start_date: booking.startDate.toISOString().split('T')[0],
        end_date: booking.endDate.toISOString().split('T')[0],
        trips_url: `${baseUrl}/trips/${booking.id}`,
      },
    }).catch(() => null);
  }

  return expired.count;
}

/**
 * Auto-decline request-to-book bookings past their deadline (scheduler job).
 */
export async function autoDeclineRequests(db: PrismaClient, now: Date = new Date()) {
  const toDecline = await db.booking.findMany({
    where: {
      status: 'requested',
      requestExpiresAt: { lte: now },
    },
    include: {
      unit: { select: { name: true } },
    },
  });

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

  for (const booking of toDecline) {
    await createNotification(db, {
      identityId: booking.guestIdentityId,
      type: 'stay_request_declined',
      titleKey: 'notify.stay_request_declined.title',
      bodyKey: 'notify.stay_request_declined.body',
      params: {
        booking_id: booking.id,
        unit_name: booking.unit.name,
        start_date: booking.startDate.toISOString().split('T')[0],
        end_date: booking.endDate.toISOString().split('T')[0],
      },
    }).catch(() => null);

    const nights = Math.ceil(
      (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    await track(db, 'stay_request_declined', {
      bookingId: booking.id,
      unitId: booking.unitId,
      projectId: booking.projectId,
      identityId: booking.guestIdentityId,
      nights,
      totalThb: booking.totalThb,
    }).catch(() => null);
  }

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
