import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  createGovernedOperatingSpace,
  updateGovernedOperatingMember,
  updateGovernedOperatingScope,
} from './operating-space-governance.service';
import { assertOperationalTaskAccess, getScopedOperationalAccess, TASK_DEPARTMENTS } from './operating-space-access.service';

// Destructive fixture reset is permitted only in the repository's isolated
// PostgreSQL test database. These tests do not mock Prisma or authorization.
const DAY = 86_400_000;
const past = () => new Date(Date.now() - DAY);
const future = () => new Date(Date.now() + DAY);

async function fixture() {
  const founder = await createIdentity({ isAdmin: true });
  const staff = await createIdentity();
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const sibling = await createUnit({ projectId: project.id });
  const org = await db.organization.create({ data: {
    name: 'Governance operator', orgType: 'management_company',
    contactEmail: 'governance@example.test', contactPhone: '+66000000000',
  } });
  const relation = await db.projectOrganizationRole.create({ data: {
    projectId: project.id, organizationId: org.id, roleKey: 'operator', provenance: 'verified',
    effectiveFrom: past(), effectiveTo: future(),
  } });
  const space = await db.operatingSpace.create({ data: {
    key: 'existing-scope', name: 'Existing scope', organizationId: org.id,
  } });
  const attachment = await db.operatingSpaceUnit.create({ data: {
    operatingSpaceId: space.id, unitId: unit.id, startsOn: past(),
  } });
  return { founder, staff, project, unit, sibling, org, relation, space, attachment };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function staffGrant(f: Fixture, departments = ['housekeeping']) {
  const role = await db.roleAssignment.create({ data: {
    identityId: f.staff.id, role: 'staff_ops', scopeType: 'project', projectId: f.project.id,
  } });
  await db.projectStaffPermission.create({ data: { projectId: f.project.id, identityId: f.staff.id, departments } });
  return role;
}

function createInput(f: Fixture, overrides: Partial<Parameters<typeof createGovernedOperatingSpace>[2]> = {}) {
  return { organizationId: f.org.id, key: 'new-scope', name: 'New scope', unitIds: [f.unit.id], ...overrides };
}
function memberInput(f: Fixture, overrides: Partial<Parameters<typeof updateGovernedOperatingMember>[3]> = {}) {
  return { identityId: f.staff.id, active: true, capabilities: ['manage_tasks'], expectedUpdatedAt: f.space.updatedAt.toISOString(), ...overrides };
}

// Compare complete persisted rows, not just counts: rejected writes must not
// consume the CAS version, change assignments or leave misleading audit facts.
async function governanceState() {
  return {
    spaces: await db.operatingSpace.findMany({ orderBy: { id: 'asc' } }),
    attachments: await db.operatingSpaceUnit.findMany({ orderBy: { id: 'asc' } }),
    members: await db.operatingSpaceMember.findMany({ orderBy: { id: 'asc' } }),
    audits: await db.auditLog.findMany({ orderBy: { id: 'asc' } }),
    roles: await db.roleAssignment.findMany({ orderBy: { id: 'asc' } }),
    permissions: await db.projectStaffPermission.findMany({ orderBy: [{ projectId: 'asc' }, { identityId: 'asc' }] }),
  };
}

function rejectAudit(action: string) {
  // Fault injection only at the audit boundary; all preceding service queries
  // and writes still execute in a real PostgreSQL interactive transaction.
  return db.$extends({ query: { auditLog: { async create({ args, query }) {
    if (args.data.action === action) throw new Error('TEST_AUDIT_UNAVAILABLE');
    return query(args);
  } } } }) as unknown as typeof db;
}

describe('Explicit operating-space creation: founder, canonical assets and atomic audit (AT27/AT28)', () => {
  beforeEach(resetDb);

  it('creates from an existing organization and explicit eligible units without creating legacy grants or physical inventory', async () => {
    const f = await fixture();
    const before = {
      organizations: await db.organization.count(), units: await db.unit.count(),
      identities: await db.identity.count(), roles: await db.roleAssignment.count(), permissions: await db.projectStaffPermission.count(),
    };
    const space = await createGovernedOperatingSpace(db, f.founder.id, createInput(f, { unitIds: [f.unit.id, f.sibling.id] }));
    expect(space).toMatchObject({ key: 'new-scope', name: 'New scope', organizationId: f.org.id, status: 'active' });
    const attachments = await db.operatingSpaceUnit.findMany({ where: { operatingSpaceId: space.id } });
    expect(attachments.map(u => u.unitId).sort()).toEqual([f.unit.id, f.sibling.id].sort());
    expect(attachments.every(u => u.active && u.startsOn <= new Date() && u.endsOn === null)).toBe(true);
    expect(await db.operatingSpaceMember.count({ where: { operatingSpaceId: space.id } })).toBe(0);
    expect({ organizations: await db.organization.count(), units: await db.unit.count(), identities: await db.identity.count(),
      roles: await db.roleAssignment.count(), permissions: await db.projectStaffPermission.count() }).toEqual(before);
    const audits = await db.auditLog.findMany({ where: { entityId: space.id }, orderBy: { action: 'asc' } });
    expect(audits.map(a => a.action)).toEqual(['operating_space:create', 'operating_space:scope']);
    expect(audits.every(a => a.actorIdentityId === f.founder.id && a.entityType === 'OperatingSpace')).toBe(true);
    expect(audits[0].data).toMatchObject({ organizationId: f.org.id, key: 'new-scope', unitIds: [f.unit.id, f.sibling.id] });
    expect(audits[1].data).toMatchObject({ before: [], afterUnitIds: [f.unit.id, f.sibling.id] });
  });


  it('creates a 39-unit resort atomically with bounded database round trips', async () => {
    const f = await fixture();
    const units = [f.unit, f.sibling];
    for (let i = 2; i < 39; i++) units.push(await createUnit({ projectId: f.project.id }));
    let calls = 0;
    // Real PostgreSQL queries with simulated remote round-trip latency.
    // The old per-unit locking/upsert path exceeds the transaction deadline.
    const remote = db.$extends({ query: { $allOperations: async ({ args, query }) => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 80));
      return query(args);
    } } }) as unknown as typeof db;
    const space = await createGovernedOperatingSpace(remote, f.founder.id, createInput(f, {
      key: 'resort-39', unitIds: units.map(u => u.id),
    }));
    expect(calls).toBeLessThanOrEqual(20);
    const attached = await db.operatingSpaceUnit.findMany({ where: { operatingSpaceId: space.id } });
    expect(attached.map(u => u.unitId).sort()).toEqual(units.map(u => u.id).sort());
    expect(attached.every(u => u.active && u.endsOn === null)).toBe(true);
    expect(await db.operatingSpaceMember.count({ where: { operatingSpaceId: space.id } })).toBe(0);
    expect((await db.auditLog.findMany({ where: { entityId: space.id } })).map(a => a.action).sort())
      .toEqual(['operating_space:create', 'operating_space:scope']);
  });

  it('bulk scope preserves active dates, reactivates inactive rows and creates only missing rows', async () => {
    const f = await fixture();
    const third = await createUnit({ projectId: f.project.id });
    const inactive = await db.operatingSpaceUnit.create({ data: {
      operatingSpaceId: f.space.id, unitId: f.sibling.id, active: false, startsOn: past(), endsOn: past(),
    } });
    await updateGovernedOperatingScope(db, f.founder.id, f.space.id, {
      unitIds: [f.unit.id, f.sibling.id, third.id], expectedUpdatedAt: f.space.updatedAt.toISOString(),
    });
    expect(await db.operatingSpaceUnit.findUnique({ where: { id: f.attachment.id } })).toEqual(f.attachment);
    const reactivated = await db.operatingSpaceUnit.findUniqueOrThrow({ where: { id: inactive.id } });
    expect(reactivated.active).toBe(true);
    expect(reactivated.endsOn).toBeNull();
    expect(reactivated.startsOn.getTime()).toBeGreaterThan(inactive.startsOn.getTime());
    expect(await db.operatingSpaceUnit.count({ where: { operatingSpaceId: f.space.id } })).toBe(3);
  });

  it('accepts an existing evidenced current management mandate without inventing a project operator relation', async () => {
    const f = await fixture();
    await db.projectOrganizationRole.delete({ where: { id: f.relation.id } });
    const evidence = await db.mediaAsset.create({ data: {
      storageKey: 'private:governance-mandate', kind: 'document', encrypted: true,
      mimeType: 'application/pdf', sizeBytes: 16, uploadedByIdentityId: f.founder.id,
    } });
    const engagement = await db.unitEngagement.create({ data: {
      unitId: f.unit.id, ownerIdentityId: f.founder.id, managementOrgId: f.org.id,
      engagementType: 'via_management_company', status: 'active', mandateMediaId: evidence.id,
      startsOn: past(), endsOn: future(),
    } });
    const space = await createGovernedOperatingSpace(db, f.founder.id, createInput(f));
    expect(await db.operatingSpaceUnit.count({ where: { operatingSpaceId: space.id, unitId: f.unit.id, active: true } })).toBe(1);
    expect(await db.unitEngagement.findUnique({ where: { id: engagement.id } })).toEqual(engagement);
    expect(await db.projectOrganizationRole.count()).toBe(0);
  });

  it.each(['non_founder', 'blocked_founder', 'invited_founder'] as const)('denies %s before persisting any governance or audit rows', async state => {
    const f = await fixture();
    if (state !== 'non_founder') await db.identity.update({ where: { id: f.founder.id }, data: { status: state === 'blocked_founder' ? 'blocked' : 'invited' } });
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, state === 'non_founder' ? f.staff.id : f.founder.id, createInput(f))).rejects.toMatchObject({ status: 403 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['missing', 'suspended'] as const)('rejects a %s organization with no partial space or audit', async state => {
    const f = await fixture();
    if (state === 'suspended') await db.organization.update({ where: { id: f.org.id }, data: { status: 'suspended' } });
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, f.founder.id, createInput(f, { organizationId: state === 'missing' ? 'missing-organization' : f.org.id })))
      .rejects.toMatchObject({ status: 400 });
    expect(await governanceState()).toEqual(before);
  });

  it('rolls back the new space when one of several selected units lacks current operating evidence', async () => {
    const f = await fixture();
    const foreignProject = await createProject();
    const foreignUnit = await createUnit({ projectId: foreignProject.id });
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, f.founder.id, createInput(f, { unitIds: [f.unit.id, foreignUnit.id] })))
      .rejects.toMatchObject({ status: 400 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['empty', 'duplicate', 'unknown', 'malformed'] as const)('rejects %s unit selection without implicit assignment', async kind => {
    const f = await fixture();
    const unitIds: unknown = kind === 'empty' ? [] : kind === 'duplicate' ? [f.unit.id, f.unit.id]
      : kind === 'unknown' ? ['unknown-unit'] : { all: true };
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, f.founder.id, createInput(f, { unitIds }))).rejects.toMatchObject({ status: 400 });
    expect(await governanceState()).toEqual(before);
  });

  it('rolls back both attachments and the earlier scope audit when the final creation audit fails', async () => {
    const f = await fixture();
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(rejectAudit('operating_space:create'), f.founder.id, createInput(f)))
      .rejects.toThrow('TEST_AUDIT_UNAVAILABLE');
    expect(await governanceState()).toEqual(before);
  });
});

