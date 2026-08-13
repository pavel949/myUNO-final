import { describe, it, expect } from 'vitest';
import { computeOrderPreviewThb } from './order-preview';

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
