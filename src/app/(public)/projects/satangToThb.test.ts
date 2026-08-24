import { describe, it, expect } from 'vitest';
import { satangToThb } from './satang-to-thb';

// Q47: fromNightlyThb (and every *Thb domain field) is stored in satang
// (THB x 100); the projects hub must display baht, never raw satang.
describe('satangToThb (projects hub display boundary)', () => {
  it('divides satang by 100 and formats with thousands separators', () => {
    expect(satangToThb(500000)).toBe('5,000');
    expect(satangToThb(100)).toBe('1');
    expect(satangToThb(0)).toBe('0');
  });

  it('rounds to the nearest baht', () => {
    expect(satangToThb(150)).toBe('2'); // 1.5 -> 2
    expect(satangToThb(149)).toBe('1'); // 1.49 -> 1
  });
});
