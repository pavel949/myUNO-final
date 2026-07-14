import { PrismaClient, BookingStatus } from '@prisma/client';

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

/**
 * Create a new booking.
 * Instant bookings go to pending_payment; request-to-book go to requested.
 */
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

  // Check for double-booking (race condition)
  const conflicting = await db.booking.findFirst({
    where: {
      unitId,
      status: { in: ['confirmed', 'checked_in', 'pending_payment'] },
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
  });

  if (conflicting) {
    const err = new Error('Dates unavailable — booking already exists');
    (err as any).code = 'DOUBLE_BOOK';
    throw err;
  }

  const initialStatus: BookingStatus = instantBook ? 'pending_payment' : 'requested';
  const now = new Date();

  return db.booking.create({
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
      guestIdentity: true,
    },
  });
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

  const now = new Date();
  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'pending_payment',
      holdExpiresAt: new Date(now.getTime() + holdMinutes * 60 * 1000),
      requestExpiresAt: null,
    },
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

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'confirmed',
      holdExpiresAt: null,
    },
  });
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

  const cancellableStatuses: BookingStatus[] = ['pending_payment', 'confirmed', 'checked_in'];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new Error(`Cannot cancel booking with status ${booking.status}`);
  }

  return db.booking.update({
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

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'checked_in',
      checkedInAt,
    },
  });
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

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'checked_out',
      checkedOutAt,
    },
  });
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

  return db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'completed',
    },
  });
}

/**
 * Expire pending_payment holds (scheduler job).
 */
export async function expireHolds(db: PrismaClient, now: Date = new Date()) {
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
      guestIdentity: true,
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
