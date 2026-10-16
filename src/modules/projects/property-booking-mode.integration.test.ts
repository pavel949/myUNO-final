import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { previewPropertyBookingMode, applyPropertyBookingMode } from './property-booking-mode';
import { grantPropertyCapability, revokePropertyCapability } from '@/modules/core/property-capability-grants';

const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['/myuno_test', '/myuno_browser_test'].includes(url.pathname))
  throw new Error('Booking mode integration tests require an isolated local myUNO test database');

describe('reviewed booking mode changes on real PostgreSQL', () => {
  let adminId: string, actorId: string, projectId: string, unitId: string, siblingId: string, categoryId: string, grantId: string;
  beforeEach(async () => {
    await resetDb(); adminId = (await createIdentity({ isAdmin: true })).id; actorId = (await createIdentity()).id;
    projectId = (await createProject({ status: 'live' })).id;
    const unit = await createUnit({ projectId, status: 'live' }); unitId = unit.id; categoryId = unit.inventoryCategoryId!;
    siblingId = (await createUnit({ projectId, status: 'live' })).id;
    await db.unit.updateMany({ where: { id: { in: [unitId, siblingId] } }, data: { instantBook: true } });
    grantId = (await grantPropertyCapability(db, adminId, { identityId: actorId, role: 'booking_mode_editor', scopeType: 'project', projectId })).grant.id;
  });
  const input = () => ({ actorIdentityId: actorId, unitId, scope: 'unit' as const, instantBook: false });
  async function change(scope: 'unit' | 'category' = 'unit') {
    const request = { ...input(), scope }; const preview = await previewPropertyBookingMode(db, request);
    return { ...request, baseline: preview.baseline, requestId: 'synthetic-booking-mode-request' };
  }
  it('changes only the reviewed mode and audits once while preserving prices, reservations and occupancy', async () => {
    const guest = await createIdentity();
    const booking = await createBooking({ unitId, projectId, guestIdentityId: guest.id, totalThb: 321000,
      cancellationPolicySnapshot: { acceptedTotal: 321000, acceptedPolicy: 'synthetic unchanged' } });
    const block = await db.blockedDate.create({ data: { unitId, startDate: new Date('2029-01-01'), endDate: new Date('2029-01-03'), reason: 'owner_hold' } });
    const before = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
    const sibling = await db.unit.findUniqueOrThrow({ where: { id: siblingId } });
    const offers = await db.commercialOffering.findMany({ where: { unitId } });
    const category = await db.inventoryCategory.findUniqueOrThrow({ where: { id: categoryId } });
    const request = await change();
    expect(await applyPropertyBookingMode(db, request)).toMatchObject({ updated: 1, alreadyApplied: false });
    expect(await applyPropertyBookingMode(db, request)).toMatchObject({ updated: 1, alreadyApplied: true });
    const after = await db.unit.findUniqueOrThrow({ where: { id: unitId } }); expect(after.instantBook).toBe(false);
    expect({ ...after, instantBook: before.instantBook, updatedAt: before.updatedAt }).toEqual(before);
    expect(await db.unit.findUniqueOrThrow({ where: { id: siblingId } })).toEqual(sibling);
    expect(await db.commercialOffering.findMany({ where: { unitId } })).toEqual(offers);
    expect(await db.inventoryCategory.findUniqueOrThrow({ where: { id: categoryId } })).toEqual(category);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toEqual(booking);
    expect(await db.blockedDate.findUniqueOrThrow({ where: { id: block.id } })).toEqual(block);
    expect(await db.auditLog.count({ where: { action: 'units.booking_mode_applied' } })).toBe(1);
  });
  it('requires scope for every category member and never falls back to partial application', async () => {
    await revokePropertyCapability(db, adminId, grantId);
    await grantPropertyCapability(db, adminId, { identityId: actorId, role: 'booking_mode_editor', scopeType: 'unit', projectId, unitId });
    await expect(previewPropertyBookingMode(db, { ...input(), scope: 'category' })).rejects.toMatchObject({ status: 403 });
    expect(await db.unit.count({ where: { projectId, instantBook: false } })).toBe(0);
  });
  it('rejects category membership added after preview without mutating any member', async () => {
    const request = await change('category'); const third = await createUnit({ projectId, status: 'live' });
    expect(third.inventoryCategoryId).toBe(categoryId);
    await expect(applyPropertyBookingMode(db, request)).rejects.toMatchObject({ status: 409 });
    expect((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).instantBook).toBe(true);
    expect(await db.auditLog.count({ where: { action: 'units.booking_mode_applied' } })).toBe(0);
  });
  it('serializes concurrent stale approvals so exactly one commit and audit succeed', async () => {
    const request = await change();
    const results = await Promise.allSettled([applyPropertyBookingMode(db, request), applyPropertyBookingMode(db, { ...request, requestId: 'different-stale-request' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { action: 'units.booking_mode_applied' } })).toBe(1);
  });
  it('rolls canonical mode back if the required audit cannot commit', async () => {
    const request = await change(); const before = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
    const failing = db.$extends({ query: { auditLog: { async create() { throw new Error('synthetic mode audit failure'); } } } });
    await expect(applyPropertyBookingMode(failing as unknown as typeof db, request)).rejects.toThrow('synthetic mode audit failure');
    expect(await db.unit.findUniqueOrThrow({ where: { id: unitId } })).toEqual(before);
  });
  it('requires current authority even for an otherwise idempotent retry', async () => {
    const request = await change(); await applyPropertyBookingMode(db, request);
    await revokePropertyCapability(db, adminId, grantId);
    await expect(applyPropertyBookingMode(db, request)).rejects.toMatchObject({ status: 403 });
    expect(await db.auditLog.count({ where: { action: 'units.booking_mode_applied' } })).toBe(1);
  });
  it('observes parent revocation committed before the locked write check', async () => {
    await revokePropertyCapability(db, adminId, grantId);
    const managerId = (await createIdentity()).id;
    const parent = (await grantPropertyCapability(db, adminId, { identityId: managerId, role: 'booking_mode_editor', scopeType: 'project', projectId, canDelegate: true })).grant;
    await grantPropertyCapability(db, managerId, { identityId: actorId, role: 'booking_mode_editor', scopeType: 'unit', projectId, unitId, parentGrantId: parent.id });
    const request = await change();
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; }); const unblock = new Promise<void>(resolve => { release = resolve; });
    const revoke = db.$transaction(async tx => { await tx.roleAssignment.update({ where: { id: parent.id }, data: { status: 'revoked' } }); locked(); await unblock; });
    await ready; const apply = applyPropertyBookingMode(db, request); release(); await revoke;
    await expect(apply).rejects.toMatchObject({ status: 403 });
    expect((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).instantBook).toBe(true);
  });
  it('blocks enabling instant booking when current canonical readiness is incomplete', async () => {
    await db.unit.update({ where: { id: unitId }, data: { instantBook: false, permittedUseConfirmedAt: null } });
    const request = { ...input(), instantBook: true }; const preview = await previewPropertyBookingMode(db, request);
    expect(preview.blocked.some(row => row.unitId === unitId && row.codes.includes('unit.permitted_use'))).toBe(true);
    await expect(applyPropertyBookingMode(db, { ...request, baseline: preview.baseline, requestId: 'incomplete-instant-mode' })).rejects.toMatchObject({ status: 409 });
    expect((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).instantBook).toBe(false);
  });
});
