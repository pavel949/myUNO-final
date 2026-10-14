/** Canonical config defaults and units from config/seed.ts (doc 04). */
export const BOOKING_WINDOWS = {
  'booking.hold_minutes': { defaultValue: 30, milliseconds: 60_000 },
  'booking.manual_payment_hold_hours': { defaultValue: 24, milliseconds: 3_600_000 },
  'booking.request_hours': { defaultValue: 24, milliseconds: 3_600_000 },
} as const;
export type BookingWindowKey = keyof typeof BOOKING_WINDOWS;

/** No new commercial ceiling: bound by the timestamp representation itself. */
export function validateBookingWindow(key: BookingWindowKey, value: unknown, now = Date.now()): number {
  const duration = typeof value === 'number' ? value * BOOKING_WINDOWS[key].milliseconds : NaN;
  if (!Number.isSafeInteger(value) || (value as number) <= 0 ||
      !Number.isSafeInteger(duration) || !Number.isFinite(new Date(now + duration).getTime())) {
    throw new Error(`${key} must be positive whole units within the supported date range`);
  }
  return value as number;
}
