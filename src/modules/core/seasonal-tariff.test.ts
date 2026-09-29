import { describe, expect, it } from 'vitest';
import { quoteSeasonalTariffGrid as quote, previewAnnualLeaseTariff, type TariffRow } from './seasonal-tariff';

const row = (id: string, start: string, end: string, amount: number,
  mode: 'daily' | 'monthly' = 'daily', min: number = 1): TariffRow => ({
  sourceRateId: id, seasonCode: id, dateWindows: [{ start, end }],
  rateMode: mode, pricingUnit: mode === 'daily' ? 'night' : '30_nights',
  amountSatang: amount, currency: 'THB', minimumNights: min,
  includesTaxes: mode === 'daily', includesServiceCharge: mode === 'daily',
  includesBreakfast: mode === 'daily', sourceSellable: true,
});
describe('project-neutral canonical tariff grid', () => {
  it('retains the annual rental as a signed contract, not a nightly booking', () => {
    const annual={...row('YEAR','01-01','12-31',8000000,'monthly',365),
      rateMode:'yearly',pricingUnit:'month',dateWindows:[]};
    const result=previewAnnualLeaseTariff([annual]);
    expect(result.monthlySatang).toBe(8000000);
    expect(result.illustrativeTwelveMonthSatang).toBe(96000000);
    expect(result.bookingEngineEligible).toBe(false);
  });
  it('prices daily seasons at year boundary with exclusive checkout', () => {
    const rows = [
      row('HIGH','11-01','12-21',750000),
      row('PEAK','12-22','01-10',950000),
      row('HIGH2','01-11','03-31',750000),
    ];
    const result=quote(rows,'2026-12-21','2027-01-12','daily');
    expect(result.lines).toHaveLength(22);
    expect(result.lines[0].nightlySatang).toBe(750000);
    expect(result.lines[1].nightlySatang).toBe(950000);
    expect(result.lines.at(-2)?.nightlySatang).toBe(950000);
    expect(result.lines.at(-1)?.nightlySatang).toBe(750000);
    expect(result.subtotalSatang).toBe(result.lines.reduce((s,n)=>s+n.nightlySatang,0));
  });
  it('allocates a 30-night monthly tariff without loss of integer satang', () => {
    const rows=[row('LOW','04-01','10-31',9000001,'monthly',30)];
    const q=quote(rows,'2026-06-01','2026-07-01','monthly');
    expect(q.lines).toHaveLength(30);
    expect(q.subtotalSatang).toBe(9000001);
    expect(q.includesTaxes).toBe(false);
    expect(q.lines.reduce((s,n)=>s+n.nightlySatang,0)).toBe(9000001);
  });
  it('fails on missing season, overlapping tariff, unsellable row and short monthly stay', () => {
    expect(()=>quote([row('GREEN','05-01','09-30',560000)],'2026-04-30','2026-05-02','daily')).toThrow(/Missing/);
    expect(()=>quote([row('A','01-01','12-31',500000),row('B','01-01','12-31',600000)],'2026-06-01','2026-06-02','daily')).toThrow(/overlapping/);
    expect(()=>quote([{...row('A','01-01','12-31',500000),sourceSellable:false}],'2026-06-01','2026-06-02','daily')).toThrow(/unsellable/);
    expect(()=>quote([row('LOW','04-01','10-31',9000000,'monthly',30)],'2026-06-01','2026-06-30','monthly')).toThrow(/minimum/);
  });
  it('refuses mixed included taxes within a stay, not adding VAT twice', () => {
    const a=row('A','06-01','06-15',500000);
    const b={...row('B','06-16','06-30',600000),includesTaxes:false};
    expect(()=>quote([a,b],'2026-06-15','2026-06-17','daily')).toThrow(/Mixed/);
  });
});
