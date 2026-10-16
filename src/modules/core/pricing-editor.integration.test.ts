import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';
import { saveEmployeeTariffDraft, readTariffDraft } from './tariff-editor';
import { readTariffRevision } from './tariff-editor';
import { computeCanonicalPriceBreakdown } from './canonical-pricing.service';
import { assertUnitPricingAccess, listPricingUnits } from './pricing-access';

// Real isolated PostgreSQL evidence. Never substitute a production URL or a transaction mock.
describe('scoped pricing persistence and accepted-booking safety', () => {
  let unitId: string, siblingId: string, foreignId: string, actorId: string, projectId: string, grantId: string;
  const day = (date: string) => new Date(date + 'T00:00:00Z');
  beforeEach(async () => {
    await resetDb(); const project = await createProject({ status: 'live' }); projectId = project.id;
    unitId = (await createUnit({ projectId, status: 'live', maxGuests: 4 })).id;
    siblingId = (await createUnit({ projectId, status: 'live', maxGuests: 4 })).id;
    const foreign = await createProject({ status: 'live' }); foreignId = (await createUnit({ projectId: foreign.id, status: 'live' })).id;
    actorId = (await createIdentity()).id;
    grantId = (await db.roleAssignment.create({ data: { identityId: actorId, role: 'pricing_editor', scopeType: 'unit', projectId, unitId } })).id;
    await db.commercialOffering.updateMany({ where: { unitId, offeringType: 'short_term_stay' }, data: {
      pricingTerms: { sourceSystem: 'layantara_os', policyEngineVerified: true, quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true,
        tariffGrid: [{ sourceRateId: 'source-all', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }],
          rateMode: 'daily', pricingUnit: 'night', amountSatang: 100000, currency: 'THB', minimumNights: 1,
          includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true }] },
      rulesAndPolicies: { commission: { percent: 20 }, bookingPolicies: [{ id: 'policy', active: true, scope_type: 'project', rate_mode: 'daily', season_code: 'ALL',
        min_nights: 1, confirmation_payment_type: 'percentage', confirmation_payment_value: 50, security_deposit_thb: 10000,
        cancellation_summary: 'Published terms', balance_timing: 'at check-in', stay_terms: 'Accepted source terms', included: [], excluded: [] }] },
    } });
  });
  it('changes new canonical quotes and minimum/refund terms, preserving accepted booking snapshots and unrelated units', async () => {
    const guest = await createIdentity();
    const booking = await createBooking({ projectId, unitId, guestIdentityId: guest.id, totalThb: 321000,
      cancellationPolicySnapshot: { minimum: 1, confirmationPayment: 50, cancellation: 'accepted', total: 321000 } });
    const before = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    const sibling = await db.commercialOffering.findMany({ where: { unitId: siblingId } });
    const draft = await readTariffDraft(db, unitId); draft.daily[0].amountSatang = 250000;
    draft.daily[0].minimumNights = 3; draft.daily[0].cancellationSteps = [{ days: 0, pct: 0 }];
    await saveEmployeeTariffDraft(db, { unitId, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]), draft });
    const quote = await computeCanonicalPriceBreakdown(db, unitId, day('2028-01-01'), day('2028-01-04'), 2);
    expect(quote.total_thb).toBe(750000);
    expect(quote.commercialTerms).toMatchObject({ minimumNights: 3, confirmationPaymentValue: 50, securityDepositThbSatang: 1000000,
      balanceTiming: 'at check-in', cancellationSteps: [{ days: 0, pct: 0 }] });
    await expect(computeCanonicalPriceBreakdown(db, unitId, day('2028-01-01'), day('2028-01-02'), 2)).rejects.toThrow(/minimum/i);
    expect(await db.booking.findUnique({ where: { id: booking.id } })).toEqual(booking);
    expect(await db.commercialOffering.findMany({ where: { unitId: siblingId } })).toEqual(sibling);
    const after = await db.commercialOffering.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe(before.status);
    expect(after.pricingTerms).toMatchObject({ sourceSystem: 'layantara_os', policyEngineVerified: true, taxPolicyVerified: true });
    expect(after.rulesAndPolicies).toMatchObject({ commission: { percent: 20 }, bookingPolicies: [{ confirmation_payment_value: 50, security_deposit_thb: 10000 }] });
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved', actorIdentityId: actorId } })).toBe(1);
  });
  it('enforces exact unit/project scope and immediate revocation using real rows', async () => {
    expect((await listPricingUnits(db, actorId)).map(u => u.id)).toEqual([unitId]);
    for (const id of [siblingId, foreignId]) await expect(assertUnitPricingAccess(db, actorId, id)).rejects.toMatchObject({ status: 403 });
    await db.roleAssignment.update({ where: { id: grantId }, data: { status: 'revoked' } });
    grantId = (await db.roleAssignment.create({ data: { identityId: actorId, role: 'pricing_editor', scopeType: 'project', projectId } })).id;
    expect(new Set((await listPricingUnits(db, actorId)).map(u => u.id))).toEqual(new Set([unitId, siblingId]));
    await expect(assertUnitPricingAccess(db, actorId, foreignId)).rejects.toMatchObject({ status: 403 });
    const draft = await readTariffDraft(db, unitId);
    await db.roleAssignment.update({ where: { id: grantId }, data: { status: 'revoked' } });
    await expect(saveEmployeeTariffDraft(db, { unitId, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]), draft })).rejects.toMatchObject({ status: 403 });
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved' } })).toBe(0);
  });
  it('does not create a missing offering', async () => {
    const draft = await readTariffDraft(db, unitId);
    await db.commercialOffering.deleteMany({ where: { unitId } });
    await expect(saveEmployeeTariffDraft(db, { unitId, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]), draft })).rejects.toMatchObject({ status: 409 });
    expect(await db.commercialOffering.count({ where: { unitId } })).toBe(0);
  });
  it.each(['taxPolicyVerified', 'policyEngineVerified'])('does not approve %s', async flag => {
    const draft = await readTariffDraft(db, unitId);
    const offer = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    const terms = { ...(offer.pricingTerms as Record<string, unknown>), [flag]: false };
    await db.commercialOffering.update({ where: { id: offer.id }, data: { pricingTerms: terms } });
    await expect(saveEmployeeTariffDraft(db, { unitId, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]), draft })).rejects.toMatchObject({ status: 409 });
    expect((await db.commercialOffering.findUniqueOrThrow({ where: { id: offer.id } })).pricingTerms).toEqual(terms);
  });
  it('preserves a draft offering without activating it', async () => {
    await db.commercialOffering.updateMany({ where: { unitId }, data: { status: 'draft' } });
    const draft = await readTariffDraft(db, unitId); draft.daily[0].amountSatang = 200000;
    await saveEmployeeTariffDraft(db, { unitId, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]), draft });
    expect((await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } })).status).toBe('draft');
  });

});

