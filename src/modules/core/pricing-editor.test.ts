import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { saveEmployeeTariffDraft, readTariffDraft, readTariffRevision } from './tariff-editor';
import { quoteSeasonalTariffGrid } from './seasonal-tariff';
import { resolveSourceBookingTerms } from './commercial-booking-terms';

function fixture() {
  const actor = { id: 'editor', isAdmin: false, status: 'active' };
  const grant = { id: 'grant', unit: { projectId: 'p1' }, parentGrant: null, parentGrantId: null, identityId: 'editor', role: 'pricing_editor', status: 'active', scopeType: 'unit', projectId: 'p1', unitId: 'a', organizationId: null, providerId: null };
  const offers = [{ id: 'offer', unitId: 'a', offeringType: 'short_term_stay', status: 'active', pricingTerms: {
    quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true, policyEngineVerified: true, sourceSystem: 'layantara_os',
    approvalReference: 'unchanged', tariffGrid: [{ sourceRateId: 'source', seasonCode: 'ALL', rateMode: 'daily', pricingUnit: 'night',
      dateWindows: [{ start: '01-01', end: '12-31' }], amountSatang: 100000, currency: 'THB', minimumNights: 1,
      includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true }],
  }, rulesAndPolicies: { commission: { percent: 20 }, bookingPolicies: [{ id: 'policy', active: true, scope_type: 'project',
    rate_mode: 'daily', season_code: 'ALL', min_nights: 1, confirmation_payment_type: 'percentage', confirmation_payment_value: 50,
    security_deposit_thb: 10000, balance_timing: 'at check-in', cancellation_summary: 'Published policy', stay_terms: 'Existing terms',
    included: ['cleaning'], excluded: [], cancellation_steps: [{ days: 30, pct: 100 }] }] } }];
  const updates: unknown[] = [];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    identity: { findUnique: vi.fn(async () => actor) },
    roleAssignment: { findMany: vi.fn(async () => grant.status === 'active' ? [grant] : []) },
    unit: { findMany: vi.fn(async ({ where }) => (where.id?.in ?? ['a']).map((id: string) => ({ id, projectId: 'p1', status: 'live', inventoryCategoryId: 'shared' }))), findUnique: vi.fn(async ({ where }) => ({ id: where.id, projectId: where.id === 'foreign' ? 'p2' : 'p1', status: 'live', inventoryCategoryId: 'shared' })) },
    commercialOffering: { findMany: vi.fn(async () => offers), create: vi.fn(),
      update: vi.fn(async ({ data }) => { updates.push(structuredClone(data)); Object.assign(offers[0], data); }) },
    auditLog: { create: vi.fn(async () => ({})) }, booking: { update: vi.fn(), updateMany: vi.fn() },
  };
  const db = { ...tx, $transaction: vi.fn(async run => run(tx)) } as unknown as PrismaClient;
  return { db, tx, offers, actor, grant, updates };
}
describe('scoped tariff writer boundary', () => {
  it('updates the saved quote, minimum and cancellation while preserving source/payment/deposit/commission and history', async () => {
    const f = fixture(); const before = structuredClone(f.offers[0]);
    const draft = await readTariffDraft(f.db, 'a'); draft.daily[0].amountSatang = 250000; draft.daily[0].minimumNights = 3;
    draft.daily[0].cancellationSteps = [{ days: 0, pct: 0 }];
    expect(await saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', expectedRevision: await readTariffRevision(f.db, ['a']), draft })).toMatchObject({ units: 1, revision: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const saved = f.offers[0]; const terms = saved.rulesAndPolicies.bookingPolicies[0];
    expect(quoteSeasonalTariffGrid(saved.pricingTerms.tariffGrid, '2028-01-01', '2028-01-04', 'daily').subtotalSatang).toBe(750000);
    expect(resolveSourceBookingTerms([terms], 'daily', 'ALL')).toMatchObject({ minimumNights: 3, confirmationPaymentValue: 50,
      securityDepositThbSatang: 1000000, balanceTiming: 'at check-in', cancellationSteps: [{ days: 0, pct: 0 }] });
    expect(() => quoteSeasonalTariffGrid(saved.pricingTerms.tariffGrid, '2028-01-01', '2028-01-02', 'daily')).toThrow();
    for (const key of ['sourceSystem','taxPolicyVerified','policyEngineVerified','quoteEngine','approvalReference'] as const)
      expect(saved.pricingTerms[key]).toEqual(before.pricingTerms[key]);
    expect(saved.status).toBe(before.status); expect(saved.rulesAndPolicies.commission).toEqual(before.rulesAndPolicies.commission);
    expect(terms).toMatchObject({ confirmation_payment_type: 'percentage', confirmation_payment_value: 50, security_deposit_thb: 10000,
      balance_timing: 'at check-in', included: ['cleaning'], excluded: [], stay_terms: 'Existing terms' });
    expect(f.tx.commercialOffering.create).not.toHaveBeenCalled();
    expect(f.tx.booking.update).not.toHaveBeenCalled(); expect(f.tx.booking.updateMany).not.toHaveBeenCalled();
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it('preserves a draft offering status instead of activating it', async () => {
    const f = fixture(); f.offers[0].status = 'draft';
    await saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', expectedRevision: await readTariffRevision(f.db, ['a']), draft: await readTariffDraft(f.db, 'a') });
    expect(f.offers[0].status).toBe('draft');
  });
  it.each(['missing','unapproved-tax','unapproved-source','different-engine'])('refuses %s setup without creating or changing an offering', async variant => {
    const f = fixture(); const draft = await readTariffDraft(f.db, 'a');
    if (variant === 'missing') f.offers.splice(0);
    if (variant === 'unapproved-tax') f.offers[0].pricingTerms.taxPolicyVerified = false;
    if (variant === 'unapproved-source') f.offers[0].pricingTerms.policyEngineVerified = false;
    if (variant === 'different-engine') f.offers[0].pricingTerms.quoteEngine = 'category';
    await expect(saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', expectedRevision: await readTariffRevision(f.db, ['a']), draft })).rejects.toMatchObject({ status: 409 });
    expect(f.tx.commercialOffering.create).not.toHaveBeenCalled(); expect(f.tx.commercialOffering.update).not.toHaveBeenCalled();
  });
  it.each(['foreign','sibling','revoked','blocked'])('denies %s inside the transaction before any tariff read or write', async variant => {
    const f = fixture(); const draft = await readTariffDraft(f.db, 'a'); f.tx.commercialOffering.findMany.mockClear();
    if (variant === 'revoked') f.grant.status = 'revoked'; if (variant === 'blocked') f.actor.status = 'blocked';
    await expect(saveEmployeeTariffDraft(f.db, { unitId: ['foreign','sibling'].includes(variant) ? variant : 'a', actorIdentityId: 'editor', expectedRevision: 'a'.repeat(64), draft }))
      .rejects.toMatchObject({ status: 403 });
    expect(f.tx.commercialOffering.findMany).not.toHaveBeenCalled(); expect(f.tx.commercialOffering.update).not.toHaveBeenCalled();
  });
  it('rejects changed tax/inclusion flags and new monthly supply', async () => {
    for (const variant of ['tax', 'monthly']) {
      const f = fixture(); const draft = await readTariffDraft(f.db, 'a');
      if (variant === 'tax') draft.includesTaxes = false;
      else draft.monthly = [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 1000000, minimumNights: 30 }];
      await expect(saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', expectedRevision: await readTariffRevision(f.db, ['a']), draft })).rejects.toMatchObject({ status: 409 });
      expect(f.tx.commercialOffering.update).not.toHaveBeenCalled(); expect(f.tx.commercialOffering.create).not.toHaveBeenCalled();
    }
  });
  it('rejects a new source season without policy instead of silently losing its cancellation rules', async () => {
    const f = fixture(); const draft = await readTariffDraft(f.db, 'a');
    draft.daily[0].windows = [{ start: '01-01', end: '06-30' }];
    draft.daily.push({ seasonCode: 'NEW', windows: [{ start: '07-01', end: '12-31' }], amountSatang: 200000, minimumNights: 2 });
    await expect(saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', expectedRevision: await readTariffRevision(f.db, ['a']), draft })).rejects.toMatchObject({ status: 409 });
    expect(f.tx.commercialOffering.update).not.toHaveBeenCalled();
  });
});

import { saveTariffDraft } from './tariff-editor';
describe('tariff revision and common write locks', () => {
  it.each(['admin-first', 'employee-first'])('rejects the second stale whole-form save: %s', async order => {
    const f = fixture(); const original = await readTariffDraft(f.db, 'a');
    const revision = await readTariffRevision(f.db, ['a']);
    const first = structuredClone(original); first.daily[0].amountSatang = 200000;
    const second = structuredClone(original); second.daily[0].minimumNights = 4;
    if (order === 'admin-first') {
      f.actor.isAdmin = true;
      await saveTariffDraft(f.db, { unitIds: ['a'], actorIdentityId: 'editor', draft: first, expectedRevision: revision });
      f.actor.isAdmin = false;
      await expect(saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', draft: second, expectedRevision: revision })).rejects.toMatchObject({ status: 409 });
    } else {
      await saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', draft: first, expectedRevision: revision });
      f.actor.isAdmin = true;
      await expect(saveTariffDraft(f.db, { unitIds: ['a'], actorIdentityId: 'editor', draft: second, expectedRevision: revision })).rejects.toMatchObject({ status: 409 });
    }
    expect(f.offers[0].pricingTerms.tariffGrid[0]).toMatchObject({ amountSatang: 200000, minimumNights: 1 });
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce();
    const locks = f.tx.$queryRaw.mock.calls.map(call => call[0].join('?'));
    expect(locks).toContain('SELECT id FROM unit WHERE id = ANY(?::text[]) ORDER BY id FOR UPDATE');
    expect(locks.some(query => query.includes('FROM commercial_offering') && query.includes('ORDER BY id FOR UPDATE'))).toBe(true);
  });
  it('detects changed preserved approvals and policies, not only displayed grid amounts', async () => {
    const f = fixture(); const draft = await readTariffDraft(f.db, 'a'); const expectedRevision = await readTariffRevision(f.db, ['a']);
    f.offers[0].pricingTerms.approvalReference = 'new approval';
    await expect(saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', draft, expectedRevision })).rejects.toMatchObject({ status: 409 });
    expect(f.offers[0].pricingTerms.approvalReference).toBe('new approval'); expect(f.tx.commercialOffering.update).not.toHaveBeenCalled();
  });
  it.each([false, true])('requires a loaded revision for admin=%s instead of silently opting out', async isAdmin => {
    const f = fixture(); f.actor.isAdmin = isAdmin; const draft = await readTariffDraft(f.db, 'a');
    const save = isAdmin ? saveTariffDraft(f.db, { unitIds: ['a'], actorIdentityId: 'editor', draft, expectedRevision: '' })
      : saveEmployeeTariffDraft(f.db, { unitId: 'a', actorIdentityId: 'editor', draft, expectedRevision: '' });
    await expect(save).rejects.toMatchObject({ status: 409 }); expect(f.tx.commercialOffering.update).not.toHaveBeenCalled();
  });
});
