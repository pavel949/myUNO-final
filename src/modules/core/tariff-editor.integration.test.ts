import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { computePriceBreakdown } from './index';
import { readTariffDraft, saveTariffDraft, validateTariffDraft, usesTariffGrid, type TariffDraft } from './tariff-editor';

/**
 * The admin rates editor writes the same grid the engine quotes from: a
 * saved season is exactly what search and booking charge.
 */
const draft = (over: Partial<TariffDraft> = {}): TariffDraft => ({
  includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [
    { seasonCode: 'LOW', windows: [{ start: '05-01', end: '10-31' }], amountSatang: 600_000, minimumNights: 3 },
    { seasonCode: 'HIGH', windows: [{ start: '11-01', end: '04-30' }], amountSatang: 900_000, minimumNights: 5,
      cancellationSteps: [{ days: 0, pct: 0 }] },
  ],
  monthly: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 12_000_000, minimumNights: 30 }],
  yearly: { amountSatang: 10_000_000, minimumNights: 365 },
  ...over,
});
const day = (s: string) => new Date(s + 'T00:00:00Z');

describe('admin rates editor', () => {
  let unitId: string; let admin: string;
  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    unitId = (await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 100_000, maxGuests: 4 })).id;
    admin = (await db.identity.create({ data: { firstName: 'Ops', lastName: 'Admin' } })).id;
  });

  it('rejects overlapping seasons, bad dates and short monthly minimums before anything is saved', () => {
    const bad = validateTariffDraft(draft({
      daily: [
        { seasonCode: 'LOW', windows: [{ start: '05-01', end: '11-15' }], amountSatang: 600_000, minimumNights: 1 },
        { seasonCode: 'high', windows: [{ start: '11-01', end: '02-30' }], amountSatang: 0, minimumNights: 1 },
      ],
      monthly: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 1, minimumNights: 7 }],
    }));
    expect(bad.errors.map(e => e.code)).toEqual(expect.arrayContaining(['season_code', 'window_format', 'amount', 'minimum_monthly']));
    const overlap = validateTariffDraft(draft({ daily: [
      { seasonCode: 'LOW', windows: [{ start: '05-01', end: '11-15' }], amountSatang: 600_000, minimumNights: 1 },
      { seasonCode: 'HIGH', windows: [{ start: '11-01', end: '04-30' }], amountSatang: 900_000, minimumNights: 1 },
    ] }));
    expect(overlap.errors[0]).toMatchObject({ code: 'overlap', kind: 'daily', day: '11-01' });
    expect(validateTariffDraft(draft()).errors).toEqual([]);
    expect(validateTariffDraft(draft({ daily: [draft().daily[0]] })).dailyGaps).toContain('12-25');
  });

  it('saves seasons that the pricing engine then quotes, daily and monthly', async () => {
    expect(await usesTariffGrid(db, unitId)).toBe(false);
    await saveTariffDraft(db, { unitIds: [unitId], draft: draft(), actorIdentityId: admin });
    // Dated nightly overrides are not read for grid-priced villas; the API refuses them.
    expect(await usesTariffGrid(db, unitId)).toBe(true);
    const june = await computePriceBreakdown(db, unitId, day('2027-06-01'), day('2027-06-04'), 2);
    expect(june.subtotal_thb).toBe(1_800_000);
    const december = await computePriceBreakdown(db, unitId, day('2027-12-01'), day('2027-12-06'), 2);
    expect(december.subtotal_thb).toBe(4_500_000);
    await expect(computePriceBreakdown(db, unitId, day('2027-12-01'), day('2027-12-03'), 2))
      .rejects.toThrow(/minimum/);
    // The long-term offering is created as draft: saving rates does not open monthly sale.
    const long = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'long_term_rental' } });
    expect(long.status).toBe('draft');
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved' } })).toBe(2);

    const back = await readTariffDraft(db, unitId);
    expect(back.daily.map(s => [s.seasonCode, s.amountSatang, s.minimumNights])).toEqual([['LOW', 600_000, 3], ['HIGH', 900_000, 5]]);
    expect(back.yearly).toEqual({ amountSatang: 10_000_000, minimumNights: 365 });
  });

  it('keeps source provenance and syncs the season policy minimum and refund ladder', async () => {
    await db.commercialOffering.updateMany({ where: { unitId, offeringType: 'short_term_stay' }, data: {
      pricingTerms: { sourceSystem: 'layantara_os', policyEngineVerified: true, quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true,
        tariffGrid: [{ sourceRateId: 'src-high', seasonCode: 'HIGH', dateWindows: [{ start: '01-01', end: '12-31' }], rateMode: 'daily',
          pricingUnit: 'night', amountSatang: 1, currency: 'THB', minimumNights: 1, includesTaxes: true, includesServiceCharge: true,
          includesBreakfast: false, sourceSellable: true }] },
      rulesAndPolicies: { bookingPolicies: [
        { id: 'p-high', active: true, scope_type: 'project', rate_mode: 'daily', season_code: 'HIGH', min_nights: 1,
          confirmation_payment_type: 'percentage', confirmation_payment_value: 50, security_deposit_thb: 0,
          cancellation_summary: 'High', balance_timing: 'at check-in', stay_terms: '', amendments_allowed: false, included: [], excluded: [] },
        { id: 'p-low', active: true, scope_type: 'project', rate_mode: 'daily', season_code: 'LOW', min_nights: 1,
          confirmation_payment_type: 'percentage', confirmation_payment_value: 50, security_deposit_thb: 0,
          cancellation_summary: 'Low', balance_timing: 'at check-in', stay_terms: '', amendments_allowed: false, included: [], excluded: [] },
      ] },
    } });
    await saveTariffDraft(db, { unitIds: [unitId], draft: draft(), actorIdentityId: admin });
    const offer = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    const terms = offer.pricingTerms as { sourceSystem: string; tariffGrid: Array<{ sourceRateId: string; seasonCode: string }> };
    expect(terms.sourceSystem).toBe('layantara_os');
    expect(terms.tariffGrid.find(r => r.seasonCode === 'HIGH')!.sourceRateId).toBe('src-high');
    const policies = (offer.rulesAndPolicies as { bookingPolicies: Array<Record<string, unknown>> }).bookingPolicies;
    expect(policies.find(p => p.id === 'p-high')).toMatchObject({ min_nights: 5, cancellation_steps: [{ days: 0, pct: 0 }] });
    expect(policies.find(p => p.id === 'p-low')).toMatchObject({ min_nights: 3 });
    const quote = await computePriceBreakdown(db, unitId, day('2027-12-01'), day('2027-12-06'), 2);
    expect(quote.commercialTerms).toMatchObject({ minimumNights: 5, cancellationSteps: [{ days: 0, pct: 0 }] });
  });

  it('refuses an invalid draft without touching the saved grid', async () => {
    await saveTariffDraft(db, { unitIds: [unitId], draft: draft(), actorIdentityId: admin });
    await expect(saveTariffDraft(db, { unitIds: [unitId], draft: draft({ daily: [] }), actorIdentityId: admin }))
      .rejects.toThrow('TARIFF_INVALID');
    expect((await readTariffDraft(db, unitId)).daily).toHaveLength(2);
  });
});
