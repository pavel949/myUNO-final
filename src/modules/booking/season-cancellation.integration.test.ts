import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { resolveStayCancellationPolicyForDates, sourceSeasonCancellationPolicy } from './index';

/**
 * Founder ruling 2026-10-06: Layantara cancels by ARRIVAL SEASON — Green and
 * Shoulder refund in full 14+ days out, High/Peak/EDC are non-refundable —
 * not by one property-wide ladder. The guest's review page and the booking
 * snapshot both come from resolveStayCancellationPolicyForDates.
 */
const season = (code: string, window: { start: string; end: string }) => ({
  sourceRateId: code, seasonCode: code, dateWindows: [window], rateMode: 'daily',
  pricingUnit: 'night', amountSatang: 650_000, currency: 'THB', minimumNights: 1,
  includesTaxes: true, includesServiceCharge: true, includesBreakfast: true, sourceSellable: true,
});
const policy = (code: string, steps: Array<{ days: number; pct: number }>) => ({
  id: 'policy-' + code, active: true, scope_type: 'project', rate_mode: 'daily', season_code: code,
  min_nights: 1, confirmation_payment_type: 'percentage', confirmation_payment_value: 50,
  security_deposit_thb: 3000, cancellation_summary: code + ' terms', balance_timing: 'Balance at check-in',
  stay_terms: 'Arrival from 15:00', amendments_allowed: false, included: [], excluded: [],
  cancellation_steps: steps,
});

describe('season cancellation (ruling 2026-10-06)', () => {
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 650_000 });
    unitId = unit.id;
    await db.commercialOffering.updateMany({
      where: { unitId, offeringType: 'short_term_stay' },
      data: {
        pricingTerms: {
          quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true,
          sourceSystem: 'layantara_os', policyEngineVerified: true,
          tariffGrid: [season('GREEN', { start: '05-01', end: '10-31' }), season('HIGH', { start: '11-01', end: '04-30' })],
        },
        rulesAndPolicies: {
          bookingPolicies: [
            policy('GREEN', [{ days: 14, pct: 100 }, { days: 0, pct: 0 }]),
            policy('HIGH', [{ days: 0, pct: 0 }]),
          ],
        },
      },
    });
  });

  const stay = (start: string, end: string) =>
    ({ startDate: new Date(start + 'T00:00:00Z'), endDate: new Date(end + 'T00:00:00Z'), guests: 2 });

  it('a Green-season arrival gets the 14-day full-refund ladder', async () => {
    const p = await resolveStayCancellationPolicyForDates(db, { unitId }, stay('2026-06-10', '2026-06-14'));
    expect(p).toEqual({ name: 'season', steps: [
      { days_before_checkin: 14, refund_pct: 100 }, { days_before_checkin: 0, refund_pct: 0 },
    ] });
  });

  it('a High-season arrival is non-refundable', async () => {
    const p = await resolveStayCancellationPolicyForDates(db, { unitId }, stay('2026-12-01', '2026-12-04'));
    expect(p.steps).toEqual([{ days_before_checkin: 0, refund_pct: 0 }]);
  });

  it('terms without a ladder keep the configured policy', () => {
    expect(sourceSeasonCancellationPolicy({})).toBeNull();
    expect(sourceSeasonCancellationPolicy(undefined)).toBeNull();
  });
});
