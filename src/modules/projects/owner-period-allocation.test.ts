import { describe, expect, it } from 'vitest';
import { allocateBookingGrossToPeriod as allocate } from './owner-period-allocation';

describe('owner gross-booking dashboard allocation', () => {
  const inDate = new Date('2026-08-30T00:00:00Z');
  const outDate = new Date('2026-09-02T00:00:00Z');
  it('reconciles a cross-month booking exactly in integer satang', () => {
    const august = allocate(10001, inDate, outDate,
      new Date('2026-08-01'), new Date('2026-09-01'));
    const september = allocate(10001, inDate, outDate,
      new Date('2026-09-01'), new Date('2026-10-01'));
    expect(august).toEqual({ nights: 2, grossSatang: 6667 });
    expect(september).toEqual({ nights: 1, grossSatang: 3334 });
    expect(august.grossSatang + september.grossSatang).toBe(10001);
    expect(august.nights + september.nights).toBe(3);
  });

  it('uses checkout as exclusive end and never spills into the next period', () => {
    expect(allocate(9900, new Date('2026-08-01'), new Date('2026-09-01'),
      new Date('2026-09-01'), new Date('2026-10-01')))
      .toEqual({ nights: 0, grossSatang: 0 });
  });

  it('keeps zero and invalid dates from producing fictional revenue', () => {
    expect(allocate(0, inDate, outDate, inDate, outDate).grossSatang).toBe(0);
    expect(allocate(100, outDate, inDate, inDate, outDate))
      .toEqual({ nights: 0, grossSatang: 0 });
  });

  it('does not repeat a whole booking in two adjacent months', () => {
    const aug=allocate(450000, inDate, outDate,new Date('2026-08-01'),new Date('2026-09-01'));
    const sep=allocate(450000, inDate, outDate,new Date('2026-09-01'),new Date('2026-10-01'));
    expect(aug.grossSatang + sep.grossSatang).toBe(450000);
  });
});
