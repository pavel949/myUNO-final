import { PrismaClient, UnitEngagementType, UnitEngagementStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateUnitEngagementInput {
  unitId: string;
  engagementType: UnitEngagementType;
  ownerIdentityId: string;
  noiCapAnnualThb?: number;
  feeOverridePct?: number;
  setupFeeThb?: number;
  mandateMediaId?: string;
  managementOrgId?: string;
}

export interface UpdateUnitEngagementInput {
  status?: UnitEngagementStatus;
  noiCapAnnualThb?: number;
  feeOverridePct?: number;
  setupFeeThb?: number;
  mandateMediaId?: string;
  startsOn?: Date;
  endsOn?: Date;
}

/**
 * Create a unit engagement (mandate record).
 * For direct-managed units, noiCapAnnualThb is REQUIRED (no default).
 * Validates that the owner identity exists.
 */
export async function createUnitEngagement(
  db: PrismaClient,
  input: CreateUnitEngagementInput
): Promise<{ id: string }> {
  const { unitId, engagementType, ownerIdentityId, noiCapAnnualThb, feeOverridePct, setupFeeThb, mandateMediaId, managementOrgId } = input;

  // Verify unit exists
  const unit = await db.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  // Verify owner identity exists
  const owner = await db.identity.findUnique({
    where: { id: ownerIdentityId },
  });

  if (!owner) {
    throw new Error(`Owner identity ${ownerIdentityId} not found`);
  }

  // Validate: direct-managed requires noiCapAnnualThb
  if (engagementType === 'direct_managed' && !noiCapAnnualThb) {
    throw new Error('NOI cap is required for direct-managed engagement');
  }

  // If via_management_company, verify management org exists
  if (engagementType === 'via_management_company' && managementOrgId) {
    const org = await db.organization.findUnique({
      where: { id: managementOrgId },
    });

    if (!org) {
      throw new Error(`Management organization ${managementOrgId} not found`);
    }
  }

  const engagement = await db.unitEngagement.create({
    data: {
      unitId,
      engagementType,
      ownerIdentityId,
      noiCapAnnualThb,
      feeOverridePct: feeOverridePct ? new Decimal(feeOverridePct) : undefined,
      setupFeeThb,
      mandateMediaId,
      managementOrgId,
      status: 'draft',
    },
  });

  return { id: engagement.id };
}

/**
 * Update a unit engagement.
 * If transitioning to active, validates that mandateMediaId is present.
 */
export async function updateUnitEngagement(
  db: PrismaClient,
  engagementId: string,
  input: UpdateUnitEngagementInput
): Promise<void> {
  const { status, noiCapAnnualThb, feeOverridePct, setupFeeThb, mandateMediaId, startsOn, endsOn } = input;

  const engagement = await db.unitEngagement.findUnique({
    where: { id: engagementId },
  });

  if (!engagement) {
    throw new Error(`UnitEngagement ${engagementId} not found`);
  }

  // If transitioning to active, ensure mandate media is present
  if (status === 'active' && !engagement.mandateMediaId && !mandateMediaId) {
    throw new Error('Mandate document is required to activate engagement');
  }

  // If engagement is direct-managed and noiCapAnnualThb is being set, validate it
  if (engagement.engagementType === 'direct_managed' && noiCapAnnualThb !== undefined && !noiCapAnnualThb) {
    throw new Error('NOI cap cannot be removed from direct-managed engagement');
  }

  await db.unitEngagement.update({
    where: { id: engagementId },
    data: {
      status,
      noiCapAnnualThb,
      feeOverridePct: feeOverridePct !== undefined ? new Decimal(feeOverridePct) : undefined,
      setupFeeThb,
      mandateMediaId,
      startsOn,
      endsOn,
    },
  });
}

/**
 * Get a unit engagement with full details.
 */
export async function getUnitEngagement(
  db: PrismaClient,
  engagementId: string
): Promise<any> {
  const engagement = await db.unitEngagement.findUnique({
    where: { id: engagementId },
    include: {
      unit: true,
      owner: true,
      managementOrg: true,
    },
  });

  if (!engagement) {
    throw new Error(`UnitEngagement ${engagementId} not found`);
  }

  return engagement;
}

/**
 * Get the active engagement for a unit.
 */
export async function getActiveEngagement(
  db: PrismaClient,
  unitId: string
): Promise<any> {
  const engagement = await db.unitEngagement.findFirst({
    where: {
      unitId,
      status: 'active',
    },
    include: {
      owner: true,
      managementOrg: true,
    },
  });

  return engagement || null;
}

/**
 * Get all engagements for a unit.
 */
export async function getUnitEngagements(
  db: PrismaClient,
  unitId: string
): Promise<any[]> {
  return await db.unitEngagement.findMany({
    where: { unitId },
    include: {
      owner: true,
      managementOrg: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a unit engagement (admin only, typically only for draft engagements).
 */
export async function deleteUnitEngagement(
  db: PrismaClient,
  engagementId: string
): Promise<void> {
  const engagement = await db.unitEngagement.findUnique({
    where: { id: engagementId },
  });

  if (!engagement) {
    throw new Error(`UnitEngagement ${engagementId} not found`);
  }

  if (engagement.status !== 'draft') {
    throw new Error('Only draft engagements can be deleted');
  }

  await db.unitEngagement.delete({
    where: { id: engagementId },
  });
}
