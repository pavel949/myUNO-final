import { beforeEach, describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  assertOperationalTaskAccess,
  assertOperationalTeamAssignment,
  getOperatingSpaceOverviewAccess,
  eligibleOrganizationUnits,
  getLegacyOperationalUnitIds,
  getScopedOperationalAccess,
  operationalTaskVisibility,
  TASK_DEPARTMENTS,
} from './operating-space-access.service';

// Real PostgreSQL fixtures only. src/test/util requires DATABASE_URL_TEST;
// run through the repository's single-fork Vitest config against an isolated DB.
const DAY = 86_400_000;
const past = () => new Date(Date.now() - DAY);
const future = () => new Date(Date.now() + DAY);

async function fixture() {
  const actor = await createIdentity();
  const owner = await createIdentity();
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const sibling = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const org = await db.organization.create({ data: {
    name: 'Scope test operator', orgType: 'management_company',
    contactEmail: 'scope-operator@example.test', contactPhone: '+66000000000',
  } });
  const relation = await db.projectOrganizationRole.create({ data: {
    projectId: project.id, organizationId: org.id, roleKey: 'operator',
    provenance: 'verified', effectiveFrom: past(), effectiveTo: future(),
  } });
  const role = await db.roleAssignment.create({ data: {
    identityId: actor.id, role: 'staff_ops', scopeType: 'project', projectId: project.id,
  } });
  const permission = await db.projectStaffPermission.create({ data: {
    identityId: actor.id, projectId: project.id, departments: ['housekeeping'],
  } });
  const space = await db.operatingSpace.create({ data: {
    key: 'scope-test', name: 'Scope test', organizationId: org.id,
  } });
  const attachment = await db.operatingSpaceUnit.create({ data: {
    operatingSpaceId: space.id, unitId: unit.id, startsOn: past(),
  } });
  const member = await db.operatingSpaceMember.create({ data: {
    operatingSpaceId: space.id, identityId: actor.id, capabilities: ['manage_tasks'],
  } });
  const task = await db.operationalTask.create({ data: {
    operatingSpaceId: space.id, projectId: project.id, unitId: unit.id,
    taskType: 'custom', dueAt: future(), title: 'Known scoped task',
  } });
  return { actor, owner, project, unit, sibling, org, relation, role, permission, space, attachment, member, task };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

const access = (f: Fixture) => getScopedOperationalAccess(db, f.actor.id, f.space.id, 'manage_tasks', TASK_DEPARTMENTS);

async function visibleTaskIds(identityId: string) {
  const where = await operationalTaskVisibility(db, identityId);
  return (await db.operationalTask.findMany({ where, select: { id: true } })).map(t => t.id).sort();
}

async function mandate(f: Fixture, overrides: Partial<Prisma.UnitEngagementUncheckedCreateInput> = {}) {
  const evidence = await db.mediaAsset.create({ data: {
    storageKey: `private:scope-mandate:${f.unit.id}`, kind: 'document',
    encrypted: true, mimeType: 'application/pdf', sizeBytes: 16, uploadedByIdentityId: f.owner.id,
  } });
  return db.unitEngagement.create({ data: {
    unitId: f.unit.id, ownerIdentityId: f.owner.id, managementOrgId: f.org.id,
    engagementType: 'via_management_company', status: 'active', mandateMediaId: evidence.id,
    startsOn: past(), endsOn: future(), ...overrides,
  } });
}

describe('Operating-space staff access: current authority intersections (AT27/AT28)', () => {
  beforeEach(resetDb);

  it('intersects current attachments, eligible organization units and the existing project grant', async () => {
    const f = await fixture();
    const foreignProject = await createProject();
    const foreign = await createUnit({ projectId: foreignProject.id });
    await db.projectOrganizationRole.create({ data: {
      projectId: foreignProject.id, organizationId: f.org.id, roleKey: 'operator', provenance: 'verified',
    } });
    await db.operatingSpaceUnit.create({ data: {
      operatingSpaceId: f.space.id, unitId: foreign.id, startsOn: past(),
    } });
    expect((await access(f)).unitIds).toEqual([f.unit.id]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).resolves.toBeUndefined();
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, [])).toEqual([]);
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, [foreign.id])).toEqual([]);
    // A sibling in the same project remains legacy-authorized, not space-authorized.
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, [f.sibling.id])).toEqual([f.sibling.id]);
  });

  it.each(['invited', 'blocked', 'merged', 'deletion_requested'] as const)('rejects a newly %s identity on every read', async status => {
    const f = await fixture();
    await db.identity.update({ where: { id: f.actor.id }, data: { status } });
    await expect(access(f)).rejects.toMatchObject({ status: 403 });
    await expect(operationalTaskVisibility(db, f.actor.id)).rejects.toMatchObject({ status: 403 });
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
  });

  it.each(['organization', 'space', 'member', 'capability'] as const)('immediately denies an inactive or missing %s boundary', async boundary => {
    const f = await fixture();
    if (boundary === 'organization') await db.organization.update({ where: { id: f.org.id }, data: { status: 'suspended' } });
    if (boundary === 'space') await db.operatingSpace.update({ where: { id: f.space.id }, data: { status: 'archived' } });
    if (boundary === 'member') await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { active: false } });
    if (boundary === 'capability') await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { capabilities: ['view_calendar'] } });
    await expect(access(f)).rejects.toMatchObject({ status: 403 });
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
    expect(await visibleTaskIds(f.actor.id)).not.toContain(f.task.id);
  });

  it.each(['inactive', 'future', 'expired', 'deleted'] as const)('denies a known task after its unit attachment becomes %s', async state => {
    const f = await fixture();
    if (state === 'deleted') await db.operatingSpaceUnit.delete({ where: { id: f.attachment.id } });
    else await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data:
      state === 'inactive' ? { active: false } : state === 'future' ? { startsOn: future() } : { endsOn: past() },
    });
    expect((await access(f)).unitIds).toEqual([]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
    expect(await visibleTaskIds(f.actor.id)).not.toContain(f.task.id);
    expect(await db.operationalTask.findUnique({ where: { id: f.task.id } })).toEqual(f.task);
    expect(await db.auditLog.count()).toBe(0);
  });

  it.each(['revoked', 'wrong_department', 'empty_departments', 'unit_role', 'platform_role'] as const)('does not broaden a %s legacy staff grant', async condition => {
    const f = await fixture();
    if (condition === 'revoked') await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    if (condition === 'wrong_department' || condition === 'empty_departments') await db.projectStaffPermission.update({
      where: { projectId_identityId: { projectId: f.project.id, identityId: f.actor.id } },
      data: { departments: condition === 'wrong_department' ? ['finance'] : [] },
    });
    if (condition === 'unit_role') await db.roleAssignment.update({ where: { id: f.role.id }, data: { scopeType: 'unit', unitId: f.unit.id } });
    if (condition === 'platform_role') await db.roleAssignment.update({ where: { id: f.role.id }, data: { scopeType: 'platform', projectId: null } });
    expect((await access(f)).unitIds).toEqual([]);
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, [f.sibling.id])).toEqual([]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
  });

  it.each(['', 'unknown-space', '   '])('does not fall back to legacy authority for an explicit invalid space %j', async operatingSpaceId => {
    const f = await fixture();
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, [f.unit.id])).toEqual([f.unit.id]);
    await expect(getScopedOperationalAccess(db, f.actor.id, operatingSpaceId, 'manage_tasks', TASK_DEPARTMENTS))
      .rejects.toMatchObject({ status: 403 });
    await expect(assertOperationalTaskAccess(db, f.actor.id, { ...f.task, operatingSpaceId }))
      .rejects.toMatchObject({ status: 403 });
  });

  it('denies a same-project sibling that is not attached to the selected space', async () => {
    const f = await fixture();
    await expect(assertOperationalTaskAccess(db, f.actor.id, { ...f.task, unitId: f.sibling.id }))
      .rejects.toMatchObject({ status: 403 });
  });

  it('requires the prospective assignee to have their own current space membership', async () => {
    const f = await fixture();
    const assignee = await createIdentity();
    await db.roleAssignment.create({ data: { identityId: assignee.id, role: 'staff_ops', scopeType: 'project', projectId: f.project.id } });
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).resolves.toBeUndefined();
    await expect(assertOperationalTaskAccess(db, assignee.id, f.task)).rejects.toMatchObject({ status: 403 });
    expect(await db.operatingSpaceMember.count({ where: { identityId: assignee.id } })).toBe(0);
    expect(await db.operationalTask.findUnique({ where: { id: f.task.id } })).toEqual(f.task);
  });

  it('does not treat manage_tasks as authority to assign tasks', async () => {
    const f = await fixture();
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task, 'assign_tasks')).rejects.toMatchObject({ status: 403 });
    await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { capabilities: ['manage_tasks', 'assign_tasks'] } });
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task, 'assign_tasks')).resolves.toBeUndefined();
  });

  it('keeps founder requests bounded by the explicitly selected eligible physical scope', async () => {
    const f = await fixture();
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: true } });
    await db.operatingSpaceMember.delete({ where: { id: f.member.id } });
    expect((await access(f)).unitIds).toEqual([f.unit.id]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, { ...f.task, unitId: f.sibling.id })).rejects.toMatchObject({ status: 403 });
    await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: { startsOn: future() } });
    expect((await access(f)).unitIds).toEqual([]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
  });

  it('preserves an existing project staff grant without creating a department policy', async () => {
    const f = await fixture();
    await db.projectStaffPermission.delete({ where: { projectId_identityId: { projectId: f.project.id, identityId: f.actor.id } } });
    expect((await access(f)).unitIds).toEqual([f.unit.id]);
    expect(await db.projectStaffPermission.count()).toBe(0);
  });

  it('keeps a foreign known task ID hidden even when its physical unit has a legacy project grant', async () => {
    const f = await fixture();
    const foreignSpace = await db.operatingSpace.create({ data: { key: 'foreign-space', name: 'Foreign space', organizationId: f.org.id } });
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: foreignSpace.id, unitId: f.unit.id, startsOn: past() } });
    const foreignTask = await db.operationalTask.create({ data: {
      projectId: f.project.id, unitId: f.unit.id, operatingSpaceId: foreignSpace.id, taskType: 'custom', dueAt: future(),
    } });
    const legacyTask = await db.operationalTask.create({ data: {
      projectId: f.project.id, unitId: f.sibling.id, taskType: 'custom', dueAt: future(),
    } });
    const foreignProject = await createProject();
    const foreignUnit = await createUnit({ projectId: foreignProject.id });
    await db.operationalTask.create({ data: { projectId: foreignProject.id, unitId: foreignUnit.id, taskType: 'custom', dueAt: future() } });
    expect(await visibleTaskIds(f.actor.id)).toEqual([f.task.id, legacyTask.id].sort());
    const persisted = await db.operationalTask.findUniqueOrThrow({ where: { id: foreignTask.id } });
    await expect(assertOperationalTaskAccess(db, f.actor.id, persisted)).rejects.toMatchObject({ status: 403 });
    expect(await db.operationalTask.findUnique({ where: { id: foreignTask.id } })).toEqual(foreignTask);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('checks a task project against the physical unit instead of trusting a supplied project ID', async () => {
    const f = await fixture();
    const foreignProject = await createProject();
    await expect(assertOperationalTaskAccess(db, f.actor.id, { ...f.task, projectId: foreignProject.id }))
      .rejects.toMatchObject({ status: 403 });
  });

  it('does not turn membership alone into legacy project or unit authority', async () => {
    const f = await fixture();
    await db.roleAssignment.delete({ where: { id: f.role.id } });
    expect((await access(f)).unitIds).toEqual([]);
    expect(await visibleTaskIds(f.actor.id)).toEqual([]);
    expect(await db.roleAssignment.count()).toBe(0);
  });
});

