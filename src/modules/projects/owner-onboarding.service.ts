import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface OnboardUnitOwnerInput {
  unitId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLocale?: string;
  effectiveFrom?: Date;
  note?: string;
  recordedByIdentityId: string;
}

function asDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * F11: one safe owner onboarding command.
 *
 * Exact normalized email resolution is canonical. If no identity exists we
 * create an invited identity, record ownership, grant the unit-scoped owner
 * role and issue a claim token in one transaction. Existing active identities
 * are never downgraded or issued an unusable claim token.
 */
export async function onboardUnitOwner(db: PrismaClient, input: OnboardUnitOwnerInput) {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!email.includes('@')) throw new Error('A valid owner email is required');
  if (!firstName || !lastName) throw new Error('Owner first and last name are required');
  const effectiveFrom = asDate(input.effectiveFrom ?? new Date());
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await db.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, projectId: true, ownerIdentityId: true },
    });
    if (!unit) throw new Error('Unit not found');

    let identity = await tx.identity.findUnique({ where: { email } });
    let created = false;
    if (!identity) {
      identity = await tx.identity.create({
        data: {
          email,
          firstName,
          lastName,
          ...(input.phone ? { phone: input.phone.trim() } : {}),
          preferredLocale: input.preferredLocale || 'en',
          status: 'invited',
        },
      });
      created = true;
    }

    const open = await tx.ownershipPeriod.findFirst({
      where: { unitId: unit.id, endsOn: null },
      orderBy: { startsOn: 'desc' },
    });
    let ownershipChanged = false;
    if (unit.ownerIdentityId !== identity.id) {
      if (open) {
        if (effectiveFrom < open.startsOn) {
          throw new Error('Ownership cannot start before the period it replaces');
        }
        await tx.ownershipPeriod.update({
          where: { id: open.id },
          data: { endsOn: effectiveFrom },
        });
      }
      await tx.ownershipPeriod.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: identity.id,
          startsOn: effectiveFrom,
          note: input.note,
          recordedByIdentityId: input.recordedByIdentityId,
        },
      });
      await tx.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: identity.id },
      });
      ownershipChanged = true;
    }

    const existingRole = await tx.roleAssignment.findFirst({
      where: {
        identityId: identity.id,
        role: 'owner',
        scopeType: 'unit',
        projectId: unit.projectId,
        unitId: unit.id,
      },
    });
    if (existingRole) {
      await tx.roleAssignment.update({
        where: { id: existingRole.id },
        data: { status: 'active', grantedByIdentityId: input.recordedByIdentityId },
      });
    } else {
      await tx.roleAssignment.create({
        data: {
          identityId: identity.id,
          role: 'owner',
          scopeType: 'unit',
          projectId: unit.projectId,
          unitId: unit.id,
          status: 'active',
          grantedByIdentityId: input.recordedByIdentityId,
        },
      });
    }

    let claimToken: string | null = null;
    if (identity.status === 'invited') {
      await tx.oneTimeToken.updateMany({
        where: { identityId: identity.id, purpose: 'account_claim', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.oneTimeToken.create({
        data: {
          identityId: identity.id,
          purpose: 'account_claim',
          tokenHash,
          expiresAt: tokenExpiresAt,
        },
      });
      claimToken = rawToken;
    }

    return {
      identity: {
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        status: identity.status,
      },
      created,
      ownershipChanged,
      projectId: unit.projectId,
      claimToken,
      claimExpiresAt: claimToken ? tokenExpiresAt : null,
    };
  });

  return result;
}
