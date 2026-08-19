import { describe, it, expect } from 'vitest';
import { parseICal } from './ical-parse';

/**
 * The parser is what stands between an OTA's calendar and our availability, so
 * the cases that matter are the ones where being wrong sells a villa twice or
 * blocks one that is free.
 */
describe('parseICal', () => {
  function calendar(...events: string[]): string {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  const reservation = [
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260910',
    'DTEND;VALUE=DATE:20260914',
    'UID:abc123@airbnb.com',
    'SUMMARY:Reserved',
    'END:VEVENT',
  ].join('\r\n');

  it('reads a whole-date reservation', () => {
    const { events } = parseICal(calendar(reservation));

    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('abc123@airbnb.com');
    expect(events[0].summary).toBe('Reserved');
    expect(events[0].dtStart.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(events[0].dtEnd.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('reads several events from one feed', () => {
    const second = reservation
      .replace('abc123@airbnb.com', 'def456@airbnb.com')
      .replace('20260910', '20261001')
      .replace('20260914', '20261005');

    const { events } = parseICal(calendar(reservation, second));

    expect(events.map((e) => e.uid)).toEqual(['abc123@airbnb.com', 'def456@airbnb.com']);
  });

  it('reads a timestamped event as the day it falls on', () => {
    // Availability is counted in nights. A 14:00 arrival occupies that date, and
    // must not shift a day depending on who reads it.
    const timed = [
      'BEGIN:VEVENT',
      'DTSTART:20260910T140000Z',
      'DTEND:20260914T110000Z',
      'UID:timed@booking.com',
      'END:VEVENT',
    ].join('\r\n');

    const { events } = parseICal(calendar(timed));

    expect(events[0].dtStart.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(events[0].dtEnd.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('rejoins a folded line', () => {
    // Feeds wrap at 75 octets, so a long summary arrives split across lines.
    const folded = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260914',
      'UID:folded@airbnb.com',
      'SUMMARY:Reserved for a guest with a very long name that the',
      '  feed had to wrap',
      'END:VEVENT',
    ].join('\r\n');

    const { events } = parseICal(calendar(folded));

    expect(events[0].summary).toBe(
      'Reserved for a guest with a very long name that the feed had to wrap'
    );
  });

  it('unescapes commas and newlines in text', () => {
    const escaped = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260914',
      'UID:escaped@airbnb.com',
      'SUMMARY:Smith\\, John',
      'DESCRIPTION:Line one\\nLine two',
      'END:VEVENT',
    ].join('\r\n');

    const { events } = parseICal(calendar(escaped));

    expect(events[0].summary).toBe('Smith, John');
    expect(events[0].description).toBe('Line one\nLine two');
  });

  it('treats an event with no DTEND as a single night', () => {
    const oneDay = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260910',
      'UID:oneday@agoda.com',
      'END:VEVENT',
    ].join('\r\n');

    const { events } = parseICal(calendar(oneDay));

    expect(events).toHaveLength(1);
    expect(events[0].dtEnd.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  describe('what it refuses to import', () => {
    it('skips an event with no UID, which could not be imported idempotently', () => {
      const noUid = [
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20260910',
        'DTEND;VALUE=DATE:20260914',
        'END:VEVENT',
      ].join('\r\n');

      const { events, skipped } = parseICal(calendar(noUid));

      expect(events).toHaveLength(0);
      expect(skipped[0].reason).toMatch(/UID/);
    });

    it('skips an event with no DTSTART', () => {
      const noStart = ['BEGIN:VEVENT', 'UID:nostart@airbnb.com', 'END:VEVENT'].join('\r\n');

      const { events, skipped } = parseICal(calendar(noStart));

      expect(events).toHaveLength(0);
      expect(skipped[0].reason).toMatch(/DTSTART/);
    });

    it('skips a range that ends before it starts', () => {
      const backwards = [
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20260914',
        'DTEND;VALUE=DATE:20260910',
        'UID:backwards@airbnb.com',
        'END:VEVENT',
      ].join('\r\n');

      const { events, skipped } = parseICal(calendar(backwards));

      expect(events).toHaveLength(0);
      expect(skipped[0].reason).toMatch(/DTEND/);
    });

    it('keeps the good events when one in the middle is malformed', () => {
      // One bad VEVENT must not cost us the rest of the feed.
      const broken = ['BEGIN:VEVENT', 'UID:broken@airbnb.com', 'END:VEVENT'].join('\r\n');

      const { events, skipped } = parseICal(calendar(reservation, broken));

      expect(events.map((e) => e.uid)).toEqual(['abc123@airbnb.com']);
      expect(skipped).toHaveLength(1);
    });
  });

  describe('input that is not a calendar', () => {
    it('returns nothing for an empty string', () => {
      expect(parseICal('').events).toHaveLength(0);
    });

    it('returns nothing for an HTML error page', () => {
      // A feed URL that has expired often returns a login page with status 200.
      expect(parseICal('<html><body>Not found</body></html>').events).toHaveLength(0);
    });
  });
});
