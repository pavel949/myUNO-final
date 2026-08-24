import { describe, it, expect } from 'vitest';
import { computeOrderPreviewThb, computeOrderPreviewBaht } from './order-preview';

describe('computeOrderPreviewThb (SA-2 preview — server total stays authoritative)', () => {
  it('multiplies base price by quantity', () => {
    expect(computeOrderPreviewThb('fixed', 1500, 3)).toBe(4500);
    expect(computeOrderPreviewThb('per_person', 800, 2)).toBe(1600);
  });

  it('floors and clamps quantity to at least 1', () => {
    expect(computeOrderPreviewThb('fixed', 1000, 0)).toBe(1000);
    expect(computeOrderPreviewThb('fixed', 1000, 2.9)).toBe(2000);
  });

  it('returns null for quote services and missing base price', () => {
    expect(computeOrderPreviewThb('quote', 5000, 1)).toBeNull();
    expect(computeOrderPreviewThb('fixed', null, 1)).toBeNull();
  });
});

// Q47 regression guard: basePriceThb is satang (THB × 100) straight from the
// DB — the wizard's on-screen preview must show baht, not raw satang.
describe('computeOrderPreviewBaht (Q47 satang-to-baht display fix)', () => {
  it('divides the satang preview by 100 for display', () => {
    // ฿500 base × 3 = ฿1,500, i.e. 50000 satang × 3 = 150000 satang
    expect(computeOrderPreviewBaht('fixed', 50000, 3)).toBe(1500);
  });

  it('matches computeOrderPreviewThb / 100 exactly', () => {
    const satang = computeOrderPreviewThb('per_person', 80000, 2);
    expect(computeOrderPreviewBaht('per_person', 80000, 2)).toBe((satang as number) / 100);
  });

  it('returns null for quote services and missing base price', () => {
    expect(computeOrderPreviewBaht('quote', 50000, 1)).toBeNull();
    expect(computeOrderPreviewBaht('fixed', null, 1)).toBeNull();
  });
});