import { saveTariffDraft } from './tariff-editor';
describe('admin/employee tariff concurrency on real PostgreSQL', () => {
  let unitId: string, actorId: string, adminId: string, projectId: string;
  beforeEach(async () => {
    await resetDb(); adminId = (await createIdentity({ isAdmin: true })).id; actorId = (await createIdentity()).id;
    projectId = (await createProject({ status: 'live' })).id; unitId = (await createUnit({ projectId, status: 'live' })).id;
    await db.roleAssignment.create({ data: { identityId: actorId, role: 'pricing_editor', scopeType: 'unit', projectId, unitId } });
    await db.commercialOffering.updateMany({ where: { unitId, offeringType: 'short_term_stay' }, data: { pricingTerms: {
      sourceSystem: 'synthetic_revision', quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true,
      tariffGrid: [{ sourceRateId: 'synthetic-all', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }],
        rateMode: 'daily', pricingUnit: 'night', amountSatang: 100000, currency: 'THB', minimumNights: 1,
        includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true }],
    } } });
  });
  it('two concurrent editors using one loaded revision cannot silently overwrite each other', async () => {
    const expectedRevision = await readTariffRevision(db, [unitId]);
    const first = await readTariffDraft(db, unitId); first.daily[0].amountSatang = 200000;
    const second = await readTariffDraft(db, unitId); second.daily[0].minimumNights = 4;
    const results = await Promise.allSettled([
      saveTariffDraft(db, { unitIds: [unitId], draft: first, actorIdentityId: adminId, expectedRevision }),
      saveEmployeeTariffDraft(db, { unitId, draft: second, actorIdentityId: actorId, expectedRevision }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved' } })).toBe(1);
    const current = await readTariffDraft(db, unitId);
    expect([[200000, 1], [100000, 4]]).toContainEqual([current.daily[0].amountSatang, current.daily[0].minimumNights]);
  });
  it('a commercial approval committed first invalidates the old form and is preserved', async () => {
    const draft = await readTariffDraft(db, unitId); const expectedRevision = await readTariffRevision(db, [unitId]);
    const offer = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; }); const unblock = new Promise<void>(resolve => { release = resolve; });
    const approval = db.$transaction(async tx => {
      await tx.commercialOffering.update({ where: { id: offer.id }, data: { pricingTerms: { ...(offer.pricingTerms as object), approvalReference: 'new-synthetic-approval' } } });
      locked(); await unblock;
    });
    await ready;
    const saved = saveEmployeeTariffDraft(db, { unitId, draft, actorIdentityId: actorId, expectedRevision }).then(() => null, error => error);
    release(); await approval; expect(await saved).toMatchObject({ status: 409 });
    expect((await db.commercialOffering.findUniqueOrThrow({ where: { id: offer.id } })).pricingTerms).toMatchObject({ approvalReference: 'new-synthetic-approval' });
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved' } })).toBe(0);
  });
  it('rejects changed admin category membership without updating the originally previewed units', async () => {
    const sibling = await createUnit({ projectId, status: 'live' });
    const ids = [unitId, sibling.id]; const expectedRevision = await readTariffRevision(db, ids); const draft = await readTariffDraft(db, unitId);
    await createUnit({ projectId, status: 'live' });
    await expect(saveTariffDraft(db, { unitIds: ids, categoryId: sibling.inventoryCategoryId!, draft, actorIdentityId: adminId, expectedRevision })).rejects.toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { action: 'commercial_offering.tariff_saved' } })).toBe(0);
  });
  it('a fresh reload permits the next deliberate edit and produces the canonical new quote', async () => {
    const first = await readTariffDraft(db, unitId); first.daily[0].amountSatang = 200000;
    await saveTariffDraft(db, { unitIds: [unitId], draft: first, actorIdentityId: adminId, expectedRevision: await readTariffRevision(db, [unitId]) });
    const reloaded = await readTariffDraft(db, unitId); reloaded.daily[0].minimumNights = 3;
    await saveEmployeeTariffDraft(db, { unitId, draft: reloaded, actorIdentityId: actorId, expectedRevision: await readTariffRevision(db, [unitId]) });
    expect((await computeCanonicalPriceBreakdown(db, unitId, new Date('2028-01-01'), new Date('2028-01-04'), 1)).total_thb).toBe(600000);
  });
});
