import { describe, it, expect } from 'vitest';
import { baht } from './services-client';

// Locks in the Q47 satang-shown-as-baht fix on the guest-facing services
// browse page (list price, per-order confirm total, and "my orders" total).
// basePriceThb / totalThb arrive from /api/services and /api/service-orders
// as satang (THB × 100) straight from the DB — CLAUDE.md "Money rules".
describe('services-client baht()', () => {
  it('converts a realistic service base price from satang to baht', () => {
    // e.g. a ฿500 cleaning service stored as basePriceThb: 50000
    expect(baht(50000)).toBe('500');
  });

  it('converts a larger total (base price × quantity) correctly', () => {
    // ฿500 base × 10 = ฿5,000, stored/derived as 500000 satang
    expect(baht(500000)).toBe('5,000');
  });

  it('never lets a satang value pass straight through unconverted', () => {
    // Regression guard for the original bug: rendering the raw satang int
    // as if it were already baht (500000 shown as "500,000" instead of
    // "5,000").
    expect(baht(500000)).not.toBe((500000).toLocaleString());
  });

  it('handles zero', () => {
    expect(baht(0)).toBe('0');
  });
});
