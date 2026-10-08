import { describe, expect, it } from 'vitest';
import { calendarDays, projectCalendar, projectCalendarCell, validCalendarDay } from './calendar-projection';
import type { CalendarEntry } from './calendar-projection';

const now = new Date('2026-09-28T06:00:00.000Z');
const reservation: CalendarEntry = {
  id: 'booking-1', unitId: 'villa-1', kind: 'booking', status: 'confirmed',
  startDate: '2026-10-01', endDate: '2026-10-03',
};
describe('one canonical calendar projection', () => {
  it('uses exclusive checkout date and correctly advances across months', () => {
    expect(calendarDays('2026-09-30', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
    expect(projectCalendarCell([reservation], 'villa-1', '2026-10-01', now).blocking).toBe(true);
    expect(projectCalendarCell([reservation], 'villa-1', '2026-10-03', now).state).toBe('free');
    expect(validCalendarDay('2026-02-30')).toBe(false);
  });
  it('shows requests without blocking available inventory', () => {
    expect(projectCalendarCell([{ ...reservation, status: 'requested' }], 'villa-1', '2026-10-01', now))
      .toMatchObject({ state: 'request', blocking: false });
  });
  it('ignores expired holds and reserves active holds', () => {
    const hold = { ...reservation, status: 'pending_payment' };
    expect(projectCalendarCell([{ ...hold, holdExpiresAt: '2026-09-28T05:00:00.000Z' }], 'villa-1', '2026-10-01', now).state).toBe('free');
    expect(projectCalendarCell([{ ...hold, holdExpiresAt: '2026-09-28T07:00:00.000Z' }], 'villa-1', '2026-10-01', now).state).toBe('hold');
  });
  it('includes source-protection and maintenance blocks without a second availability store', () => {
    const block: CalendarEntry = { id: 'source-1', unitId: 'villa-1', kind: 'block',
      status: 'active', reason: 'ota_import', startDate: '2026-10-02', endDate: '2026-10-05' };
    expect(projectCalendarCell([block], 'villa-1', '2026-10-03', now).state).toBe('external');
    expect(projectCalendarCell([reservation, block], 'villa-1', '2026-10-02', now).state).toBe('conflict');
  });
  it('keeps cash reservations occupied without a card deadline', () => {
    const cash = { ...reservation, status: 'pending_payment', holdExpiresAt: null };
    expect(projectCalendarCell([cash], 'villa-1', '2026-10-01', now))
      .toMatchObject({ state: 'hold', blocking: true, bookingIds: ['booking-1'] });
  });
  it('keeps a physical unit and its booking isolation intact', () => {
    const cells = projectCalendar(['villa-1', 'villa-2'], ['2026-10-01'], [reservation], now);
    expect(cells['villa-1'][0].state).toBe('confirmed');
    expect(cells['villa-2'][0].state).toBe('free');
  });
  it('never treats cancelled, declined, or completed future records as active inventory', () => {
    for (const status of ['cancelled', 'declined', 'expired', 'completed']) {
      expect(projectCalendarCell([{ ...reservation, status }], 'villa-1', '2026-10-01', now).blocking).toBe(false);
    }
  });
});
