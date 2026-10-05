import { describe, expect, it } from 'vitest';
import { APP_TZ, UI_LOCALE } from './format';

describe('deterministic client formatting', () => {
  const moment = new Date('2026-10-05T20:30:00Z'); // 03:30 next day in Bangkok

  it('formats a date in the destination timezone, day first', () => {
    expect(moment.toLocaleDateString(UI_LOCALE, { timeZone: APP_TZ })).toBe('06/10/2026');
  });

  it('formats time in 24h Bangkok time', () => {
    expect(moment.toLocaleTimeString(UI_LOCALE, { timeZone: APP_TZ })).toBe('03:30:00');
  });

  it('uses comma thousands separators for amounts', () => {
    expect((1234567).toLocaleString(UI_LOCALE, { timeZone: APP_TZ })).toBe('1,234,567');
  });
});
