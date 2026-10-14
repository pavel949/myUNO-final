import { describe, expect, it } from 'vitest';
import { BOOKING_WINDOWS, validateBookingWindow, type BookingWindowKey } from './booking-windows';

describe('booking window validation', () => {
  it('preserves the documented 30-minute card and 24-hour request/manual defaults', () => {
    expect(Object.values(BOOKING_WINDOWS).map(window => window.defaultValue)).toEqual([30, 24, 24]);
  });
  for (const key of Object.keys(BOOKING_WINDOWS) as BookingWindowKey[]) {
    it.each([0, -1, 1.5, '24', null, NaN, Infinity, Number.MAX_SAFE_INTEGER])(`rejects unsafe ${key}=%s`, value => {
      expect(() => validateBookingWindow(key, value)).toThrow(/positive whole units/);
    });
    it(`accepts explicit valid ${key} without clamping it to the default`, () => {
      expect(validateBookingWindow(key, 12)).toBe(12);
    });
  }
});
