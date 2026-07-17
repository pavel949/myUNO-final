import { PrismaClient, OwnerStatement } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { computeUnitLedgerTotals, type LedgerEntryWithRelations } from './ledger.service';

export interface StatementGenerationInput {
  unitId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface StatementLineItem {
  entryType: string;
  description: string;
  amountThb: number;
}

export interface OwnerStatementData extends OwnerStatement {
  revenueLines: LedgerEntryWithRelations[];
  costLines: LedgerEntryWithRelations[];
}

/**
 * Generate a monthly statement for a unit based on its engagement type.
 * Enforces NOI cap requirement for direct_managed; refuses generation without it.
 * Returns draft statement, never published directly.
 */
export async function generateOwnerStatement(
  db: PrismaClient,
  input: StatementGenerationInput
): Promise<OwnerStatement> {
  const { unitId, periodStart, periodEnd } = input;

  // Verify unit exists and get its owner + engagement
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      ownerIdentityId: true,
      projectId: true,
      engagements: {
        where: { status: 'active' },
        take: 1,
      },
    },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  if (!unit.ownerIdentityId) {
    throw new Error(`Unit ${unitId} has no owner`);
  }

  if (unit.engagements.length === 0) {
    throw new Error(`Unit ${unitId} has no active engagement`);
  }

  const engagement = unit.engagements[0];

  // Enforce: direct_managed MUST have NOI cap set
  if (engagement.engagementType === 'direct_managed' && !engagement.noiCapAnnualThb) {
    throw new Error(
      `Statement generation refused: direct_managed unit ${unitId} missing noi_cap_annual_thb. Admin must set the cap before statements can be generated.`
    );
  }

  // Compute ledger totals for the period
  const totals = await computeUnitLedgerTotals(db, unitId, periodStart, periodEnd);

  // Compute owner share based on engagement type
  let ownerShareThb = 0;
  let estateShareThb = 0;
  let capApplied = false;

  if (engagement.engagementType === 'direct_managed') {
    // NOI cap pro-rata: owner gets MIN(NOI, cap_pro_rata).
    // The period is inclusive of both endpoints — July 1 to July 31 is 31 days,
    // not 30 — so add one day to the endpoint difference.
    const daysInPeriod = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const capProRataThb = Math.round((engagement.noiCapAnnualThb! * daysInPeriod) / 365);

    const noi = totals.netTh;
    ownerShareThb = Math.min(noi, capProRataThb);
    estateShareThb = Math.max(0, noi - capProRataThb);
    capApplied = capProRataThb < noi; // Cap applied if it limited the owner share
  } else if (engagement.engagementType === 'via_management_company') {
    // MC gets remainder; owner receives NOI minus MC fee
    const mcFeePercentage = await getConfig(db, 'engagement.via_mc.platform_fee_pct', {
      projectId: unit.projectId,
      unitId,
    });
    const mcFeeThb = Math.round((totals.netTh * (mcFeePercentage || 0)) / 100);
    ownerShareThb = totals.netTh - mcFeeThb;
    estateShareThb = mcFeeThb; // Estate keeps platform fee
    capApplied = false;
  } else if (engagement.engagementType === 'owner_direct') {
    // Owner gets NOI minus booking fee
    const bookingFeePercentage = await getConfig(db, 'engagement.owner_direct.booking_fee_pct', {
      projectId: unit.projectId,
      unitId,
    });
    const bookingFeeThb = Math.round((totals.netTh * (bookingFeePercentage || 0)) / 100);
    ownerShareThb = totals.netTh - bookingFeeThb;
    estateShareThb = bookingFeeThb; // Estate keeps fee
    capApplied = false;
  }

  // Create the statement in draft status
  const statement = await db.ownerStatement.create({
    data: {
      unitId,
      ownerIdentityId: unit.ownerIdentityId,
      engagementId: engagement.id,
      periodStart,
      periodEnd,
      grossRevenueTh: totals.totalRevenueTh,
      totalCostsTh: totals.totalCostsTh,
      noiTh: totals.netTh,
      ownerShareTh: ownerShareThb,
      estateShareTh: estateShareThb,
      capApplied,
      status: 'draft',
    },
  });

  return statement;
}

/**
 * Publish a draft statement (admin sign-off).
 * Prevents double-publishing; marks previous statements as superseded.
 */
export async function publishStatement(
  db: PrismaClient,
  statementId: string,
  publishedByIdentityId: string
): Promise<OwnerStatement> {
  const statement = await db.ownerStatement.findUnique({
    where: { id: statementId },
  });

  if (!statement) {
    throw new Error(`Statement ${statementId} not found`);
  }

  if (statement.status !== 'draft') {
    throw new Error(`Only draft statements can be published; statement is ${statement.status}`);
  }

  // Mark any previous published statements for this unit in the same period as superseded
  await db.ownerStatement.updateMany({
    where: {
      unitId: statement.unitId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      status: 'published',
      id: { not: statementId },
    },
    data: { status: 'superseded' },
  });

  // Publish this statement
  const published = await db.ownerStatement.update({
    where: { id: statementId },
    data: {
      status: 'published',
      publishedAt: new Date(),
      publishedByIdentityId,
    },
  });

  return published;
}

/**
 * Get statement detail with full line items.
 * Owner sees only published statements.
 * Admin sees draft, published, and superseded.
 */
export async function getStatement(
  db: PrismaClient,
  statementId: string,
  requestingIdentityId: string,
  isAdmin: boolean
): Promise<OwnerStatementData | null> {
  const statement = await db.ownerStatement.findUnique({
    where: { id: statementId },
  });

  if (!statement) {
    return null;
  }

  // Access control: owner sees only their published statements; admin sees all
  if (!isAdmin) {
    if (statement.ownerIdentityId !== requestingIdentityId || statement.status !== 'published') {
      throw new Error('Access denied');
    }
  }

  // Get ledger entries for line items
  const entries = await db.ledgerEntry.findMany({
    where: {
      unitId: statement.unitId,
      occurredOn: {
        gte: statement.periodStart,
        lte: statement.periodEnd,
      },
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { occurredOn: 'asc' },
  });

  return {
    ...statement,
    revenueLines: entries.filter((e) => e.amountThb > 0),
    costLines: entries.filter((e) => e.amountThb < 0),
  };
}

/**
 * List statements for a unit (owner sees only published; admin sees all).
 */
export async function listStatements(
  db: PrismaClient,
  unitId: string,
  requestingIdentityId: string,
  isAdmin: boolean
): Promise<OwnerStatement[]> {
  const statusFilter = isAdmin ? undefined : 'published';

  const statements = await db.ownerStatement.findMany({
    where: {
      unitId,
      status: statusFilter,
      ownerIdentityId: isAdmin ? undefined : requestingIdentityId,
    },
    orderBy: { periodEnd: 'desc' },
  });

  return statements;
}

/**
 * List draft statements for admin review (per admin board F-FIN-1).
 */
export async function listDraftStatements(db: PrismaClient): Promise<OwnerStatement[]> {
  return db.ownerStatement.findMany({
    where: { status: 'draft' },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get the latest published statement for a unit.
 * Used for owner dashboard tiles.
 */
export async function getLatestPublishedStatement(db: PrismaClient, unitId: string): Promise<OwnerStatement | null> {
  return db.ownerStatement.findFirst({
    where: {
      unitId,
      status: 'published',
    },
    orderBy: { periodEnd: 'desc' },
  });
}
