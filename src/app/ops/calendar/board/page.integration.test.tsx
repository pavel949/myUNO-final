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
