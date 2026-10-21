import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
const current = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => current() }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';
const request = (body: object) => new NextRequest('http://localhost/api/ops/reservation-groups', { method: 'POST', body: JSON.stringify(body) });
async function fixture() {
  const staff = await createIdentity();
  const guest = await createIdentity();
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const organization = await db.organization.create({ data: { name: 'Group test', orgType: 'management_company', contactEmail: 'group@example.test', contactPhone: '+66000000000' } });
  await db.projectOrganizationRole.create({ data: { projectId: project.id, organizationId: organization.id, roleKey: 'operator', provenance: 'verified' } });
  const space = await db.operatingSpace.create({ data: { key: 'group-test', name: 'Group test', organizationId: organization.id } });
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId: unit.id } });
  await db.operatingSpaceMember.create({ data: { operatingSpaceId: space.id, identityId: staff.id, capabilities: ['manage_reservations'] } });
  await db.roleAssignment.create({ data: { identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id } });
  await db.projectStaffPermission.create({ data: { identityId: staff.id, projectId: project.id, departments: ['reservations'] } });
  current.mockResolvedValue({ identityId: staff.id, isAdmin: false });
  return { staff, guest, unit, project, space };
}
describe('reservation group command effective scope', () => {
  beforeEach(async () => { await resetDb(); current.mockReset(); });
  it('denies an arbitrary foreign identity with empty bookings without creating a group', async () => {
    const f = await fixture();
    const response = await POST(request({ operatingSpaceId: f.space.id, guestIdentityId: f.guest.id, bookingIds: [] }));
    expect(response.status).toBe(403);
    expect(await db.reservationGroup.count()).toBe(0);
    expect(JSON.stringify(await response.json())).not.toContain(f.guest.email);
  });
  it('permits a guest registered for an effective unit, including an empty group', async () => {
    const f = await fixture();
    await db.auditLog.create({ data: { actorIdentityId: f.staff.id, action: 'reservation_guest:registered', entityType: 'Identity', entityId: f.guest.id, data: { operatingSpaceId: f.space.id, unitId: f.unit.id } } });
    const response = await POST(request({ operatingSpaceId: f.space.id, guestIdentityId: f.guest.id, bookingIds: [] }));
    expect(response.status).toBe(201);
    expect(await db.reservationGroup.count()).toBe(1);
  });
  it('denies membership when the project role no longer supplies effective units', async () => {
    const f = await fixture();
    await createBooking({ unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id });
    await db.roleAssignment.updateMany({ where: { identityId: f.staff.id }, data: { status: 'revoked' } });
    expect((await POST(request({ operatingSpaceId: f.space.id, guestIdentityId: f.guest.id }))).status).toBe(403);
    expect(await db.reservationGroup.count()).toBe(0);
  });
  it('rejects a booking attached to the space but outside the caller effective project scope', async () => {
    const f = await fixture();
    await createBooking({ unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id });
    const foreignProject = await createProject();
    const foreignUnit = await createUnit({ projectId: foreignProject.id });
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: f.space.id, unitId: foreignUnit.id } });
    const foreignBooking = await createBooking({ unitId: foreignUnit.id, projectId: foreignProject.id, guestIdentityId: f.guest.id });
    expect((await POST(request({ operatingSpaceId: f.space.id, guestIdentityId: f.guest.id, bookingIds: [foreignBooking.id] }))).status).toBe(400);
    expect(await db.reservationGroup.count()).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: foreignBooking.id } })).reservationGroupId).toBeNull();
  });
});
