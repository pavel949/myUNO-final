import { describe, expect, it } from 'vitest';
import { scopeOwnerPortfolio } from './portfolio-scope';

const units = [
  { id: 'a', projectId: 'resort', occupancyThisMonth: 12, revenueThisMonth: 45000 },
  { id: 'b', projectId: 'resort', occupancyThisMonth: 8, revenueThisMonth: 30000 },
  { id: 'c', projectId: 'condo', occupancyThisMonth: 5, revenueThisMonth: 25000 },
];

describe('owner portfolio reporting scope', () => {
  it('aggregates all authorized units when all projects are selected', () => {
    const result = scopeOwnerPortfolio(units, null);
    expect(result.units).toHaveLength(3);
    expect(result.occupiedNights).toBe(25);
    expect(result.bookedRevenueThb).toBe(100000);
  });

  it('uses the same scoped units for financial totals and related records', () => {
    const result = scopeOwnerPortfolio(units, 'resort');
    expect(result.units.map((unit) => unit.id)).toEqual(['a', 'b']);
    expect(result.occupiedNights).toBe(20);
    expect(result.bookedRevenueThb).toBe(75000);
    expect(result.unitIds.has('c')).toBe(false);
  });

  it('does not fall back to portfolio totals for an unknown project', () => {
    const result = scopeOwnerPortfolio(units, 'unowned');
    expect(result.units).toEqual([]);
    expect(result.occupiedNights).toBe(0);
    expect(result.bookedRevenueThb).toBe(0);
  });
});
