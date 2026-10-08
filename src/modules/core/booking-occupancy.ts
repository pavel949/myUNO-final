import type { PaymentMethod, Prisma } from '@prisma/client';

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
