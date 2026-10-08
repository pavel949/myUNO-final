import type { Booking, BookingStatus, PrismaClient } from '@prisma/client';
import { computeRefundAmount, type CancellationPolicy } from './cancellation';

/** The exact booking version and money amount displayed for confirmation. */
export interface CancellationQuote {
  bookingId: string;
  bookingUpdatedAt: string;
  bookingStatus: BookingStatus;
  refundAmountSatang: number;
}

type QuoteBooking = Pick<Booking, 'id' | 'updatedAt' | 'status' | 'totalThb' | 'startDate' | 'cancellationPolicySnapshot'>;

/** Shared by the displayed preview and the locked cancellation writer. */
export async function getCancellationQuote(
  db: Pick<PrismaClient, 'payment'>,
  booking: QuoteBooking,
  now = new Date()
): Promise<CancellationQuote> {
  let refundAmountSatang = 0;
  const policy = booking.cancellationPolicySnapshot as unknown as CancellationPolicy | null;
  if (['confirmed', 'checked_in'].includes(booking.status) && policy?.steps) {
    const payments = await db.payment.findMany({ where: {
      bookingId: booking.id, status: 'succeeded', reconciliationReason: null,
      purpose: { in: ['stay', 'stay_balance'] },
    }, select: {
      amountThb: true,
      refunds: { where: { status: { in: ['requested', 'processing', 'succeeded'] } }, select: { amountThb: true } },
    } });
    const capacity = payments.reduce((sum, payment) => sum + Math.max(0,
      payment.amountThb - payment.refunds.reduce((total, refund) => total + refund.amountThb, 0)), 0);
    refundAmountSatang = Math.min(capacity,
      computeRefundAmount(booking.totalThb, policy.steps, booking.startDate, now));
  }
  return { bookingId: booking.id, bookingUpdatedAt: booking.updatedAt.toISOString(),
    bookingStatus: booking.status, refundAmountSatang };
}

export function parseCancellationQuote(value: unknown): CancellationQuote | null {
  if (!value || typeof value !== 'object') return null;
  const quote = value as Partial<CancellationQuote>;
  if (typeof quote.bookingId !== 'string' || typeof quote.bookingUpdatedAt !== 'string' ||
      !Number.isFinite(Date.parse(quote.bookingUpdatedAt)) || typeof quote.bookingStatus !== 'string' ||
      !['requested', 'pending_payment', 'confirmed', 'checked_in'].includes(quote.bookingStatus) ||
      typeof quote.refundAmountSatang !== 'number' || !Number.isSafeInteger(quote.refundAmountSatang) ||
      quote.refundAmountSatang < 0) return null;
  return quote as CancellationQuote;
}

export function cancellationQuotesMatch(accepted: CancellationQuote, current: CancellationQuote): boolean {
  return accepted.bookingId === current.bookingId && accepted.bookingUpdatedAt === current.bookingUpdatedAt &&
    accepted.bookingStatus === current.bookingStatus && accepted.refundAmountSatang === current.refundAmountSatang;
}
