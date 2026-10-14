import { describe, expect, it } from 'vitest';
import { remainingAnnualWindows } from './tariff-calendar';
import { quoteSeasonalTariffGrid } from './seasonal-tariff';
const season = (start: string, end: string) => ({ windows: [{ start, end }] });
describe('explicit annual base-date fill', () => {
  it('starts with the full leap calendar and is repeatable', () => {
    expect(remainingAnnualWindows([season('', '')], 0)).toEqual([{ start: '01-01', end: '12-31' }]);
    const seasons = [season('01-01', '12-31'), season('06-01', '08-31')];
    const windows = remainingAnnualWindows(seasons, 0);
    expect(windows).toEqual([{ start: '01-01', end: '05-31' }, { start: '09-01', end: '12-31' }]);
    expect(remainingAnnualWindows([{ windows }, seasons[1]], 0)).toEqual(windows);
  });
  it('handles a season spanning New Year with inclusive endpoints', () => {
    expect(remainingAnnualWindows([season('', ''), season('12-20', '01-10')], 0))
      .toEqual([{ start: '01-11', end: '12-19' }]);
  });
  it('retains leap day and excludes an explicit leap-day exception', () => {
    expect(remainingAnnualWindows([season('', ''), season('03-01', '12-31')], 0))
      .toEqual([{ start: '01-01', end: '02-29' }]);
    expect(remainingAnnualWindows([season('', ''), season('02-29', '02-29')], 0))
      .toEqual([{ start: '01-01', end: '02-28' }, { start: '03-01', end: '12-31' }]);
  });
  it('refuses competing seasons including one shared endpoint', () => {
    expect(() => remainingAnnualWindows([season('', ''), season('05-01', '06-01'), season('06-01', '07-01')], 0))
      .toThrow('conflicting_dates');
  });
  it('fails visibly for incomplete dates and a fully allocated calendar', () => {
    for (const invalid of [season('', ''), season('02-30', '03-01')])
      expect(() => remainingAnnualWindows([season('', ''), invalid], 0)).toThrow('invalid_dates');
    expect(() => remainingAnnualWindows([season('', ''), season('01-01', '12-31')], 0)).toThrow('no_remaining_dates');
    expect(() => remainingAnnualWindows([], 0)).toThrow('invalid_dates');
  });
  it('does not mutate any input and quotes each boundary through the canonical calculator', () => {
    const seasons = [season('01-01', '12-31'), season('12-20', '01-10')];
    const before = JSON.stringify(seasons);
    const base = remainingAnnualWindows(seasons, 0);
    expect(JSON.stringify(seasons)).toBe(before);
    const row = (id: string, windows: typeof base, amount: number) => ({ sourceRateId: id, seasonCode: id,
      dateWindows: windows, rateMode: 'daily', pricingUnit: 'night', amountSatang: amount,
      minimumNights: 1, currency: 'THB', includesTaxes: true, includesServiceCharge: true,
      includesBreakfast: false, sourceSellable: true });
    const grid = [row('BASE', base, 123400), row('HOLIDAY', seasons[1].windows, 234500)];
    expect(quoteSeasonalTariffGrid(grid, '2028-01-10', '2028-01-12', 'daily').subtotalSatang).toBe(357900);
    expect(quoteSeasonalTariffGrid(grid, '2028-02-28', '2028-03-01', 'daily').subtotalSatang).toBe(246800);
    expect(quoteSeasonalTariffGrid(grid, '2028-12-19', '2028-12-21', 'daily').subtotalSatang).toBe(357900);
  });
});
