import { beforeEach, describe, expect, it } from 'vitest';
import { createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { submissionUnitWhere } from './submission-unit-access';

// Actual Prisma relation predicates, not mocked permission booleans. Requires
// an explicitly verified disposable DATABASE_URL_TEST before execution.
describe('property submission private inventory scope', () => {
  beforeEach(resetDb);

  it('returns an owner’s exact draft and public units, not unrelated drafts or stale ownership', async () => {
    const owner = await createIdentity();
    const other = await createIdentity();
    const project = await createProject({ status: 'live' });
    const own = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, status: 'draft' });
    const stale = await createUnit({ projectId: project.id, ownerIdentityId: other.id, status: 'draft' });
    const foreign = await createUnit({ projectId: project.id, ownerIdentityId: other.id, status: 'draft' });
    const live = await createUnit({ projectId: project.id, status: 'live' });
    for (const unit of [own, stale]) await db.roleAssignment.create({ data: {
      identityId: owner.id, role: 'owner', scopeType: 'unit', projectId: project.id, unitId: unit.id,
    } });
    const user = { identityId: owner.id, isAdmin: false };
    const rows = await db.unit.findMany({ where: submissionUnitWhere(user, project.id), select: { id: true } });
    expect(rows.map(row => row.id).sort()).toEqual([own.id, live.id].sort());
    expect(await db.unit.findFirst({ where: { ...submissionUnitWhere(user, project.id), id: foreign.id } })).toBeNull();
    const adminRows = await db.unit.findMany({ where: submissionUnitWhere({ ...user, isAdmin: true }, project.id) });
    expect(adminRows).toHaveLength(4);
  });

  it('requires a current MC mandate for the correct active organization and project', async () => {
    const member = await createIdentity();
    const owner = await createIdentity();
    const project = await createProject({ status: 'draft' });
    const org = await db.organization.create({ data: {
      name: 'Authorized manager', orgType: 'management_company', projectId: project.id,
      contactEmail: 'manager@example.test', contactPhone: '000',
    } });
    await db.roleAssignment.create({ data: {
      identityId: member.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: org.id,
    } });
    const now = new Date('2026-10-10T00:00:00Z');
    const entries = [
      { name: 'Current', startsOn: null, endsOn: null },
      { name: 'Expired', startsOn: null, endsOn: now },
      { name: 'Future', startsOn: new Date('2026-10-11T00:00:00Z'), endsOn: null },
    ];
    const ids: string[] = [];
    for (const entry of entries) {
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, name: entry.name, status: 'draft' });
      ids.push(unit.id);
      await db.unitEngagement.create({ data: {
        unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'via_management_company',
        managementOrgId: org.id, status: 'active', startsOn: entry.startsOn, endsOn: entry.endsOn,
      } });
    }
    await createUnit({ projectId: project.id, name: 'Unmanaged draft', status: 'draft' });
    const where = submissionUnitWhere({ identityId: member.id, isAdmin: false }, project.id, now);
    expect((await db.unit.findMany({ where })).map(unit => unit.id)).toEqual([ids[0]]);
    await db.organization.update({ where: { id: org.id }, data: { status: 'suspended' } });
    expect(await db.unit.findMany({ where })).toEqual([]);
    await db.organization.update({ where: { id: org.id }, data: { status: 'active' } });
    await db.roleAssignment.updateMany({ where: { identityId: member.id }, data: { status: 'revoked' } });
    expect(await db.unit.findMany({ where })).toEqual([]);
  });
});
