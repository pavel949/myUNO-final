import { describe, expect, it } from 'vitest';
import { fulfilmentDeadline } from './service-order-closure';

describe('fulfilment recourse deadline', () => {
  it('uses the fulfilment instant and whole hours, including a year boundary', () => {
    expect(fulfilmentDeadline(new Date('2026-12-31T18:00:00Z'), 48)?.toISOString()).toBe('2027-01-02T18:00:00.000Z');
    expect(fulfilmentDeadline(null, 48)).toBeNull();
  });
  it('refuses malformed or out-of-range policies rather than silently shortening recourse', () => {
    for (const hours of [0, -1, 1.5, '48', NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(() => fulfilmentDeadline(new Date(), hours)).toThrow();
    }
  });
});
