import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createOrganization, createProject, createUnit } from '@/test/util';
import { cancelBooking, createBooking } from '@/modules/booking';

const mockUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => mockUser() }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/libs/bookingConfirmed', () => ({ notifyBookingConfirmed: vi.fn() }));
import { POST } from './route';
import { POST as recordCash } from '../record-cash-payment/route';

async function fixture() {
  const project = await createProject({ status: 'live' });
  const owner = await createIdentity();
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, status: 'live' });
  const guest = await createIdentity();
  const actor = await createIdentity({ isAdmin: true });
  const booking = await createBooking(db, { unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    bookingType: 'guest_stay', channel: 'manual', instantBook: true, totalThb: 1,
    startDate: new Date('2027-09-01'), endDate: new Date('2027-09-03'), adults: 2, children: 0 });
  const command = { commandId: randomUUID(), expectedUpdatedAt: booking.updatedAt.toISOString(), reason: 'Synthetic operator decision' };
  return { project, owner, unit, guest, actor, booking, command };
}
function request(path: string, body: unknown) {
  return new NextRequest('http://localhost/api/bookings/test/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function staff(identityId: string, projectId: string, departments: string[]) {
  await db.roleAssignment.create({ data: { identityId, role: 'staff_ops', scopeType: 'project', projectId, status: 'active' } });
  await db.projectStaffPermission.create({ data: { identityId, projectId, departments } });
}

describe('operator unpaid-confirm route authorization and genuine later receipt', () => {
  beforeEach(async () => { await resetDb(); mockUser.mockReset(); });

  it('requires a signed-in actor', async () => {
    mockUser.mockResolvedValue(null);
    expect((await POST(request('confirm-unpaid', {}), { params: { id: 'unknown' } })).status).toBe(401);
  });

  it('confirms for active admin with server-owned amount and no client financial authority', async () => {
    const { actor, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    const response = await POST(request('confirm-unpaid', { ...command, actorIdentityId: 'fake', amountThb: 0, paid: true }), { params: { id: booking.id } });
    expect(response.status).toBe(200);
    expect((await response.json()).booking).toMatchObject({ status: 'confirmed', balanceDueSatang: booking.totalThb, holdExpiresAt: null });
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.depositPreauth.count()).toBe(0);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: 'bookings:confirm_unpaid' } })).actorIdentityId).toBe(actor.id);
  });

  it.each(['guest', 'owner', 'finance', 'housekeeping', 'foreign_project', 'blocked_admin'])('denies %s without changing the hold', async kind => {
    const { project, unit, guest, owner, actor, booking, command } = await fixture();
    let identityId = actor.id;
    if (kind === 'blocked_admin') await db.identity.update({ where: { id: actor.id }, data: { status: 'blocked' } });
    else if (kind === 'guest') identityId = guest.id;
    else if (kind === 'owner') {
      identityId = owner.id;
      await db.roleAssignment.create({ data: { identityId, role: 'owner', scopeType: 'unit', projectId: project.id, unitId: unit.id } });
    } else {
      const employee = await createIdentity(); identityId = employee.id;
      const scopedProject = kind === 'foreign_project' ? await createProject({ status: 'live' }) : project;
      await staff(identityId, scopedProject.id, [kind === 'foreign_project' ? 'reservations' : kind]);
    }
    mockUser.mockResolvedValue({ identityId, isAdmin: true }); // forged/stale client flags never authorize
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(403);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid' } })).toBe(0);
  });

  it('allows current reservations staff and refuses a revoked department using the same session identity', async () => {
    const { project, booking, command } = await fixture();
    const employee = await createIdentity();
    await staff(employee.id, project.id, ['reservations']);
    mockUser.mockResolvedValue({ identityId: employee.id });
    await db.projectStaffPermission.update({ where: { projectId_identityId: { projectId: project.id, identityId: employee.id } }, data: { departments: ['housekeeping'] } });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(403);
    await db.projectStaffPermission.update({ where: { projectId_identityId: { projectId: project.id, identityId: employee.id } }, data: { departments: ['reservations'] } });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(200);
  });

  it('requires an active MC mandate on the exact physical unit', async () => {
    const { project, unit, owner, booking, command } = await fixture();
    const employee = await createIdentity();
    const ownOrg = await createOrganization('Synthetic MC A', project.id, 'management_company');
    const otherOrg = await createOrganization('Synthetic MC B', project.id, 'management_company');
    await db.roleAssignment.create({ data: { identityId: employee.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: ownOrg.id } });
    const mandate = await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'via_management_company', managementOrgId: otherOrg.id, status: 'active' } });
    mockUser.mockResolvedValue({ identityId: employee.id });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(403);
    await db.unitEngagement.update({ where: { id: mandate.id }, data: { managementOrgId: ownOrg.id } });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(200);
    await db.unitEngagement.update({ where: { id: mandate.id }, data: { status: 'ended' } });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(403);
  });

  it('rejects malformed and stale commands', async () => {
    const { actor, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    expect((await POST(request('confirm-unpaid', { ...command, reason: ' ' }), { params: { id: booking.id } })).status).toBe(400);
    expect((await POST(request('confirm-unpaid', { ...command, expectedUpdatedAt: new Date(0).toISOString() }), { params: { id: booking.id } })).status).toBe(409);
  });

  it('replays a completed command without reviving later cancellation or collectible debt', async () => {
    const { actor, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(200);
    await cancelBooking(db, { bookingId: booking.id, cancelledByIdentityId: actor.id,
      reason: 'Synthetic later cancellation', refundAmountThb: 0 });
    const replay = await POST(request('confirm-unpaid', command), { params: { id: booking.id } });
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking).toMatchObject({ status: 'cancelled', balanceDueSatang: 0 });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).balanceDueThb).toBe(booking.totalThb);
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid' } })).toBe(1);
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('keeps receipt authority separate and records only a real full-balance cash receipt once', async () => {
    const { project, actor, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(200);
    const reservations = await createIdentity(); await staff(reservations.id, project.id, ['reservations']);
    mockUser.mockResolvedValue({ identityId: reservations.id });
    expect((await recordCash(request('record-cash-payment', { receiptRef: 'SYNTHETIC-RECEIPT' }), { params: { id: booking.id } })).status).toBe(403);
    expect(await db.payment.count()).toBe(0);
    const finance = await createIdentity(); await staff(finance.id, project.id, ['finance']);
    mockUser.mockResolvedValue({ identityId: finance.id });
    const paid = await recordCash(request('record-cash-payment', { receiptRef: 'SYNTHETIC-RECEIPT', amountThb: 1 }), { params: { id: booking.id } });
    expect(paid.status).toBe(200);
    expect(await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } })).toMatchObject({ purpose: 'stay_balance', amountThb: booking.totalThb, receivedByIdentityId: finance.id });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed', balanceDueThb: 0 });
    expect((await recordCash(request('record-cash-payment', { receiptRef: 'SYNTHETIC-RECEIPT' }), { params: { id: booking.id } })).status).toBeGreaterThanOrEqual(400);
    expect(await db.payment.count()).toBe(1);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('returns an actionable conflict when source authority no longer permits confirmation', async () => {
    const { actor, unit, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    const source = await db.externalSystem.create({ data: { system_key: 'layantara_os', environment: 'test', display_name: 'Synthetic source' } });
    await db.externalMapping.create({ data: { external_system_id: source.id, entity_type: 'unit', internal_id: unit.id, external_id: 'synthetic-unit' } });
    const response = await POST(request('confirm-unpaid', command), { params: { id: booking.id } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'source_authority' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
    expect(await db.payment.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid' } })).toBe(0);
  });

  it('reports a checked-out balance receipt without claiming the booking became confirmed', async () => {
    const { actor, booking, command } = await fixture();
    mockUser.mockResolvedValue({ identityId: actor.id });
    expect((await POST(request('confirm-unpaid', command), { params: { id: booking.id } })).status).toBe(200);
    await db.booking.update({ where: { id: booking.id }, data: { status: 'checked_out' } });
    const response = await recordCash(request('record-cash-payment', { receiptRef: 'SYNTHETIC-LATE-RECEIPT' }), { params: { id: booking.id } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ receiptRecorded: true, bookingStatus: 'checked_out', confirmed: false });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'checked_out', balanceDueThb: 0 });
    expect(await db.payment.count()).toBe(1);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(1);
  });

});
