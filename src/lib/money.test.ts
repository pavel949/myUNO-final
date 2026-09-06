import { describe, it, expect } from 'vitest';
import { satangToBaht, bahtToSatang, formatBaht } from './money';

describe('satangToBaht — the display edge', () => {
  it('converts whole baht', () => {
    expect(satangToBaht(100000)).toBe(1000);
    expect(satangToBaht(0)).toBe(0);
  });

  it('rounds rather than truncating', () => {
    // ฿99.99 displayed as ฿99 reads as an error to the person holding the
    // invoice, and truncation biases every total downward.
    expect(satangToBaht(9999)).toBe(100);
    expect(satangToBaht(9949)).toBe(99);
  });

  it('handles negatives, which refunds and adjustments produce', () => {
    expect(satangToBaht(-100000)).toBe(-1000);
  });

  it('refuses a non-finite amount rather than rendering NaN', () => {
    expect(() => satangToBaht(NaN)).toThrow(/finite/);
    expect(() => satangToBaht(Infinity)).toThrow(/finite/);
  });
});

describe('bahtToSatang — the storage edge, where Q49/Q50 happened', () => {
  it('multiplies up for storage', () => {
    expect(bahtToSatang(1000)).toBe(100000);
    expect(bahtToSatang(0)).toBe(0);
  });

  it('round-trips against satangToBaht', () => {
    for (const baht of [1, 99, 1000, 72000, 1234567]) {
      expect(satangToBaht(bahtToSatang(baht))).toBe(baht);
    }
  });

  it('accepts an exact half-baht, which is a whole number of satang', () => {
    expect(bahtToSatang(1234.5)).toBe(123450);
  });

  it('refuses fractional satang instead of quietly rounding a financial record', () => {
    expect(() => bahtToSatang(1234.567)).toThrow(/whole number of satang/);
  });

  it('refuses a non-finite amount', () => {
    expect(() => bahtToSatang(NaN)).toThrow(/finite/);
  });
});

describe('formatBaht', () => {
  it('renders the baht sign and thousands separators', () => {
    expect(formatBaht(100000)).toBe('฿1,000');
    expect(formatBaht(720000000)).toBe('฿7,200,000');
  });

  it('renders a negative with a true minus sign, not a hyphen', () => {
    // U+2212 aligns with digits in tabular figures; a hyphen does not.
    expect(formatBaht(-100000)).toBe('−฿1,000');
    expect(formatBaht(-100000).charCodeAt(0)).toBe(0x2212);
  });

  it('shows zero without a sign', () => {
    expect(formatBaht(0)).toBe('฿0');
  });
});
