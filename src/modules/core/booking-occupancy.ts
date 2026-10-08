import type { Booking, PaymentMethod, Prisma } from '@prisma/client';

/** All stay settlement writers take locks in this order: unit, booking, payment.
 * The row lock also serializes older conditional expiry/cancellation writers.
 * No provider network operation belongs inside this transaction.
 */
export async function lockBookingInventory(tx: Prisma.TransactionClient, bookingId: string) {
  const snapshot = await tx.booking.findUnique({ where: { id: bookingId }, select: { unitId: true } });
  if (!snapshot) return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${snapshot.unitId}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
  await tx.$queryRaw`SELECT id FROM booking WHERE id = ${bookingId} FOR UPDATE`;
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (booking && booking.unitId !== snapshot.unitId) {
    // A concurrent reassignment won. Retry from a fresh unit; never acquire a
    // second unit lock in an inconsistent order or confirm stale inventory.
    throw new Error('Booking inventory changed; retry with its current unit');
  }
  return booking;
}

/** Call only while holding lockBookingInventory for this booking. */
export async function initialStayConfirmationIssue(
  tx: Prisma.TransactionClient,
  booking: Pick<Booking, 'id' | 'unitId' | 'status' | 'holdExpiresAt' | 'startDate' | 'endDate'>,
  now: Date = new Date(),
): Promise<string | null> {
  if (booking.status !== 'pending_payment') return 'BOOKING_NOT_PENDING';
  if (!isActiveBookingHold(booking.holdExpiresAt, now)) return 'BOOKING_HOLD_EXPIRED';
  const range = { unitId: booking.unitId, startDate: { lt: booking.endDate }, endDate: { gt: booking.startDate } };
  if (await tx.blockedDate.count({ where: range })) return 'BOOKING_DATES_BLOCKED';
  if (await tx.booking.count({ where: { ...range, id: { not: booking.id }, OR: blockingBookingConditions(now) } })) {
    return 'BOOKING_DATES_OCCUPIED';
  }
  return null;
}

/** Null is an untimed reservation awaiting a manual payment, not free inventory. */
export function isActiveBookingHold(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt === null || expiresAt > now;
}

/** Shared by booking, discovery, operations and external occupancy intake. */
export function blockingBookingConditions(now: Date = new Date()): Prisma.BookingWhereInput[] {
  return [
    { status: { in: ['confirmed', 'checked_in'] } },
    { status: 'pending_payment', OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
  ];
}

/** Cash and transfer are manually reconciled; only card/legacy holds time out. */
export function paymentHoldExpiry(method: PaymentMethod | null | undefined, now: Date, holdMinutes: number): Date | null {
  return method === 'cash' || method === 'bank_transfer'
    ? null
    : new Date(now.getTime() + holdMinutes * 60 * 1000);
}
