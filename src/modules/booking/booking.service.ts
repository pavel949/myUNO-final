import { PrismaClient, BookingStatus } from '@prisma/client';
import { track } from '@/modules/analytics';

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
 * Category-first booking (LY-6): pick the first available live unit of a
 * sellable category for the requested dates — hotel-style auto-assignment.
 * Stable order (by name) keeps assignment deterministic; the double-booking
 * guard inside createBooking stays the race-safety net.
 * Returns null when the category has no free unit for the range.
 */
export async function resolveUnitForCategory(
  db: PrismaClient,
  projectId: string,
  categoryKey: string,
  startDate: Date,
  endDate: Date
): Promise<{ id: string; instantBook: boolean } | null> {
  const units = await db.unit.findMany({
    where: { projectId, categoryKey, status: 'live' },
    orderBy: { name: 'asc' },
    select: { id: true, instantBook: true },
  });

  for (const unit of units) {
    const conflictingBooking = await findBlockingConflict(
      db,
      unit.id,
      startDate,
      endDate
    );
    if (conflictingBooking) continue;

    const blocked = await db.blockedDate.findFirst({
      where: {
        unitId: unit.id,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { id: true },
    });
    if (blocked) continue;

    return unit;
  }

  return null;
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

  // Check for double-booking (race condition). An unpaid hold only blocks
  // while it is still live — an abandoned checkout must not poison the dates.
  const conflicting = await findBlockingConflict(db, unitId, startDate, endDate);

  if (conflicting) {
    const err = new Error('Dates unavailable — booking already exists');
    (err as any).code = 'DOUBLE_BOOK';
    throw err;
  }

  const initialStatus: BookingStatus = instantBook ? 'pending_payment' : 'requested';
  const now = new Date();

  const booking = await db.booking.create({
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
  return db.booking.update({
    where: { id: bookingId },
    data: {
      unitId,
      status: 'pending_payment',
      holdExpiresAt: new Date(now.getTime() + holdMinutes * 60 * 1000),
      requestExpiresAt: null,
    },
    include: { unit: { select: { name: true } } },
  });
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

/**
 * Request a booking extension (extend endDate).
 */
export async function requestExtension(
  db: PrismaClient,
  bookingId: string,
  newEndDate: Date
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.status !== 'checked_in') {
    throw new Error(`Cannot request extension for booking with status ${booking.status}`);
  }

  if (newEndDate <= booking.endDate) {
    throw new Error('New end date must be after current end date');
  }

  const additionalNights = Math.ceil(
    (newEndDate.getTime() - booking.endDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Track analytics event
  await track(db, 'stay_extension_requested', {
    bookingId,
    unitId: booking.unitId,
    projectId: booking.projectId,
    identityId: booking.guestIdentityId,
    addedNights: additionalNights,
  }).catch(() => null);

  // For now, just return the request info. Actual extension logic would follow.
  return {
    bookingId,
    currentEndDate: booking.endDate,
    newEndDate,
    additionalNights,
  };
}

/**
 * Mark a booking as no-show (tracking event; status remains checked_out until resolved).
 */
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
