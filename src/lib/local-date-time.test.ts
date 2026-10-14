import { describe, expect, it } from 'vitest';
import { formatDate, localDateTimeToInstant } from './date';

describe('localDateTimeToInstant uses an explicit operating-space zone', () => {
  it.each([
    ['2026-10-16T12:00', 'Asia/Bangkok', '2026-10-16T05:00:00.000Z'],
    ['2026-10-16T12:00', 'UTC', '2026-10-16T12:00:00.000Z'],
    ['2026-01-10T12:00', 'America/New_York', '2026-01-10T17:00:00.000Z'],
    ['2026-07-10T12:00', 'America/New_York', '2026-07-10T16:00:00.000Z'],
    ['2026-10-16T00:15', 'Asia/Kathmandu', '2026-10-15T18:30:00.000Z'],
    ['2028-02-29T00:00', 'Asia/Bangkok', '2028-02-28T17:00:00.000Z'],
  ])('%s in %s is the exact instant %s', (value, zone, expected) => {
    expect(localDateTimeToInstant(value, zone).toISOString()).toBe(expected);
  });

  it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('does not inherit process timezone %s', zone => {
    const original = process.env.TZ;
    try {
      process.env.TZ = zone;
      expect(localDateTimeToInstant('2026-10-16T12:00', 'Asia/Bangkok').toISOString()).toBe('2026-10-16T05:00:00.000Z');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it.each([
    ['2026-03-08T02:30', 'America/New_York'], // skipped hour
    ['2026-11-01T01:30', 'America/New_York'], // repeated hour
    ['2026-04-05T01:45', 'Australia/Lord_Howe'], // repeated half-hour
    ['2011-12-30T12:00', 'Pacific/Apia'], // skipped whole day
    ['2026-02-30T12:00', 'UTC'], ['2026-13-01T12:00', 'UTC'],
    ['2026-10-16T24:00', 'UTC'], ['2026-10-16T12:60', 'UTC'],
    ['2026-10-16T12:00Z', 'UTC'], ['2026-10-16', 'UTC'],
    ['2026-10-16T12:00', 'Not/A_Zone'], ['2026-10-16T12:00', ''],
  ])('rejects invalid or non-unique wall time %s in %s', (value, zone) => {
    expect(() => localDateTimeToInstant(value, zone)).toThrow(RangeError);
  });

  it('round trips noon in the same configured display zone', () => {
    const instant = localDateTimeToInstant('2026-10-16T12:00', 'Asia/Bangkok');
    expect(formatDate(instant, 'en', 'time', 'Asia/Bangkok')).toBe('12:00');
    expect(formatDate(instant, 'en', 'time', 'UTC')).toBe('05:00');
  });
});