describe('Governed scope CAS, overlap conflicts and atomic removals', () => {
  beforeEach(resetDb);

  it('requires the current version and leaves the winning scope and audit unchanged on a stale retry', async () => {
    const f = await fixture();
    const result = await updateGovernedOperatingScope(db, f.founder.id, f.space.id, {
      unitIds: [f.sibling.id], expectedUpdatedAt: f.space.updatedAt.toISOString(),
    });
    expect(result.updatedAt.getTime()).toBeGreaterThan(f.space.updatedAt.getTime());
    const removed = await db.operatingSpaceUnit.findUniqueOrThrow({ where: { id: f.attachment.id } });
    expect(removed.active).toBe(false);
    expect(removed.endsOn).not.toBeNull();
    const before = await governanceState();
    await expect(updateGovernedOperatingScope(db, f.founder.id, f.space.id, {
      unitIds: [f.unit.id], expectedUpdatedAt: f.space.updatedAt.toISOString(),
    })).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
    expect(before.audits).toHaveLength(1);
    expect(before.audits[0]).toMatchObject({ actorIdentityId: f.founder.id, action: 'operating_space:scope', entityId: f.space.id });
  });

  it('allows exactly one simultaneous scope update for the same expected version', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [f.unit.id], expectedUpdatedAt: f.space.updatedAt.toISOString() }),
      updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [f.sibling.id], expectedUpdatedAt: f.space.updatedAt.toISOString() }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected');
    expect(rejected).toMatchObject({ status: 'rejected', reason: { status: 409 } });
    const winner = results[0].status === 'fulfilled' ? f.unit.id : f.sibling.id;
    expect((await db.operatingSpaceUnit.findMany({ where: { operatingSpaceId: f.space.id, active: true } })).map(u => u.unitId)).toEqual([winner]);
    expect(await db.auditLog.count({ where: { entityId: f.space.id, action: 'operating_space:scope' } })).toBe(1);
  });

  it.each(['', 'not-a-date'] as const)('rejects invalid expected version %j without consuming a version', async expectedUpdatedAt => {
    const f = await fixture();
    const before = await governanceState();
    await expect(updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [], expectedUpdatedAt })).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('rolls back the version bump and every row when replacement scope has an ineligible unit', async () => {
    const f = await fixture();
    const before = await governanceState();
    await expect(updateGovernedOperatingScope(db, f.founder.id, f.space.id, {
      unitIds: [f.sibling.id, 'ineligible-unit'], expectedUpdatedAt: f.space.updatedAt.toISOString(),
    })).rejects.toMatchObject({ status: 400 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['future', 'expired'] as const)('refuses to silently reactivate a scheduled %s attachment and rolls back other removals', async state => {
    const f = await fixture();
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: f.space.id, unitId: f.sibling.id, startsOn: past() } });
    await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: state === 'future' ? { startsOn: future() } : { endsOn: past() } });
    const before = await governanceState();
    await expect(updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [f.unit.id], expectedUpdatedAt: f.space.updatedAt.toISOString() }))
      .rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('rejects attachment to another active organization even when both have verified operating evidence', async () => {
    const f = await fixture();
    const other = await db.organization.create({ data: { name: 'Competing operator', orgType: 'management_company', contactEmail: 'competing@example.test', contactPhone: '+66000000001' } });
    await db.projectOrganizationRole.create({ data: { projectId: f.project.id, organizationId: other.id, roleKey: 'operator', provenance: 'verified' } });
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, f.founder.id, createInput(f, { organizationId: other.id }))).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('rejects an open-ended attachment that would overlap another organization’s future active assignment', async () => {
    const f = await fixture();
    await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: { startsOn: future() } });
    const other = await db.organization.create({ data: { name: 'Future competing operator', orgType: 'management_company', contactEmail: 'future@example.test', contactPhone: '+66000000001' } });
    await db.projectOrganizationRole.create({ data: { projectId: f.project.id, organizationId: other.id, roleKey: 'operator', provenance: 'verified' } });
    const before = await governanceState();
    await expect(createGovernedOperatingSpace(db, f.founder.id, createInput(f, { organizationId: other.id })))
      .rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('serializes concurrent cross-organization claims so only one space and its two audits commit', async () => {
    const f = await fixture();
    await db.operatingSpaceUnit.delete({ where: { id: f.attachment.id } });
    const other = await db.organization.create({ data: { name: 'Concurrent operator', orgType: 'management_company', contactEmail: 'concurrent@example.test', contactPhone: '+66000000001' } });
    await db.projectOrganizationRole.create({ data: { projectId: f.project.id, organizationId: other.id, roleKey: 'operator', provenance: 'verified' } });
    const results = await Promise.allSettled([
      createGovernedOperatingSpace(db, f.founder.id, createInput(f, { key: 'first-claim' })),
      createGovernedOperatingSpace(db, f.founder.id, createInput(f, { key: 'other-claim', organizationId: other.id })),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ status: 'rejected', reason: { status: 409 } });
    expect(await db.operatingSpace.count({ where: { key: { in: ['first-claim', 'other-claim'] } } })).toBe(1);
    expect(await db.operatingSpaceUnit.count({ where: { unitId: f.unit.id, active: true } })).toBe(1);
    expect((await db.auditLog.findMany()).map(a => a.action).sort()).toEqual(['operating_space:create', 'operating_space:scope']);
  });

  it('an explicit removal immediately denies a formerly authorized known task without changing historical task rows', async () => {
    const f = await fixture();
    await staffGrant(f);
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.staff.id, capabilities: ['manage_tasks'] } });
    const task = await db.operationalTask.create({ data: { projectId: f.project.id, unitId: f.unit.id, operatingSpaceId: f.space.id, taskType: 'custom', dueAt: future() } });
    await expect(assertOperationalTaskAccess(db, f.staff.id, task)).resolves.toBeUndefined();
    await updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [], expectedUpdatedAt: f.space.updatedAt.toISOString() });
    await expect(assertOperationalTaskAccess(db, f.staff.id, task)).rejects.toMatchObject({ status: 403 });
    expect(await db.operationalTask.findUnique({ where: { id: task.id } })).toEqual(task);
  });

  it('rolls back scope removals, version and audit when scope audit persistence fails', async () => {
    const f = await fixture();
    const before = await governanceState();
    await expect(updateGovernedOperatingScope(rejectAudit('operating_space:scope'), f.founder.id, f.space.id, {
      unitIds: [f.sibling.id], expectedUpdatedAt: f.space.updatedAt.toISOString(),
    })).rejects.toThrow('TEST_AUDIT_UNAVAILABLE');
    expect(await governanceState()).toEqual(before);
  });
});