describe('Operating organization eligibility: effective, verified evidence', () => {
  beforeEach(resetDb);

  it.each(['operator', 'resort_operator', 'management_operator', 'property_manager', 'management_company'])('accepts a current verified %s project relationship', async roleKey => {
    const f = await fixture();
    await db.projectOrganizationRole.update({ where: { id: f.relation.id }, data: { roleKey } });
    expect((await eligibleOrganizationUnits(db, f.org.id)).map(u => u.id).sort()).toEqual([f.unit.id, f.sibling.id].sort());
  });

  it.each(['unverified', 'future', 'expired', 'unrelated_role', 'offboarded'] as const)('excludes %s operating evidence', async state => {
    const f = await fixture();
    const changes: Prisma.ProjectOrganizationRoleUpdateInput = state === 'unverified' ? { provenance: 'imported' }
      : state === 'future' ? { effectiveFrom: future() }
      : state === 'expired' ? { effectiveTo: past() }
      : state === 'unrelated_role' ? { roleKey: 'developer' } : {};
    await db.projectOrganizationRole.update({ where: { id: f.relation.id }, data: changes });
    if (state === 'offboarded') await db.unit.update({ where: { id: f.unit.id }, data: { status: 'offboarded' } });
    expect((await eligibleOrganizationUnits(db, f.org.id)).map(u => u.id)).not.toContain(f.unit.id);
    expect((await access(f)).unitIds).toEqual([]);
  });

  it('uses half-open project relationship dates at the exact start and end', async () => {
    const f = await fixture();
    const now = new Date('2026-10-14T12:00:00.000Z');
    await db.projectOrganizationRole.update({ where: { id: f.relation.id }, data: { effectiveFrom: now, effectiveTo: new Date(now.getTime() + 1) } });
    expect((await eligibleOrganizationUnits(db, f.org.id, now)).map(u => u.id)).toContain(f.unit.id);
    expect(await eligibleOrganizationUnits(db, f.org.id, new Date(now.getTime() + 1))).toEqual([]);
  });

  it('accepts a current evidenced management mandate without a project operator relationship', async () => {
    const f = await fixture();
    await db.projectOrganizationRole.delete({ where: { id: f.relation.id } });
    await mandate(f);
    expect((await eligibleOrganizationUnits(db, f.org.id)).map(u => u.id)).toEqual([f.unit.id]);
  });

  it.each(['missing_evidence', 'draft', 'ended', 'future', 'expired', 'wrong_org', 'owner_direct'] as const)('does not derive authority from a %s mandate', async state => {
    const f = await fixture();
    await db.projectOrganizationRole.delete({ where: { id: f.relation.id } });
    const row = await mandate(f);
    const changes: Prisma.UnitEngagementUncheckedUpdateInput = state === 'missing_evidence' ? { mandateMediaId: null }
      : state === 'draft' ? { status: 'draft' }
      : state === 'ended' ? { status: 'ended' }
      : state === 'future' ? { startsOn: future() }
      : state === 'expired' ? { endsOn: past() }
      : state === 'wrong_org' ? { managementOrgId: null }
      : { engagementType: 'owner_direct' };
    await db.unitEngagement.update({ where: { id: row.id }, data: changes });
    expect(await eligibleOrganizationUnits(db, f.org.id)).toEqual([]);
    expect((await access(f)).unitIds).toEqual([]);
  });
});

