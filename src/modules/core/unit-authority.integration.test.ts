import { beforeEach, describe, expect, it } from 'vitest';
import {
  createIdentity,
  createOrganization,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import {
  canWriteUnitCommercial,
  resolveUnitCommercialAuthority,
} from './unit-authority';

describe('unit commercial authority', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lets a verified owner operate an owner-direct unit', async () => {
    const owner = await createIdentity();
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    await createRoleAssignment({
      identityId: owner.id,
      role: 'owner',
      scopeType: 'unit',
      unitId: unit.id,
    });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'owner_direct',
        status: 'active',
      },
    });

    const authority = await resolveUnitCommercialAuthority(db, unit.id);
    expect(authority?.mode).toBe('owner');
    await expect(
      canWriteUnitCommercial(db, owner, unit.id, project.id)
    ).resolves.toBe(true);
  });

  it('keeps an owner read-only while myUNO is the active operator', async () => {
    const owner = await createIdentity();
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    await createRoleAssignment({
      identityId: owner.id,
      role: 'owner',
      scopeType: 'unit',
      unitId: unit.id,
    });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'direct_managed',
        status: 'active',
      },
    });

    await expect(
      canWriteUnitCommercial(db, owner, unit.id, project.id)
    ).resolves.toBe(false);
  });

  it('requires the active management organization for MC writes', async () => {
    const owner = await createIdentity();
    const member = await createIdentity();
    const wrongMember = await createIdentity();
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const org = await createOrganization('Managing MC', project.id);
    const wrongOrg = await createOrganization('Other MC', project.id);

    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: org.id,
        status: 'active',
      },
    });

    await db.roleAssignment.create({
      data: {
        identityId: member.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: org.id,
        status: 'active',
      },
    });
    await db.roleAssignment.create({
      data: {
        identityId: wrongMember.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: wrongOrg.id,
        status: 'active',
      },
    });

    await expect(
      canWriteUnitCommercial(db, member, unit.id, project.id)
    ).resolves.toBe(true);
    await expect(
      canWriteUnitCommercial(db, wrongMember, unit.id, project.id)
    ).resolves.toBe(false);
  });
});