describe('Governed staff capabilities never manufacture legacy authority', () => {
  beforeEach(resetDb);

  it('adds explicit capabilities only for an existing effective staff grant and audits the decision', async () => {
    const f = await fixture();
    await staffGrant(f);
    const before = await governanceState();
    const member = await updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f));
    expect(member).toMatchObject({ active: true, capabilities: ['manage_tasks'], effectiveUnits: { manage_tasks: 1 } });
    expect((await getScopedOperationalAccess(db, f.staff.id, f.space.id, 'manage_tasks', TASK_DEPARTMENTS)).unitIds).toEqual([f.unit.id]);
    const after = await governanceState();
    expect(after.roles).toEqual(before.roles);
    expect(after.permissions).toEqual(before.permissions);
    expect(after.attachments).toEqual(before.attachments);
    expect(after.audits).toHaveLength(1);
    expect(after.audits[0]).toMatchObject({ action: 'operating_space:member', actorIdentityId: f.founder.id, entityType: 'OperatingSpaceMember', entityId: member.id });
    expect(after.audits[0].data).toMatchObject({ operatingSpaceId: f.space.id, identityId: f.staff.id, before: null, after: { active: true, capabilities: ['manage_tasks'] }, effectiveUnits: { manage_tasks: 1 } });
  });

  it.each(['no_role', 'wrong_department', 'expired_relation', 'future_attachment', 'expired_attachment'] as const)('rejects %s instead of manufacturing a grant, and rolls back the CAS version', async state => {
    const f = await fixture();
    if (state !== 'no_role') await staffGrant(f, state === 'wrong_department' ? ['finance'] : ['housekeeping']);
    if (state === 'expired_relation') await db.projectOrganizationRole.update({ where: { id: f.relation.id }, data: { effectiveTo: past() } });
    if (state === 'future_attachment' || state === 'expired_attachment') await db.operatingSpaceUnit.update({ where: { id: f.attachment.id }, data: state === 'future_attachment' ? { startsOn: future() } : { endsOn: past() } });
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f))).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['blocked_identity', 'missing_identity', 'suspended_organization', 'empty_capabilities', 'unknown_capability'] as const)('rejects %s without a member or audit write', async state => {
    const f = await fixture();
    await staffGrant(f);
    if (state === 'blocked_identity') await db.identity.update({ where: { id: f.staff.id }, data: { status: 'blocked' } });
    if (state === 'suspended_organization') await db.organization.update({ where: { id: f.org.id }, data: { status: 'suspended' } });
    const input = memberInput(f, state === 'missing_identity' ? { identityId: 'missing-identity' }
      : state === 'empty_capabilities' ? { capabilities: [] }
      : state === 'unknown_capability' ? { capabilities: ['grant_everything'] } : {});
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, input)).rejects.toMatchObject({ status: 400 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['scope', 'member'] as const)('reloads founder status for every %s edit', async kind => {
    const f = await fixture();
    await staffGrant(f);
    await db.identity.update({ where: { id: f.founder.id }, data: { status: 'blocked' } });
    const before = await governanceState();
    const write = kind === 'scope'
      ? updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [f.sibling.id], expectedUpdatedAt: f.space.updatedAt.toISOString() })
      : updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f));
    await expect(write).rejects.toMatchObject({ status: 403 });
    expect(await governanceState()).toEqual(before);
  });

  it.each(['missing', 'archived'] as const)('rejects member updates to a %s space', async state => {
    const f = await fixture();
    await staffGrant(f);
    if (state === 'archived') await db.operatingSpace.update({ where: { id: f.space.id }, data: { status: 'archived' } });
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, state === 'missing' ? 'unknown-space' : f.space.id, memberInput(f)))
      .rejects.toMatchObject({ status: 404 });
    expect(await governanceState()).toEqual(before);
  });

  it('requires every requested capability to have effective departmental unit access', async () => {
    const f = await fixture();
    await staffGrant(f, ['housekeeping']);
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f, { capabilities: ['manage_tasks', 'manage_maintenance'] })))
      .rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('uses one CAS version across scope and member edits so a stale member save cannot revive authority', async () => {
    const f = await fixture();
    await staffGrant(f);
    await updateGovernedOperatingScope(db, f.founder.id, f.space.id, { unitIds: [], expectedUpdatedAt: f.space.updatedAt.toISOString() });
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f))).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });

  it('deactivates a blocked existing member and revokes access without changing the legacy role', async () => {
    const f = await fixture();
    await staffGrant(f);
    const existing = await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.staff.id, capabilities: ['manage_tasks'] } });
    await db.identity.update({ where: { id: f.staff.id }, data: { status: 'blocked' } });
    const before = await governanceState();
    const member = await updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f, { active: false, capabilities: [] }));
    expect(member).toMatchObject({ id: existing.id, active: false, capabilities: [] });
    const after = await governanceState();
    expect(after.roles).toEqual(before.roles);
    expect(after.permissions).toEqual(before.permissions);
    expect(after.audits).toHaveLength(1);
  });

  it('rolls back member insertion and CAS when the member audit fails', async () => {
    const f = await fixture();
    await staffGrant(f);
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(rejectAudit('operating_space:member'), f.founder.id, f.space.id, memberInput(f)))
      .rejects.toThrow('TEST_AUDIT_UNAVAILABLE');
    expect(await governanceState()).toEqual(before);
  });
});