describe('Management-company scope remains organization + project + effective mandate', () => {
  beforeEach(resetDb);

  it('permits only the current matching organization mandate, never its unengaged sibling', async () => {
    const f = await fixture();
    await db.roleAssignment.update({ where: { id: f.role.id }, data: { role: 'mc_member', organizationId: f.org.id } });
    await mandate(f);
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS)).toEqual([f.unit.id]);
    expect((await access(f)).unitIds).toEqual([f.unit.id]);
  });

  it.each(['future', 'expired', 'ended', 'missing_org', 'foreign_org', 'wrong_project', 'wrong_scope'] as const)('denies %s MC authority despite active space membership', async state => {
    const f = await fixture();
    await db.roleAssignment.update({ where: { id: f.role.id }, data: { role: 'mc_member', organizationId: f.org.id } });
    const row = await mandate(f);
    if (state === 'future' || state === 'expired' || state === 'ended') await db.unitEngagement.update({ where: { id: row.id }, data:
      state === 'future' ? { startsOn: future() } : state === 'expired' ? { endsOn: past() } : { status: 'ended' },
    });
    if (state === 'missing_org') await db.roleAssignment.update({ where: { id: f.role.id }, data: { organizationId: null } });
    if (state === 'foreign_org') {
      const org = await db.organization.create({ data: { name: 'Other company', orgType: 'management_company', contactEmail: 'other@example.test', contactPhone: '+66000000001' } });
      await db.roleAssignment.update({ where: { id: f.role.id }, data: { organizationId: org.id } });
    }
    if (state === 'wrong_project') {
      const project = await createProject();
      await db.roleAssignment.update({ where: { id: f.role.id }, data: { projectId: project.id } });
    }
    if (state === 'wrong_scope') await db.roleAssignment.update({ where: { id: f.role.id }, data: { scopeType: 'platform', projectId: null } });
    expect((await access(f)).unitIds).toEqual([]);
    await expect(assertOperationalTaskAccess(db, f.actor.id, f.task)).rejects.toMatchObject({ status: 403 });
    expect(await visibleTaskIds(f.actor.id)).toEqual([]);
  });
});

