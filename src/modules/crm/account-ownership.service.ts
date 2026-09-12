import { PrismaClient } from '@prisma/client';

/**
 * Assign or clear the internal owner of a CRM profile.
 *
 * Account ownership is operational responsibility, not lifecycle identity.
 * The target must be an active admin or hold an active internal operating role.
 * Every change writes the append-only audit log in the same transaction.
 */
export async function setCrmAccountOwner(
  db: PrismaClient,
  input: {
    profileId: string;
    accountOwnerIdentityId: string | null;
    changedByIdentityId: string;
  }
) {
  const profile = await db.crmProfile.findUnique({
    where: { id: input.profileId },
    select: { id: true, identityId: true, accountOwnerIdentityId: true },
  });
  if (!profile) throw new Error('CRM profile not found');

  if (input.accountOwnerIdentityId) {
    const target = await db.identity.findUnique({
      where: { id: input.accountOwnerIdentityId },
      select: {
        id: true,
        status: true,
        isAdmin: true,
        roleAssignments: {
          where: { status: 'active', role: { in: ['staff_ops', 'onsite_host', 'mc_member'] } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!target || target.status !== 'active') {
      throw new Error('Account owner identity is not active');
    }
    if (!target.isAdmin && target.roleAssignments.length === 0) {
      throw new Error('Account owner must be an active internal operator');
    }
  }

  if (profile.accountOwnerIdentityId === input.accountOwnerIdentityId) {
    return profile;
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.crmProfile.update({
      where: { id: profile.id },
      data: { accountOwnerIdentityId: input.accountOwnerIdentityId },
      select: { id: true, identityId: true, accountOwnerIdentityId: true, updatedAt: true },
    });

    await tx.auditLog.create({
      data: {
        actorIdentityId: input.changedByIdentityId,
        action: input.accountOwnerIdentityId ? 'crm.account_owner_assigned' : 'crm.account_owner_cleared',
        entityType: 'crm_profile',
        entityId: profile.id,
        data: {
          previous_account_owner_identity_id: profile.accountOwnerIdentityId,
          new_account_owner_identity_id: input.accountOwnerIdentityId,
          contact_identity_id: profile.identityId,
        },
      },
    });

    return updated;
  });
}
