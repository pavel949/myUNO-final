import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, createOrganization, createProject, createUnit, db, resetDb } from '@/test/util';
import { getMCBookings, getMCManagedUnits } from './mc.service';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';

describe('MC mandate effective dates', () => {
  beforeEach(resetDb);
  it('denies future, expired, ended and other-organization mandates across unit and booking reads', async () => {
    const project = await createProject();
    const manager = await createIdentity();
    const owner = await createIdentity();
    const organization = await createOrganization('Current MC', project.id);
    const otherOrganization = await createOrganization('Other MC', project.id);
    const role = await db.roleAssignment.create({ data: {
      identityId: manager.id, role: 'mc_member', scopeType: 'project', projectId: project.id,
      organizationId: organization.id, status: 'active',
    } });
    const user: CurrentUser = { identityId: manager.id, email: manager.email, firstName: manager.firstName,
      lastName: manager.lastName, isAdmin: false,
      roles: [{ role: 'mc_member', projectId: project.id, organizationId: organization.id, unitId: null, providerId: null }] };
    const now = Date.now();
    const day = 86_400_000;
    const cases = [
      { name: 'Current', startsOn: new Date(now - day), endsOn: new Date(now + day), status: 'active' as const, org: organization.id, allowed: true },
      { name: 'Legacy open', startsOn: null, endsOn: null, status: 'active' as const, org: organization.id, allowed: true },
      { name: 'Future', startsOn: new Date(now + day), endsOn: null, status: 'active' as const, org: organization.id, allowed: false },
      { name: 'Expired', startsOn: null, endsOn: new Date(now), status: 'active' as const, org: organization.id, allowed: false },
      { name: 'Revoked', startsOn: null, endsOn: null, status: 'ended' as const, org: organization.id, allowed: false },
      { name: 'Other MC', startsOn: null, endsOn: null, status: 'active' as const, org: otherOrganization.id, allowed: false },
    ];
    const allowedIds: string[] = [];
    const checks: Array<{ unitId: string; allowed: boolean }> = [];
    for (const entry of cases) {
      const unit = await createUnit({ projectId: project.id, name: entry.name });
      await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id,
        engagementType: 'via_management_company', managementOrgId: entry.org,
        status: entry.status, startsOn: entry.startsOn, endsOn: entry.endsOn } });
      await db.booking.create({ data: { unitId: unit.id, projectId: project.id, guestIdentityId: owner.id,
        bookingType: 'guest_stay', channel: 'manual', status: 'requested', adults: 1, children: 0, totalThb: 100,
        startDate: new Date('2027-02-01'), endDate: new Date('2027-02-04') } });
      if (entry.allowed) allowedIds.push(unit.id);
      checks.push({ unitId: unit.id, allowed: entry.allowed });
    }
    expect((await getMCManagedUnits(db, manager.id, project.id, organization.id)).map(unit => unit.id).sort()).toEqual(allowedIds.sort());
    for (const check of checks) {
      expect(await hasManagedUnitMcAccess(user, { projectId: project.id, unitId: check.unitId })).toBe(check.allowed);
    }
    const foreignProject = await createProject();
    const foreignUnit = await createUnit({ projectId: foreignProject.id });
    await db.unitEngagement.create({ data: {
      unitId: foreignUnit.id, ownerIdentityId: owner.id, managementOrgId: organization.id,
      engagementType: 'via_management_company', status: 'active',
    } });
    expect(await hasManagedUnitMcAccess(user, { projectId: project.id, unitId: foreignUnit.id })).toBe(false);
    expect((await getMCBookings(db, manager.id, project.id, organization.id)).map(booking => booking.unit.id).sort()).toEqual(allowedIds.sort());
    await db.roleAssignment.update({ where: { id: role.id }, data: { status: 'revoked' } });
    await expect(getMCManagedUnits(db, manager.id, project.id, organization.id)).rejects.toThrow('does not have access');
  });
});
