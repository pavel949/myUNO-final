import { prisma } from '@/lib/prisma';
import { t, type Locale } from '@/modules/content';

/** Host-selected decline reasons for request-to-book (doc 07 F-OPS-5). */
export const BOOKING_REQUEST_DECLINE_REASONS = [
  'dates_unavailable',
  'minimum_stay',
  'house_rules',
  'other',
] as const;

export type BookingRequestDeclineReason = (typeof BOOKING_REQUEST_DECLINE_REASONS)[number];

const DECLINE_REASON_SET = new Set<string>(BOOKING_REQUEST_DECLINE_REASONS);

export function bookingRequestDeclineReasonLabelKey(code: BookingRequestDeclineReason): string {
  return `booking.decline_reason.${code}`;
}

export function isBookingRequestDeclineReason(value: unknown): value is BookingRequestDeclineReason {
  return typeof value === 'string' && DECLINE_REASON_SET.has(value);
}

export function formatDeclineCancellationReason(code: BookingRequestDeclineReason): string {
  return `declined:${code}`;
}

export function parseDeclineCancellationReason(
  cancellationReason: string | null | undefined
): BookingRequestDeclineReason | null {
  if (!cancellationReason?.startsWith('declined:')) return null;
  const code = cancellationReason.slice('declined:'.length);
  return isBookingRequestDeclineReason(code) ? code : null;
}

const DECLINE_REASON_FALLBACKS: Record<BookingRequestDeclineReason, string> = {
  dates_unavailable: 'Dates are not available',
  minimum_stay: 'Minimum stay requirement not met',
  house_rules: 'Does not fit house rules',
  other: 'Other',
};

export async function getBookingDeclineReasonOptions(
  locale: Locale = 'en'
): Promise<{ code: BookingRequestDeclineReason; label: string }[]> {
  return Promise.all(
    BOOKING_REQUEST_DECLINE_REASONS.map(async (code) => {
      const key = bookingRequestDeclineReasonLabelKey(code);
      try {
        const label = await t(prisma, key, undefined, locale);
        return {
          code,
          label: label && label !== key && label !== '—' ? label : DECLINE_REASON_FALLBACKS[code],
        };
      } catch {
        return { code, label: DECLINE_REASON_FALLBACKS[code] };
      }
    })
  );
}
