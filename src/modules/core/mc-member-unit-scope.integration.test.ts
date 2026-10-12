import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, createOrganization, createProject, createUnit, db, resetDb } from '@/test/util';
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { can } from './permissions';

/**
 * A management-company member holds a project-scoped role. `can()` must still
 * limit them to the units their own company currently manages (doc 03: "their
 * units"), never to every unit in the project.
 */

let w: Awaited<ReturnType<typeof build>>;

async function build() {
  const project = await createProject({ status: 'live' });
  const [mcA, mcB, owner] = await Promise.all([createIdentity(), createIdentity(), createIdentity()]);
  const [orgA, orgB] = await Promise.all([
    createOrganization('MC A', project.id),
    createOrganization('MC B', project.id),
  ]);
  for (const [identity, org] of [[mcA, orgA], [mcB, orgB]] as const) {
    await db.roleAssignment.create({
      data: { identityId: identity.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: org.id, status: 'active' },
    });
  }
  const unitA = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, name: 'Managed by A' });
  const unitB = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, name: 'Managed by B' });
  const unitDirect = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, name: 'Owner direct' });
  await db.unitEngagement.create({ data: { unitId: unitA.id, ownerIdentityId: owner.id, engagementType: 'via_management_company', managementOrgId: orgA.id, status: 'active' } });
  await db.unitEngagement.create({ data: { unitId: unitB.id, ownerIdentityId: owner.id, engagementType: 'via_management_company', managementOrgId: orgB.id, status: 'active' } });
  await db.unitEngagement.create({ data: { unitId: unitDirect.id, ownerIdentityId: owner.id, engagementType: 'owner_direct', status: 'active' } });
  return { project, mcA, mcB, orgA, unitA, unitB, unitDirect };
}

const check = (identity: { id: string }, action: string, unitId: string, requiredAccess: 'read' | 'allow' = 'allow') =>
  can({ identity: identity as never, action, requiredAccess, resource: { projectId: w.project.id, unitId } });

const UNIT_ACTIONS = [
  'money:record_costs_on_units',
  'units:manage_availability_and_pricing',
  'stays:record_checkin_checkout_and_reports',
  'units:view_full_record',
];

beforeEach(async () => {
  await resetDb();
  w = await build();
});

describe('mc_member is limited to the units their company manages', () => {
  it.each(UNIT_ACTIONS)('%s: allowed on the own-company unit', async (action) => {
    const mcA = await db.identity.findUniqueOrThrow({ where: { id: w.mcA.id } });
    expect(await check(mcA, action, w.unitA.id)).toBe(true);
  });

  it.each(UNIT_ACTIONS)('%s: denied on a unit managed by another company in the same project', async (action) => {
    const mcA = await db.identity.findUniqueOrThrow({ where: { id: w.mcA.id } });
    expect(await check(mcA, action, w.unitB.id)).toBe(false);
  });

  it.each(UNIT_ACTIONS)('%s: denied on an owner-direct unit', async (action) => {
    const mcA = await db.identity.findUniqueOrThrow({ where: { id: w.mcA.id } });
    expect(await check(mcA, action, w.unitDirect.id)).toBe(false);
  });

  it('follows the live mandate: ended or not-yet-started mandates grant nothing', async () => {
    const mcA = await db.identity.findUniqueOrThrow({ where: { id: w.mcA.id } });
    await db.unitEngagement.updateMany({ where: { unitId: w.unitA.id }, data: { status: 'ended' } });
    expect(await check(mcA, 'money:record_costs_on_units', w.unitA.id)).toBe(false);
    await db.unitEngagement.updateMany({ where: { unitId: w.unitA.id }, data: { status: 'active', startsOn: new Date(Date.now() + 86_400_000) } });
    expect(await check(mcA, 'money:record_costs_on_units', w.unitA.id)).toBe(false);
    await db.unitEngagement.updateMany({ where: { unitId: w.unitA.id }, data: { startsOn: null, endsOn: new Date(Date.now() - 1000) } });
    expect(await check(mcA, 'money:record_costs_on_units', w.unitA.id)).toBe(false);
  });

  it('an mc_member role with no organization manages nothing', async () => {
    const stray = await createIdentity();
    await db.roleAssignment.create({ data: { identityId: stray.id, role: 'mc_member', scopeType: 'project', projectId: w.project.id, status: 'active' } });
    expect(await check(stray, 'money:record_costs_on_units', w.unitA.id)).toBe(false);
  });

  it('is unchanged where no unit is involved and for actions that are not unit-bound', async () => {
    const mcA = await db.identity.findUniqueOrThrow({ where: { id: w.mcA.id } });
    // Browsing live listings carries no unit scope: still allowed on any unit of the project.
    expect(await check(mcA, 'stays:search_and_view_live_listings', w.unitB.id, 'read')).toBe(true);
    // A project-level action with no unit in the resource is not narrowed here.
    expect(await can({ identity: mcA as never, action: 'units:view_full_record', resource: { projectId: w.project.id } })).toBe(true);
  });

  it('admin and platform-scoped staff are unaffected', async () => {
    const admin = await createIdentity({ isAdmin: true });
    expect(await check(admin, 'money:record_costs_on_units', w.unitB.id)).toBe(true);
    const staff = await createIdentity();
    await db.roleAssignment.create({ data: { identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: w.project.id, status: 'active' } });
    expect(await check(staff, 'money:record_costs_on_units', w.unitB.id)).toBe(true);
  });
});
