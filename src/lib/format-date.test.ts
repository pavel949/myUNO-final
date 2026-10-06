import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { formatDate } from './date';

describe('formatDate', () => {
  const checkIn = new Date('2026-10-05T00:00:00.000Z'); // a stored calendar day

  it('formats in the UI locale', () => {
    expect(formatDate(checkIn, 'en')).toBe('5 Oct 2026');
    expect(formatDate(checkIn, 'ru')).toMatch(/^5 окт\.? 2026/);
  });

  it('keeps the Gregorian year for Thai (not Buddhist-era 2569)', () => {
    const thai = formatDate(checkIn, 'th');
    expect(thai).toContain('2026');
    expect(thai).not.toContain('2569');
  });

  it('reads a stored calendar day as the same day, whatever the runtime zone', () => {
    expect(formatDate(checkIn, 'en', 'dayMonth')).toBe('5 Oct');
  });

  it('formats instants in the operating zone (Asia/Bangkok)', () => {
    // 2026-10-05 20:30 UTC is 6 Oct 03:30 in Bangkok.
    expect(formatDate(new Date('2026-10-05T20:30:00Z'), 'en', 'dateTime')).toBe('6 Oct 2026, 03:30');
  });

  it('renders nothing for a missing or invalid value', () => {
    expect(formatDate(null, 'en')).toBe('');
    expect(formatDate('not a date', 'en')).toBe('');
  });
});

/**
 * Dates shown to people go through formatDate/<LocalDate>. A bare
 * toLocaleDateString() used the server's en-US and the browser's own zone;
 * a hard-coded 'en-US' showed English months to Russian and Thai visitors.
 */
describe('date formatting call sites', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return files(path);
      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
    });
  const UNLOCALIZED = /\.toLocale(Date|Time)String\(\s*(\)|undefined\s*,\s*\{|'en-(US|GB)'\s*,\s*\{[^}]*(month|weekday|day|year))/;

  it('no source file formats a date without the UI locale', () => {
    const offenders = files(SRC)
      .filter((file) => !file.endsWith('src/lib/date.ts'))
      .flatMap((file) =>
        readFileSync(file, 'utf8').split('\n')
          .map((line, i) => (UNLOCALIZED.test(line) && !/^\s*(\*|\/\/)/.test(line) ? `${relative(process.cwd(), file)}:${i + 1}` : null))
          .filter((hit): hit is string => hit !== null));
    expect(offenders).toEqual([]);
  });
});
