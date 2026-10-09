import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, createOrganization, createProject, createUnit, db, resetDb } from '@/test/util';

const session: { user: unknown } = { user: null };
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => session.user,
}));
vi.mock('@/lib/i18n', () => ({
  getLabels: async (fallbacks: Record<string,string>) => fallbacks,
}));

import UnifiedStayCalendarPage from './page';
import { getOperatingSpaceUnitIds } from '@/modules/ops';

describe('operating-space calendar authorization', () => {
  beforeEach(async () => { await resetDb(); session.user = null; });

  async function fixture() {
    const project = await createProject({ status: 'live' });
    const manager = await createIdentity();
    const owner = await createIdentity();
    const organization = await createOrganization('Space MC', project.id);
    await db.roleAssignment.create({ data: { identityId: manager.id, role: 'mc_member', scopeType: 'project',
      projectId: project.id, organizationId: organization.id, status: 'active' } });
    const space = await db.operatingSpace.create({ data: { key: 'scope-a', name: 'Scope A', organizationId: organization.id } });
    const member = await db.operatingSpaceMember.create({ data: {
      operatingSpaceId: space.id, identityId: manager.id, active: true, capabilities: ['view_calendar'],
    } });
    session.user = { identityId: manager.id, isAdmin: false,
      roles: [{ role: 'mc_member', projectId: project.id, organizationId: organization.id }] };
    const addUnit = async (name: string, startsOn: Date, endsOn: Date | null = null) => {
      const unit = await createUnit({ projectId: project.id, name, status: 'live' });
      await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id,
        managementOrgId: organization.id, engagementType: 'via_management_company', status: 'active' } });
      await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId: unit.id, startsOn, endsOn } });
      return unit;
    };
    return { space, member, organization, addUnit };
  }

  it.each(['missing_capability', 'revoked_member', 'archived_space'])('denies %s before exposing calendar inventory', async (reason) => {
    const { space, member, addUnit } = await fixture();
    await addUnit('Protected villa', new Date(Date.now() - 86_400_000));
    if (reason === 'missing_capability') await db.operatingSpaceMember.update({ where: { id: member.id }, data: { capabilities: [] } });
    if (reason === 'revoked_member') await db.operatingSpaceMember.update({ where: { id: member.id }, data: { active: false } });
    if (reason === 'archived_space') await db.operatingSpace.update({ where: { id: space.id }, data: { status: 'archived' } });
    await expect(UnifiedStayCalendarPage({ searchParams: { spaceId: space.id } }))
      .rejects.toMatchObject({ digest: expect.stringContaining('/ops/spaces') });
  });

  it('includes only current unit assignments and preserves isolation between overlapping portfolios', async () => {
    const { space, organization, addUnit } = await fixture();
    const now = Date.now();
    const current = await addUnit('Current villa', new Date(now - 86_400_000));
    await addUnit('Future villa', new Date(now + 86_400_000));
    await addUnit('Expired villa', new Date(now - 86_400_000), new Date(now));
    expect(await getOperatingSpaceUnitIds(db, space.id)).toEqual([current.id]);
    const other = await db.operatingSpace.create({ data: { key: 'scope-b', name: 'Other scope', organizationId: organization.id } });
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: other.id, unitId: current.id } });
    const page = await UnifiedStayCalendarPage({ searchParams: { spaceId: space.id } });
    expect(page.props.units.map((unit: { id: string }) => unit.id)).toEqual([current.id]);
    await expect(UnifiedStayCalendarPage({ searchParams: { spaceId: other.id } }))
      .rejects.toMatchObject({ digest: expect.stringContaining('/ops/spaces') });
  });
});

describe('MC access to the canonical occupancy projection', () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
  });

  it('shows only active MC-engaged units and does not leak other-unit or guest data', async () => {
    const project = await createProject({ status: 'live' });
    const mc = await createIdentity();
    const owner = await createIdentity();
    const organization = await createOrganization('Verified MC', project.id);
    const assigned = await createUnit({ projectId: project.id, name: 'MC A', status: 'live' });
    const other = await createUnit({ projectId: project.id, name: 'Other B', status: 'live' });
    await db.roleAssignment.create({
      data: {
        identityId: mc.id, role: 'mc_member', scopeType: 'project',
        projectId: project.id, organizationId: organization.id, status: 'active',
      },
    });
    await db.unitEngagement.create({
      data: {
        unitId: assigned.id, ownerIdentityId: owner.id,
        managementOrgId: organization.id, engagementType: 'via_management_company',
        status: 'active',
      },
    });
    session.user = {
      identityId: mc.id, isAdmin: false,
      roles: [{ role: 'mc_member', projectId: project.id, organizationId: organization.id }],
    };

    const page = await UnifiedStayCalendarPage({
      searchParams: { projectId: project.id, organizationId: organization.id },
    });
    const props = page.props as {
      mode: string; organizationId: string;
      units: Array<{ id: string }>;
      allUnits: Array<{ id: string }>;
      entries: Record<string, { label: string }>;
    };
    expect(props.mode).toBe('mc');
    expect(props.organizationId).toBe(organization.id);
    expect(props.units.map(unit => unit.id)).toEqual([assigned.id]);
    expect(props.allUnits.map(unit => unit.id)).toEqual([assigned.id]);
    expect(props.units.some(unit => unit.id === other.id)).toBe(false);
    expect(props.entries).toEqual({});
  });

  it('never uses an unrequested organization or project to widen MC access', async () => {
    const project = await createProject({ status: 'live' });
    const otherProject = await createProject({ status: 'live' });
    const mc = await createIdentity();
    const owner = await createIdentity();
    const organization = await createOrganization('Verified MC', project.id);
    const assigned = await createUnit({ projectId: project.id, status: 'live' });
    await createUnit({ projectId: otherProject.id, status: 'live' });
    await db.roleAssignment.create({
      data: {
        identityId: mc.id, role: 'mc_member', scopeType: 'project',
        projectId: project.id, organizationId: organization.id, status: 'active',
      },
    });
    await db.unitEngagement.create({
      data: {
        unitId: assigned.id, ownerIdentityId: owner.id,
        managementOrgId: organization.id, engagementType: 'via_management_company',
        status: 'active',
      },
    });
    session.user = {
      identityId: mc.id, isAdmin: false,
      roles: [{ role: 'mc_member', projectId: project.id, organizationId: organization.id }],
    };
    const page = await UnifiedStayCalendarPage({
      searchParams: { projectId: otherProject.id, organizationId: 'unrelated-org' },
    });
    const props = page.props as {
      projectId: string; organizationId: string; units: Array<{ id: string }>;
    };
    expect(props.projectId).toBe(project.id);
    expect(props.organizationId).toBe(organization.id);
    expect(props.units.map(unit => unit.id)).toEqual([assigned.id]);
  });
});
