import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { setCrmAccountOwner } from './account-ownership.service';

describe('CRM account ownership', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('assigns an active internal operator and writes an audit record', async () => {
    const contact = await createIdentity();
    const operator = await createIdentity();
    const admin = await createIdentity({ isAdmin: true });

    await db.roleAssignment.create({
      data: {
        identityId: operator.id,
        role: 'staff_ops',
        scopeType: 'platform',
        status: 'active',
        grantedByIdentityId: admin.id,
      },
    });

    const profile = await db.crmProfile.create({ data: { identityId: contact.id } });

    const updated = await setCrmAccountOwner(db, {
      profileId: profile.id,
      accountOwnerIdentityId: operator.id,
      changedByIdentityId: admin.id,
    });

    expect(updated.accountOwnerIdentityId).toBe(operator.id);
    const audit = await db.auditLog.findFirst({
      where: { entityType: 'crm_profile', entityId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.action).toBe('crm.account_owner_assigned');
  });

  it('refuses to assign an unrelated customer identity as account owner', async () => {
    const contact = await createIdentity();
    const unrelated = await createIdentity();
    const admin = await createIdentity({ isAdmin: true });
    const profile = await db.crmProfile.create({ data: { identityId: contact.id } });

    await expect(
      setCrmAccountOwner(db, {
        profileId: profile.id,
        accountOwnerIdentityId: unrelated.id,
        changedByIdentityId: admin.id,
      })
    ).rejects.toThrow('Account owner must be an active internal operator');
  });
});
