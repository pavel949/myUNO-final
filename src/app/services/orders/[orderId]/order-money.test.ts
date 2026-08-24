import { describe, it, expect } from 'vitest';
import { baht, formatBreakdownValue } from './order-money';

// Q47 regression guard: every money field on the order-detail page
// (totalThb, refundAccruedThb, payments[].amountThb, priceBreakdown's
// *_thb entries) arrives as satang straight from the DB.
describe('baht', () => {
  it('converts satang to a baht display string', () => {
    expect(baht(50000)).toBe('500');
    expect(baht(500000)).toBe('5,000');
  });

  it('does not leave a raw satang value looking like baht', () => {
    // The original bug: order.totalThb.toLocaleString() showed 500000 as
    // "500,000" — 100x the real ฿5,000.
    expect(baht(500000)).not.toBe((500000).toLocaleString());
  });
});

describe('formatBreakdownValue', () => {
  it('converts *_thb keys from satang to baht', () => {
    expect(formatBreakdownValue('base_thb', 50000)).toBe('฿500');
    expect(formatBreakdownValue('total_thb', 250000)).toBe('฿2,500');
  });

  it('leaves non-money keys (e.g. quantity) untouched', () => {
    expect(formatBreakdownValue('quantity', 5)).toBe('5');
  });
});
