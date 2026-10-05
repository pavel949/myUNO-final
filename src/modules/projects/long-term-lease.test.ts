import { describe, expect, it } from 'vitest';
import { matchesLongTermLeaseSearch, normalizeLongTermLeaseTerms } from './long-term-lease';

describe('long-term lease contract', () => {
  it('normalizes the supported commercial-offering fields', () => {
    expect(normalizeLongTermLeaseTerms(
      {
        monthlyRentThb: 120000,
        securityDepositMonths: 2,
        advanceRentMonths: 1,
        utilitiesIncluded: ['wifi'],
        utilitiesExcluded: ['electricity'],
      },
      {
        minimumLeaseMonths: 12,
        maximumLeaseMonths: 24,
        availableFrom: '2026-11-15',
        petsAllowed: true,
      },
    )).toEqual({
      monthlyRentThb: 120000,
      minimumLeaseMonths: 12,
      maximumLeaseMonths: 24,
      availableFrom: '2026-11-15',
      securityDepositMonths: 2,
      advanceRentMonths: 1,
      petsAllowed: true,
      utilitiesIncluded: ['wifi'],
      utilitiesExcluded: ['electricity'],
    });
  });

  it('fails closed on incompatible move-in, term and pet requirements', () => {
    const terms = normalizeLongTermLeaseTerms(
      { monthlyRentThb: 95000 },
      { minimumLeaseMonths: 6, maximumLeaseMonths: 12, availableFrom: '2026-12-01', petsAllowed: false },
    );
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-11', leaseTermMonths: 12 })).toBe(false);
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-12', leaseTermMonths: 3 })).toBe(false);
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-12', leaseTermMonths: 18 })).toBe(false);
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-12', leaseTermMonths: 12, pets: 'yes' })).toBe(false);
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-12', leaseTermMonths: 12, pets: 'no' })).toBe(true);
  });

  it('does not invent restrictions when optional lease facts are unknown', () => {
    const terms = normalizeLongTermLeaseTerms({ monthlyThb: 70000 }, {});
    expect(matchesLongTermLeaseSearch(terms, { moveIn: '2026-10', leaseTermMonths: 12, pets: 'yes' })).toBe(true);
  });
});
