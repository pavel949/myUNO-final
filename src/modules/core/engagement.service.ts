import { PrismaClient, UnitEngagementType, UnitEngagementStatus, type Prisma } from '@prisma/client';
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
export async function createDraftUnitEngagementTx(
  tx: Prisma.TransactionClient,
  input: CreateUnitEngagementInput,
): Promise<{ id: string }> {
  const { unitId, engagementType, ownerIdentityId, noiCapAnnualThb, feeOverridePct, setupFeeThb, mandateMediaId, managementOrgId } = input;

  const unit = await tx.unit.findUnique({
    where: { id: unitId },
    select: { id: true, projectId: true, ownerIdentityId: true },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found`);
  if (unit.ownerIdentityId !== ownerIdentityId) {
    throw new Error('Engagement owner must be the verified current owner of the unit');
  }

  const owner = await tx.identity.findUnique({ where: { id: ownerIdentityId }, select: { id: true } });
  if (!owner) throw new Error(`Owner identity ${ownerIdentityId} not found`);

  if (engagementType === 'via_management_company') {
    if (!managementOrgId) {
      throw new Error('Management organization is required for via-management-company engagement');
    }
    const org = await tx.organization.findFirst({
      where: {
        id: managementOrgId,
        status: 'active',
        orgType: 'management_company',
        OR: [{ projectId: null }, { projectId: unit.projectId }],
      },
      select: { id: true },
    });
    if (!org) throw new Error(`Management organization ${managementOrgId} not found or not active`);
  }

  const engagement = await tx.unitEngagement.create({
    data: {
      unitId,
      engagementType,
      ownerIdentityId,
      noiCapAnnualThb,
      feeOverridePct: feeOverridePct !== undefined ? new Decimal(feeOverridePct) : undefined,
      setupFeeThb,
      mandateMediaId,
      managementOrgId,
      status: 'draft',
    },
  });
  return { id: engagement.id };
}

export async function createUnitEngagement(
  db: PrismaClient,
  input: CreateUnitEngagementInput
): Promise<{ id: string }> {
  if (input.engagementType === 'direct_managed' && !input.noiCapAnnualThb) {
    throw new Error('NOI cap is required for direct-managed engagement');
  }
  return db.$transaction((tx) => createDraftUnitEngagementTx(tx, input));
}

export async function updateUnitEngagementTx(
  tx: Prisma.TransactionClient,
  engagementId: string,
  input: UpdateUnitEngagementInput,
): Promise<void> {
  const { status, noiCapAnnualThb, feeOverridePct, setupFeeThb, mandateMediaId, startsOn, endsOn } = input;

  const engagement = await tx.unitEngagement.findUnique({ where: { id: engagementId } });
  if (!engagement) throw new Error(`UnitEngagement ${engagementId} not found`);
  const unit = await tx.unit.findUnique({
    where: { id: engagement.unitId },
    select: { ownerIdentityId: true },
  });
  if (!unit || unit.ownerIdentityId !== engagement.ownerIdentityId) {
    throw new Error('Engagement owner no longer matches the verified current owner');
  }

  const nextMandateMediaId = mandateMediaId ?? engagement.mandateMediaId;
  const nextNoiCap = noiCapAnnualThb ?? engagement.noiCapAnnualThb;

  if (status === 'active') {
    if (!nextMandateMediaId && engagement.engagementType !== 'owner_direct') {
      throw new Error('Mandate document is required to activate managed engagement');
    }
    if (engagement.engagementType === 'direct_managed' && !nextNoiCap) {
      throw new Error('NOI cap is required to activate direct-managed engagement');
    }
    if (engagement.engagementType === 'via_management_company' && !engagement.managementOrgId) {
      throw new Error('Management organization is required to activate via-management-company engagement');
    }

    if (engagement.status !== 'active') {
      const competing = await tx.unitEngagement.findFirst({
        where: {
          unitId: engagement.unitId,
          status: 'active',
          id: { not: engagementId },
        },
        select: { id: true },
      });
      if (competing) {
        throw new Error(
          `Unit ${engagement.unitId} already has an active engagement (${competing.id}); end it before activating another`
        );
      }
    }
  }

  if (
    engagement.engagementType === 'direct_managed' &&
    noiCapAnnualThb !== undefined &&
    !noiCapAnnualThb &&
    status === 'active'
  ) {
    throw new Error('NOI cap cannot be removed from active direct-managed engagement');
  }

  await tx.unitEngagement.update({
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

export async function updateUnitEngagement(
  db: PrismaClient,
  engagementId: string,
  input: UpdateUnitEngagementInput
): Promise<void> {
  return db.$transaction((tx) => updateUnitEngagementTx(tx, engagementId, input));
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
