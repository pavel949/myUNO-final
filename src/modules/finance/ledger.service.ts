import { PrismaClient, LedgerEntry, LedgerEntryType } from '@prisma/client';

export interface RecordCostInput {
  unitId: string;
  entryType: LedgerEntryType;
  amountThb: number;
  occurredOn: Date;
  description: string;
  receiptMediaId?: string;
  recordedByIdentityId: string;
}

export interface LedgerEntryWithRelations extends LedgerEntry {
  unit?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
}

/**
 * Record a cost entry in the ledger (manual entry by staff).
 * Append-only: creates a new LedgerEntry row, never updates.
 */
export async function recordCost(db: PrismaClient, input: RecordCostInput): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: input.entryType,
      amountThb: input.amountThb,
      unitId: input.unitId,
      occurredOn: input.occurredOn,
      description: input.description,
      createdByIdentityId: input.recordedByIdentityId,
      projectId: input.unitId
        ? (await db.unit.findUnique({ where: { id: input.unitId }, select: { projectId: true } }))?.projectId
        : undefined,
    },
  });

  return entry;
}

/**
 * Create an auto entry for booking revenue (called on payment confirmation).
 * Append-only; no update path.
 */
export async function recordBookingRevenue(
  db: PrismaClient,
  bookingId: string,
  unitId: string,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { projectId: true },
  });

  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'rental_revenue',
      amountThb,
      unitId,
      projectId: unit?.projectId,
      bookingId,
      occurredOn,
      description: `Booking revenue for booking ${bookingId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Create an auto entry for a refund (called on refund processing).
 * Append-only; no update path.
 */
export async function recordRefundOut(
  db: PrismaClient,
  refundId: string,
  unitId: string | null,
  projectId: string | null,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'refund_out',
      amountThb: -Math.abs(amountThb),
      unitId,
      projectId,
      refundId,
      occurredOn,
      description: `Refund ${refundId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Create an auto entry for service commission (called on service order payment).
 * Append-only; no update path.
 */
export async function recordServiceCommission(
  db: PrismaClient,
  serviceOrderId: string,
  unitId: string | null,
  projectId: string,
  commissionAmountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'service_commission',
      amountThb: commissionAmountThb,
      unitId,
      projectId,
      serviceOrderId,
      occurredOn,
      description: `Service commission for order ${serviceOrderId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Reverse a ledger entry via an admin-only reversal entry.
 * Append-only: creates a new negative entry instead of updating the original.
 */
export async function reverseLedgerEntry(
  db: PrismaClient,
  entryId: string,
  reverseReason: string,
  reversedByIdentityId: string
): Promise<LedgerEntry> {
  const original = await db.ledgerEntry.findUnique({
    where: { id: entryId },
  });

  if (!original) {
    throw new Error(`LedgerEntry ${entryId} not found`);
  }

  // Create a reversal entry: same amount but opposite sign
  const reversal = await db.ledgerEntry.create({
    data: {
      entryType: 'adjustment',
      amountThb: -original.amountThb,
      unitId: original.unitId,
      projectId: original.projectId,
      occurredOn: new Date(),
      description: `Reversal of ${original.description}: ${reverseReason}`,
      createdByIdentityId: reversedByIdentityId,
    },
  });

  return reversal;
}

/**
 * Get ledger entries for a unit within a date range.
 * Used for statement generation and reconciliation.
 */
export async function getUnitLedgerEntries(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      unitId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { occurredOn: 'asc' },
  });

  return entries;
}

/**
 * Get all ledger entries for a project within a date range.
 * Used for admin reporting.
 */
export async function getProjectLedgerEntries(
  db: PrismaClient,
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      projectId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { occurredOn: 'asc' },
  });

  return entries;
}

/**
 * Get a specific ledger entry by ID.
 */
export async function getLedgerEntry(
  db: PrismaClient,
  entryId: string
): Promise<LedgerEntryWithRelations | null> {
  return db.ledgerEntry.findUnique({
    where: { id: entryId },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Compute total revenue and costs for a unit in a period.
 * Used by statement generation.
 */
export async function computeUnitLedgerTotals(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<{ totalRevenueTh: number; totalCostsTh: number; netTh: number }> {
  const result = await db.ledgerEntry.aggregate({
    where: {
      unitId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: { amountThb: true },
  });

  const net = result._sum.amountThb || 0;

  // Separate positive (revenue) and negative (costs)
  const entries = await getUnitLedgerEntries(db, unitId, startDate, endDate);
  const totalRevenue = entries.filter((e) => e.amountThb > 0).reduce((sum, e) => sum + e.amountThb, 0);
  const totalCosts = Math.abs(entries.filter((e) => e.amountThb < 0).reduce((sum, e) => sum + e.amountThb, 0));

  return {
    totalRevenueTh: totalRevenue,
    totalCostsTh: totalCosts,
    netTh: net,
  };
}
