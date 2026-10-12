import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, createOrganization, createProject, createRoleAssignment, createUnit, db, resetDb } from '@/test/util';

vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));

import { getInquiryThreadRecipients, synchronizeInquiryParticipant } from './inquiry-thread-access';
import { canAccessThread } from './statement-thread-access';

describe('inquiry access against canonical role and mandate rows', () => {
  beforeEach(resetDb);

  it('resolves a newly created scoped role within the same intake transaction', async () => {
    const project = await createProject();
    const manager = await createIdentity();
    const recipients = await db.$transaction(async tx => {
      await tx.roleAssignment.create({ data: {
        identityId: manager.id, role: 'staff_ops', scopeType: 'project', projectId: project.id,
      } });
      return getInquiryThreadRecipients(tx, { projectId: project.id });
    });
    expect(recipients.participantRoles).toEqual({ [manager.id]: 'staff_ops' });
  });

  it('isolates property/unit staff and configured departments without changing role grants', async () => {
    const project = await createProject();
    const otherProject = await createProject();
    const unit = await createUnit({ projectId: project.id });
    const otherUnit = await createUnit({ projectId: project.id });
    const admin = await createIdentity({ isAdmin: true });
    const manager = await createIdentity();
    const unitHost = await createIdentity();
    const finance = await createIdentity();
    const foreignUnit = await createIdentity();
    const foreignProject = await createIdentity();
    const revoked = await createIdentity();
    const blocked = await createIdentity({ status: 'blocked' });
    for (const identityId of [manager.id, finance.id, revoked.id, blocked.id]) {
      await createRoleAssignment({ identityId, role: 'staff_ops', scopeType: 'project', projectId: project.id, status: identityId === revoked.id ? 'revoked' : 'active' });
    }
    await createRoleAssignment({ identityId: unitHost.id, role: 'onsite_host', scopeType: 'unit', projectId: project.id, unitId: unit.id });
    await createRoleAssignment({ identityId: foreignUnit.id, role: 'staff_ops', scopeType: 'unit', projectId: project.id, unitId: otherUnit.id });
    await createRoleAssignment({ identityId: foreignProject.id, role: 'staff_ops', scopeType: 'project', projectId: otherProject.id });
    await db.projectStaffPermission.createMany({ data: [
      { identityId: manager.id, projectId: project.id, departments: ['reservations'] },
      { identityId: finance.id, projectId: project.id, departments: ['finance'] },
    ] });
    const rolesBefore = await db.roleAssignment.count();
    const unitAudience = await getInquiryThreadRecipients(db, { projectId: project.id, unitId: unit.id });
    expect(unitAudience.participantIdentityIds.sort()).toEqual([admin.id, manager.id, unitHost.id].sort());
    expect((await getInquiryThreadRecipients(db, { projectId: project.id })).participantIdentityIds.sort()).toEqual([admin.id, manager.id].sort());
    expect((await getInquiryThreadRecipients(db, {})).participantIdentityIds).toEqual([admin.id]);
    expect(await db.roleAssignment.count()).toBe(rolesBefore);
  });

  it('revokes persisted MC access on mandate end, organization suspension or role revocation', async () => {
    const project = await createProject();
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const organization = await createOrganization('Inquiry MC', project.id);
    const otherOrganization = await createOrganization('Other inquiry MC', project.id);
    const manager = await createIdentity();
    const outsider = await createIdentity();
    const guest = await createIdentity();
    const managerRole = await db.roleAssignment.create({ data: {
      identityId: manager.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: organization.id,
    } });
    await db.roleAssignment.create({ data: {
      identityId: outsider.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: otherOrganization.id,
    } });
    const engagement = await db.unitEngagement.create({ data: {
      unitId: unit.id, ownerIdentityId: owner.id, managementOrgId: organization.id,
      engagementType: 'via_management_company', status: 'active',
    } });
    const opportunity = await db.crmOpportunity.create({ data: {
      identityId: guest.id, projectId: project.id, unitId: unit.id, type: 'rental', title: 'Inquiry access fixture', source: 'test',
    } });
    const threadId = crypto.randomUUID();
    await db.thread.create({ data: {
      id: threadId, contextType: 'general', contextId: `lead-${opportunity.id}:${threadId}`, projectId: project.id,
      participants: { create: [
        { identityId: guest.id, participantRole: 'inquirer' },
        { identityId: manager.id, participantRole: 'mc_member' },
        { identityId: outsider.id, participantRole: 'mc_member' },
      ] },
    } });
    expect(await canAccessThread(db, threadId, manager.id)).toBe(true);
    expect(await canAccessThread(db, threadId, outsider.id)).toBe(false);
    await db.unitEngagement.update({ where: { id: engagement.id }, data: { status: 'ended' } });
    expect(await canAccessThread(db, threadId, manager.id)).toBe(false);
    await db.unitEngagement.update({ where: { id: engagement.id }, data: { status: 'active' } });
    await db.organization.update({ where: { id: organization.id }, data: { status: 'suspended' } });
    expect(await canAccessThread(db, threadId, manager.id)).toBe(false);
    await db.organization.update({ where: { id: organization.id }, data: { status: 'active' } });
    await db.roleAssignment.update({ where: { id: managerRole.id }, data: { status: 'revoked' } });
    expect(await canAccessThread(db, threadId, manager.id)).toBe(false);
    expect(await canAccessThread(db, threadId, guest.id)).toBe(true);

    const replacement = await createIdentity();
    await db.roleAssignment.create({ data: {
      identityId: replacement.id, role: 'mc_member', scopeType: 'project', projectId: project.id, organizationId: organization.id,
    } });
    expect(await db.threadParticipant.count({ where: { threadId, identityId: replacement.id } })).toBe(0);
    await synchronizeInquiryParticipant(db, replacement.id);
    expect(await db.threadParticipant.count({ where: { threadId, identityId: replacement.id } })).toBe(1);
    expect(await canAccessThread(db, threadId, replacement.id)).toBe(true);
    expect(await canAccessThread(db, threadId, manager.id)).toBe(false);
  });
});
