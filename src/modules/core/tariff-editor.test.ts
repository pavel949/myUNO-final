import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { saveTariffDraft, readTariffRevision, type TariffDraft } from './tariff-editor';

const draft = (steps: TariffDraft['daily'][number]['cancellationSteps']): TariffDraft => ({
  includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 600000, minimumNights: 3, cancellationSteps: steps }],
  monthly: [], yearly: null,
});
function database() {
  const update = vi.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]), identity: { findUnique: vi.fn().mockResolvedValue({ id: 'actor', status: 'active', isAdmin: true }) },
    unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit', projectId: 'p', status: 'live' }), findMany: vi.fn().mockResolvedValue([{ id: 'unit', projectId: 'p', status: 'live' }]) },
    commercialOffering: {
      findMany: vi.fn().mockResolvedValue([{ id: 'offer', offeringType: 'short_term_stay', pricingTerms: {},
        rulesAndPolicies: { bookingPolicies: [{ id: 'policy', rate_mode: 'daily', season_code: 'ALL',
          min_nights: 1, cancellation_summary: 'Standard terms', cancellation_steps: [{ days: 30, pct: 100 }] }] } }]),
      update,
    }, auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = { ...tx, $transaction: async (run: (client: typeof tx) => Promise<void>) => run(tx) } as unknown as PrismaClient;
  return { db, update };
}
describe('tariff policy reset writer', () => {
  it('removes the refund override only for an explicit standard-policy reset, preserving other terms', async () => {
    const { db, update } = database();
    await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', expectedRevision: await readTariffRevision(db, ['unit']), draft: draft(null) });
    const policy = update.mock.calls[0][0].data.rulesAndPolicies.bookingPolicies[0];
    expect(policy).not.toHaveProperty('cancellation_steps');
    expect(policy).toMatchObject({ id: 'policy', cancellation_summary: 'Standard terms', min_nights: 3 });
  });
  it('preserves existing refund terms when the field is omitted', async () => {
    const { db, update } = database();
    await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', expectedRevision: await readTariffRevision(db, ['unit']), draft: draft(undefined) });
    expect(update.mock.calls[0][0].data.rulesAndPolicies.bookingPolicies[0].cancellation_steps)
      .toEqual([{ days: 30, pct: 100 }]);
  });
});


import { readTariffDraft, validateTariffDraft } from './tariff-editor';
describe('tariff row identity and roundtrip', () => {
  function roundtripDatabase() {
    const offers = [{ id: 'offer', offeringType: 'short_term_stay',
      pricingTerms: { sourceSystem: 'fixture', unknownTerms: { keep: true }, tariffGrid: [{
        sourceRateId: 'target-rate', seasonCode: 'ALL', rateMode: 'daily',
        dateWindows: [{ start: '01-01', end: '12-31', sourceWindow: 'keep' }],
        amountSatang: 600000, minimumNights: 3, includesTaxes: true,
        includesServiceCharge: true, includesBreakfast: false, unknownRow: { keep: true },
      }, { rateMode: 'future_mode', payload: ['untouched'] }] },
      rulesAndPolicies: { unknownRules: ['keep'], bookingPolicies: [{ id: 'policy', active: true,
        rate_mode: 'daily', season_code: 'ALL', scope_type: 'project', min_nights: 3,
        cancellation_steps: [{ days: 30, pct: 100 }], unknownPolicy: 'keep' }] } }];
    const update = vi.fn().mockImplementation(async ({ data }) => Object.assign(offers[0], data));
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]), identity: { findUnique: vi.fn().mockResolvedValue({ id: 'actor', status: 'active', isAdmin: true }) },
      unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit', projectId: 'p', status: 'live' }), findMany: vi.fn().mockResolvedValue([{ id: 'unit', projectId: 'p', status: 'live' }]) },
      commercialOffering: { findMany: vi.fn().mockImplementation(async () => offers), update },
      auditLog: { create: vi.fn().mockResolvedValue({}) } };
    const db = { ...tx,
      $transaction: async (run: (client: typeof tx) => Promise<void>) => run(tx) } as unknown as PrismaClient;
    return { db, update, offers };
  }
  it('retains stable IDs and unknown JSON through repeated save/reload and rename', async () => {
    const { db, update } = roundtripDatabase();
    const first = await readTariffDraft(db, 'unit');
    expect(first.daily[0].sourceRateId).toBe('target-rate');
    first.daily[0].seasonCode = 'BASE';
    first.daily[0].amountSatang = 612345;
    for (let i = 0; i < 2; i++) {
      await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', expectedRevision: await readTariffRevision(db, ['unit']), draft: i === 0 ? first : await readTariffDraft(db, 'unit') });
      const data = update.mock.calls[i][0].data;
      expect(data.pricingTerms).toMatchObject({ unknownTerms: { keep: true }, tariffGrid: [
        { sourceRateId: 'target-rate', seasonCode: 'BASE', amountSatang: 612345, unknownRow: { keep: true },
          dateWindows: [{ sourceWindow: 'keep', start: '01-01', end: '12-31' }] },
        { rateMode: 'future_mode', payload: ['untouched'] },
      ] });
      expect(data.rulesAndPolicies).toMatchObject({ unknownRules: ['keep'], bookingPolicies: [
        { id: 'policy', season_code: 'BASE', unknownPolicy: 'keep', cancellation_steps: [{ days: 30, pct: 100 }] },
      ] });
    }
  });
  it('refuses two draft rows resolving to one saved source identity before a write', async () => {
    const { db, update } = roundtripDatabase();
    const value = await readTariffDraft(db, 'unit');
    value.daily[0].seasonCode = 'BASE';
    value.daily[0].windows = [{ start: '01-01', end: '06-30' }];
    value.daily.push({ seasonCode: 'ALL', windows: [{ start: '07-01', end: '12-31' }], amountSatang: 700000, minimumNights: 1 });
    await expect(saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', expectedRevision: await readTariffRevision(db, ['unit']), draft: value }))
      .rejects.toMatchObject({ message: 'TARIFF_INVALID', issues: [{ code: 'row_identity', kind: 'daily', season: 'ALL' }] });
    expect(update).not.toHaveBeenCalled();
  });

  it('preserves target-unit provenance during a same-code bulk copy', async () => {
    const { db, update } = roundtripDatabase();
    const value = draft(undefined); value.daily[0].sourceRateId = 'other-unit-rate';
    await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', expectedRevision: await readTariffRevision(db, ['unit']), draft: value });
    expect(update.mock.calls[0][0].data.pricingTerms.tariffGrid[0].sourceRateId).toBe('target-rate');
  });
  it('rejects malformed row/window/refund inputs instead of throwing during validation', () => {
    const value = draft(undefined);
    for (const row of [null, { ...value.daily[0], windows: {} },
      { ...value.daily[0], windows: [null] }, { ...value.daily[0], cancellationSteps: 'bad' }]) {
      expect(validateTariffDraft({ ...value, daily: [row] } as unknown as TariffDraft).errors.length).toBeGreaterThan(0);
    }
  });
});
