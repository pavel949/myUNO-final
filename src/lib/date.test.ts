import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  calendarDayIn,
  monthDayIn,
  toCalendarDay,
  startOfCalendarDayUtc,
  startOfUtcDay,
  daysBetween,
  addDays,
  daysUntil,
} from './date';

describe('calendarDayIn — an instant only has a day once you name a zone', () => {
  it('reads 06:00 in Phuket as that day, not the UTC day before it', () => {
    // The bug this module exists to prevent. 06:00 ICT on the 10th is 23:00
    // UTC on the 9th: for seven hours of every day a UTC answer is off by one.
    const earlyMorningInPhuket = new Date('2026-11-09T23:00:00.000Z');
    expect(calendarDayIn(earlyMorningInPhuket, 'Asia/Bangkok')).toBe('2026-11-10');
    expect(toCalendarDay(earlyMorningInPhuket)).toBe('2026-11-09');
  });

  it('agrees with UTC once the two zones are on the same day', () => {
    const middayInPhuket = new Date('2026-11-10T05:00:00.000Z');
    expect(calendarDayIn(middayInPhuket, 'Asia/Bangkok')).toBe('2026-11-10');
    expect(toCalendarDay(middayInPhuket)).toBe('2026-11-10');
  });

  it('defaults to where the platform operates', () => {
    expect(DEFAULT_TIME_ZONE).toBe('Asia/Bangkok');
    const instant = new Date('2026-11-09T23:00:00.000Z');
    expect(calendarDayIn(instant)).toBe(calendarDayIn(instant, 'Asia/Bangkok'));
  });

  it('handles a zone behind UTC too, so the helper is not Phuket-only', () => {
    // 01:00 UTC on the 10th is still the 9th in New York.
    const instant = new Date('2026-11-10T01:00:00.000Z');
    expect(calendarDayIn(instant, 'America/New_York')).toBe('2026-11-09');
  });
});

describe('monthDayIn — season boundaries are year-agnostic', () => {
  it('returns MM-DD in the named zone', () => {
    expect(monthDayIn(new Date('2026-12-14T23:00:00.000Z'), 'Asia/Bangkok')).toBe('12-15');
  });

  it('rolls the month over with the day', () => {
    // 31 Dec 23:00 UTC is already 1 Jan in Phuket — a season that starts on
    // 01-01 must begin here, not seven hours later.
    expect(monthDayIn(new Date('2026-12-31T23:00:00.000Z'), 'Asia/Bangkok')).toBe('01-01');
  });
});

describe('stored calendar days', () => {
  it('round-trips a day string through UTC midnight', () => {
    const stored = startOfCalendarDayUtc('2026-11-10');
    expect(stored.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(toCalendarDay(stored)).toBe('2026-11-10');
  });

  it('refuses anything that is not a calendar day rather than guessing', () => {
    expect(() => startOfCalendarDayUtc('10/11/2026')).toThrow(/calendar day/);
    expect(() => startOfCalendarDayUtc('2026-11-10T00:00:00Z')).toThrow(/calendar day/);
    expect(() => startOfCalendarDayUtc('2026-13-40')).toThrow(/calendar day/);
  });

  it('normalises an instant to the UTC midnight of its day', () => {
    expect(startOfUtcDay(new Date('2026-11-10T17:42:13.500Z')).toISOString()).toBe(
      '2026-11-10T00:00:00.000Z'
    );
  });
});

describe('daysBetween — nights in a stay', () => {
  it('counts nights between two stored dates', () => {
    expect(daysBetween(startOfCalendarDayUtc('2026-11-10'), startOfCalendarDayUtc('2026-11-14'))).toBe(4);
  });

  it('is zero for the same day and negative when reversed', () => {
    const day = startOfCalendarDayUtc('2026-11-10');
    expect(daysBetween(day, day)).toBe(0);
    expect(daysBetween(startOfCalendarDayUtc('2026-11-14'), day)).toBe(-4);
  });

  it('ignores a time component on either end', () => {
    // A caller that hands in `new Date()` for one side must not get 3 nights
    // where the calendar says 4.
    expect(daysBetween(new Date('2026-11-10T23:59:59.999Z'), new Date('2026-11-14T00:00:00.000Z'))).toBe(4);
  });

  it('counts correctly across a month and a year boundary', () => {
    expect(daysBetween(startOfCalendarDayUtc('2026-01-30'), startOfCalendarDayUtc('2026-02-02'))).toBe(3);
    expect(daysBetween(startOfCalendarDayUtc('2026-12-30'), startOfCalendarDayUtc('2027-01-02'))).toBe(3);
  });

  it('counts a leap day', () => {
    expect(daysBetween(startOfCalendarDayUtc('2028-02-28'), startOfCalendarDayUtc('2028-03-01'))).toBe(2);
  });
});

describe('addDays', () => {
  it('walks nights forward one at a time', () => {
    expect(toCalendarDay(addDays(startOfCalendarDayUtc('2026-11-10'), 1))).toBe('2026-11-11');
  });

  it('crosses a month end and goes backwards', () => {
    expect(toCalendarDay(addDays(startOfCalendarDayUtc('2026-01-31'), 1))).toBe('2026-02-01');
    expect(toCalendarDay(addDays(startOfCalendarDayUtc('2026-01-01'), -1))).toBe('2025-12-31');
  });
});

describe('daysUntil — an instant measured against a stored day', () => {
  it('does not lose a day to the UTC offset', () => {
    // Booked at 06:00 ICT on 1 Nov for a 30 Nov check-in: 29 days ahead.
    // Normalising the instant in UTC instead would put "today" on 31 Oct and
    // report 30 — which is the difference between qualifying for an early-bird
    // discount and not.
    const bookedAt = new Date('2026-10-31T23:00:00.000Z'); // 06:00 ICT, 1 Nov
    const checkIn = startOfCalendarDayUtc('2026-11-30');
    expect(daysUntil(bookedAt, checkIn, 'Asia/Bangkok')).toBe(29);
  });

  it('is zero when the instant falls on the target day in that zone', () => {
    const bookedAt = new Date('2026-11-09T23:00:00.000Z'); // 06:00 ICT, 10 Nov
    expect(daysUntil(bookedAt, startOfCalendarDayUtc('2026-11-10'), 'Asia/Bangkok')).toBe(0);
  });

  it('is negative once the target day has passed', () => {
    const bookedAt = new Date('2026-11-12T05:00:00.000Z');
    expect(daysUntil(bookedAt, startOfCalendarDayUtc('2026-11-10'), 'Asia/Bangkok')).toBe(-2);
  });
});