describe('Daily-task setup does not promise unsupported delegation', () => {
  beforeEach(resetDb);
  it.each(['view_calendar', 'manage_reservations', 'manage_pricing', 'manage_availability', 'view_finance', 'record_expense', 'generate_owner_report', 'manage_team', 'manage_channels'])('rejects a new %s grant atomically', async capability => {
    const f = await fixture();
    await staffGrant(f, ['housekeeping', 'maintenance', 'front_desk', 'reservations', 'pricing', 'finance', 'channels']);
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f, { capabilities: [capability] }))).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });
  it('preserves already-active valid capabilities when adding an explicit daily-task capability', async () => {
    const f = await fixture();
    await staffGrant(f, ['housekeeping', 'finance']);
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.staff.id, capabilities: ['view_finance'] } });
    const result = await updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f, { capabilities: ['view_finance', 'manage_tasks'] }));
    expect(result.capabilities).toEqual(['view_finance', 'manage_tasks']);
  });
  it('permits explicit removal of unsupported existing capabilities without changing independent roles', async () => {
    const f = await fixture();
    await staffGrant(f);
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.staff.id, capabilities: ['manage_tasks', 'manage_reservations'] } });
    const roles = await db.roleAssignment.findMany();
    const result = await updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f));
    expect(result.capabilities).toEqual(['manage_tasks']);
    expect(await db.roleAssignment.findMany()).toEqual(roles);
  });
  it('does not reactivate an unsupported grant through old inactive membership history', async () => {
    const f = await fixture();
    await staffGrant(f, ['finance']);
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.staff.id, active: false, capabilities: ['view_finance'] } });
    const before = await governanceState();
    await expect(updateGovernedOperatingMember(db, f.founder.id, f.space.id, memberInput(f, { capabilities: ['view_finance'] }))).rejects.toMatchObject({ status: 409 });
    expect(await governanceState()).toEqual(before);
  });
});