describe('Workspace summaries and team recipients retain the effective boundary', () => {
  beforeEach(resetDb);
  it('projects a mixed-project workspace onto only currently authorized units and no booking capabilities', async () => {
    const f = await fixture();
    const otherProject = await createProject();
    const other = await createUnit({ projectId: otherProject.id });
    await db.projectOrganizationRole.create({ data: { projectId: otherProject.id, organizationId: f.org.id, roleKey: 'operator', provenance: 'verified' } });
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: f.space.id, unitId: other.id, startsOn: past() } });
    const result = await getOperatingSpaceOverviewAccess(db, f.actor.id, f.space.id);
    expect(result.unitIds).toEqual([f.unit.id]);
    expect(result.byCapability).toEqual({ manage_tasks: [f.unit.id] });
  });
  it.each(['role', 'department', 'attachment', 'relationship', 'identity', 'organization', 'membership'] as const)('rejects summary access after %s revocation with an existing identity cookie', async kind => {
    const f = await fixture();
    if (kind === 'role') await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    if (kind === 'department') await db.projectStaffPermission.update({ where: { projectId_identityId: { projectId: f.project.id, identityId: f.actor.id } }, data: { departments: [] } });
    if (kind === 'attachment') await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: { active: false } });
    if (kind === 'relationship') await db.projectOrganizationRole.update({ where: { id: f.relation.id }, data: { effectiveTo: past() } });
    if (kind === 'identity') await db.identity.update({ where: { id: f.actor.id }, data: { status: 'blocked' } });
    if (kind === 'organization') await db.organization.update({ where: { id: f.org.id }, data: { status: 'suspended' } });
    if (kind === 'membership') await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { active: false } });
    await expect(getOperatingSpaceOverviewAccess(db, f.actor.id, f.space.id)).rejects.toMatchObject({ status: 403 });
  });
  it('does not broaden a dual-role user in explicit management-company mode', async () => {
    const f = await fixture();
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, undefined, undefined, true)).toEqual([]);
    await db.roleAssignment.create({ data: { identityId: f.actor.id, role: 'mc_member', scopeType: 'project', projectId: f.project.id, organizationId: f.org.id } });
    await mandate(f);
    expect(await getLegacyOperationalUnitIds(db, f.actor.id, TASK_DEPARTMENTS, undefined, undefined, true)).toEqual([f.unit.id]);
  });
  it.each(['empty', 'revoked_role', 'future_attachment', 'inactive_team', 'foreign_space'] as const)('rejects %s team assignment even with a known team ID', async kind => {
    const f = await fixture();
    const team = await db.operatingTeam.create({ data: { operatingSpaceId: f.space.id, name: 'Daily team', teamType: 'housekeeping' } });
    if (kind !== 'empty') await db.operatingTeamMember.create({ data: { operatingTeamId: team.id, identityId: f.actor.id } });
    if (kind === 'revoked_role') await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    if (kind === 'future_attachment') await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: { startsOn: future() } });
    if (kind === 'inactive_team') await db.operatingTeam.update({ where: { id: team.id }, data: { active: false } });
    const scope = kind === 'foreign_space' ? { ...f.task, operatingSpaceId: 'another-space' } : f.task;
    await expect(assertOperationalTeamAssignment(db, team.id, scope)).rejects.toMatchObject({ status: 403 });
  });
  it('accepts an active team only while every active recipient has exact task-unit authority', async () => {
    const f = await fixture();
    const team = await db.operatingTeam.create({ data: { operatingSpaceId: f.space.id, name: 'Daily team', teamType: 'housekeeping' } });
    await db.operatingTeamMember.create({ data: { operatingTeamId: team.id, identityId: f.actor.id } });
    await expect(assertOperationalTeamAssignment(db, team.id, f.task)).resolves.toBeUndefined();
    const outsider = await createIdentity();
    await db.operatingTeamMember.create({ data: { operatingTeamId: team.id, identityId: outsider.id } });
    await expect(assertOperationalTeamAssignment(db, team.id, f.task)).rejects.toMatchObject({ status: 403 });
  });
});

describe('admin overview canonical scope parity', () => {
  beforeEach(resetDb);
  it('keeps only eligible attached units, then immediately respects revocation', async () => {
    const f = await fixture();
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: true } });
    const overview = await getOperatingSpaceOverviewAccess(db, f.actor.id, f.space.id);
    expect(overview.unitIds).toEqual([f.unit.id]);
    expect(Object.keys(overview.byCapability)).toHaveLength(13);
    for (const ids of Object.values(overview.byCapability)) expect(ids).toEqual([f.unit.id]);
    expect(overview.byCapability).not.toHaveProperty('create_unit');
    expect(overview.byCapability).not.toHaveProperty('create_complex');
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: false } });
    const staff = await getOperatingSpaceOverviewAccess(db, f.actor.id, f.space.id);
    expect(staff.isAdmin).toBe(false);
    expect(Object.keys(staff.byCapability)).toEqual(['manage_tasks']);
    await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { active: false } });
    await expect(getOperatingSpaceOverviewAccess(db, f.actor.id, f.space.id)).rejects.toMatchObject({ status: 403 });
  });
});
