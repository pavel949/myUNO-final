import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { grantRole } from './people.service';
import { can } from './permissions';

let fixtures: typeof import('@/test/util');

describe('content contributor assignments against the migrated test database', () => {
  beforeAll(async () => {
    // This suite is deliberately narrower than the shared fixture guard. Never
    // run destructive resetDb() against a hosted or production database.
    const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://missing');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname) ||
        !/(?:^|[_-])test(?:[_-]|$)/i.test(url.pathname.slice(1))) {
      throw new Error('Content contributor integration tests require a local dedicated test database');
    }
    fixtures = await import('@/test/util');
  });
  beforeEach(async () => { await fixtures.resetDb(); });

  async function setup() {
    const { db, createIdentity, createProject, createUnit } = fixtures;
    const founder = await createIdentity({ isAdmin: true });
    const contributor = await createIdentity();
    const project = await createProject();
    const otherProject = await createProject();
    const unit = await createUnit({ projectId: project.id });
    return { db, founder, contributor, project, otherProject, unit, input: {
      identityId: contributor.id, grantedByIdentityId: founder.id,
      role: 'content_contributor' as const, scopeType: 'unit' as const,
      projectId: project.id, unitId: unit.id,
    } };
  }

  it('persists exact unit and shared-content assignments without ownership or operational permissions', async () => {
    const { db, contributor, project, unit, input } = await setup();
    await grantRole(db, input);
    await grantRole(db, { ...input, scopeType: 'project', unitId: undefined });
    expect(await db.roleAssignment.count({ where: { identityId: contributor.id } })).toBe(2);
    expect((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).ownerIdentityId).toBeNull();
    expect(await db.projectStaffPermission.count({ where: { identityId: contributor.id } })).toBe(0);
    for (const action of ['units:edit_listing', 'units:manage_availability_and_pricing', 'projects:edit_and_set_live', 'people:edit']) {
      expect(await can({ identity: contributor, action, requiredAccess: 'allow', resource: { projectId: project.id, unitId: unit.id } }, db)).toBe(false);
    }
  });

  it('blocks platform, organization, and cross-project assignment attempts before writing', async () => {
    const { db, otherProject, input } = await setup();
    await expect(grantRole(db, { ...input, scopeType: 'platform', projectId: undefined, unitId: undefined })).rejects.toThrow();
    await expect(grantRole(db, { ...input, organizationId: 'unrelated-organization' })).rejects.toThrow();
    await expect(grantRole(db, { ...input, projectId: otherProject.id })).rejects.toThrow(/does not belong/);
    expect(await db.roleAssignment.count({ where: { identityId: input.identityId } })).toBe(0);
  });

  it('enforces the contributor scope constraint and existing project/unit trigger on direct writes', async () => {
    const { db, otherProject, input } = await setup();
    await expect(db.roleAssignment.create({ data: {
      ...input, scopeType: 'platform', projectId: null, unitId: null,
    } })).rejects.toThrow();
    await expect(db.roleAssignment.create({ data: { ...input, projectId: otherProject.id } })).rejects.toThrow();
    await expect(db.roleAssignment.create({ data: { ...input, scopeType: 'project' } })).rejects.toThrow();
  });

  it('reactivates one exact assignment without changing a separate unit grant', async () => {
    const { db, unit, project, input } = await setup();
    const otherUnit = await fixtures.createUnit({ projectId: project.id });
    const first = await grantRole(db, input);
    await grantRole(db, { ...input, unitId: otherUnit.id });
    await db.roleAssignment.update({ where: { id: first.id }, data: { status: 'revoked' } });
    expect((await grantRole(db, input)).id).toBe(first.id);
    expect(await db.roleAssignment.count({ where: { identityId: input.identityId, unitId: unit.id } })).toBe(1);
    expect(await db.roleAssignment.count({ where: { identityId: input.identityId, status: 'active' } })).toBe(2);
  });
});
