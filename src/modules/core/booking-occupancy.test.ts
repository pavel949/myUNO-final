import { describe, expect, it, vi } from 'vitest';
import {
  blockingBookingConditions,
  initialStayConfirmationIssue,
  isActiveBookingHold,
  paymentHoldExpiry,
} from './booking-occupancy';

const now = new Date('2026-10-15T10:00:00.000Z');
const startDate = new Date('2026-11-01T00:00:00.000Z');
const endDate = new Date('2026-11-05T00:00:00.000Z');
const pending = {
  id: 'booking-1', unitId: 'unit-1', status: 'pending_payment' as const,
  holdExpiresAt: new Date(now.getTime() + 60_000), startDate, endDate,
};

describe('shared booking occupancy contract', () => {
  it('holds untimed and future pending payments, but releases expired holds', () => {
    expect(isActiveBookingHold(null, now)).toBe(true);
    expect(isActiveBookingHold(new Date(now.getTime() + 1), now)).toBe(true);
    expect(isActiveBookingHold(now, now)).toBe(false);
    expect(isActiveBookingHold(new Date(now.getTime() - 1), now)).toBe(false);
  });

  it('uses one predicate for confirmed, checked-in and active payment holds', () => {
    expect(blockingBookingConditions(now)).toEqual([
      { status: { in: ['confirmed', 'checked_in'] } },
      { status: 'pending_payment', OR: [
        { holdExpiresAt: null }, { holdExpiresAt: { gt: now } },
      ] },
    ]);
  });

  it('expires manual payment holds after the configured window', () => {
    expect(paymentHoldExpiry('cash', now, 30).getTime() - now.getTime()).toBe(24 * 60 * 60_000);
    expect(paymentHoldExpiry('bank_transfer', now, 30, 120).getTime() - now.getTime()).toBe(120 * 60_000);
  });

  it('rejects an expired hold without confirming the booking', async () => {
    const tx = { blockedDate: { count: vi.fn() }, booking: { count: vi.fn() } };
    const result = await initialStayConfirmationIssue(tx as never, {
      ...pending, holdExpiresAt: now,
    }, now);
    expect(result).toBe('BOOKING_HOLD_EXPIRED');
    expect(tx.blockedDate.count).not.toHaveBeenCalled();
  });

  it('rejects manual blocks before checking competing bookings', async () => {
    const tx = { blockedDate: { count: vi.fn().mockResolvedValue(1) }, booking: { count: vi.fn() } };
    expect(await initialStayConfirmationIssue(tx as never, pending, now)).toBe('BOOKING_DATES_BLOCKED');
    expect(tx.booking.count).not.toHaveBeenCalled();
  });

  it('rejects overlapping occupied dates for the same physical unit', async () => {
    const tx = {
      blockedDate: { count: vi.fn().mockResolvedValue(0) },
      booking: { count: vi.fn().mockResolvedValue(1) },
    };
    expect(await initialStayConfirmationIssue(tx as never, pending, now)).toBe('BOOKING_DATES_OCCUPIED');
    expect(tx.booking.count).toHaveBeenCalledWith({ where: {
      unitId: pending.unitId, startDate: { lt: endDate }, endDate: { gt: startDate },
      id: { not: pending.id }, OR: blockingBookingConditions(now),
    } });
  });

  it('permits confirmation only when no block or conflicting booking exists', async () => {
    const tx = {
      blockedDate: { count: vi.fn().mockResolvedValue(0) },
      booking: { count: vi.fn().mockResolvedValue(0) },
    };
    expect(await initialStayConfirmationIssue(tx as never, pending, now)).toBeNull();
  });
});
