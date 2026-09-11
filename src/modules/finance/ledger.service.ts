import { Prisma, PrismaClient, LedgerEntry, LedgerEntryType } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

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

/** Record a cost entry in the ledger. Append-only. */
export async function recordCost(db: DbClient, input: RecordCostInput): Promise<LedgerEntry> {
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

/** Create an auto entry for booking revenue. Append-only. */
export async function recordBookingRevenue(
  db: DbClient,
  bookingId: string,
  unitId: string,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { projectId: true } });
  return db.ledgerEntry.create({
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
}

/** Create an auto entry for a refund. Append-only. */
export async function recordRefundOut(
  db: DbClient,
  refundId: string,
  unitId: string | null,
  projectId: string | null,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  return db.ledgerEntry.create({
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
}

/**
 * Create an auto entry for service commission. Append-only. Standalone Phuket
 * commerce intentionally has no synthetic project, so projectId is nullable.
 */
export async function recordServiceCommission(
  db: DbClient,
  serviceOrderId: string,
  unitId: string | null,
  projectId: string | null,
  commissionAmountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  return db.ledgerEntry.create({
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
}

/** Reverse a ledger entry via a new append-only adjustment. */
export async function reverseLedgerEntry(
  db: DbClient,
  entryId: string,
  reverseReason: string,
  reversedByIdentityId: string
): Promise<LedgerEntry> {
  const original = await db.ledgerEntry.findUnique({ where: { id: entryId } });
  if (!original) throw new Error(`LedgerEntry ${entryId} not found`);
  return db.ledgerEntry.create({
    data: {
      entryType: 'adjustment',
      amountThb: -original.amountThb,
      unitId: original.unitId,
      projectId: original.projectId,
      occurredOn: original.occurredOn,
      description: `Reversal of ${original.description}: ${reverseReason}`,
      createdByIdentityId: reversedByIdentityId,
    },
  });
}

/** Get ledger entries for a unit within a date range. */
export async function getUnitLedgerEntries(
  db: DbClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  return db.ledgerEntry.findMany({
    where: { unitId, occurredOn: { gte: startDate, lte: endDate } },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Get all ledger entries for a project within a date range. */
export async function getProjectLedgerEntries(
  db: DbClient,
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  return db.ledgerEntry.findMany({
    where: { projectId, occurredOn: { gte: startDate, lte: endDate } },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Get a specific ledger entry by ID. */
export async function getLedgerEntry(
  db: DbClient,
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

/** Compute total revenue and costs for a unit in a period. */
export async function computeUnitLedgerTotals(
  db: DbClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<{ totalRevenueTh: number; totalCostsTh: number; netTh: number }> {
  const result = await db.ledgerEntry.aggregate({
    where: { unitId, occurredOn: { gte: startDate, lte: endDate } },
    _sum: { amountThb: true },
  });
  const net = result._sum.amountThb || 0;
  const entries = await getUnitLedgerEntries(db, unitId, startDate, endDate);
  const totalRevenue = entries.filter((e) => e.amountThb > 0).reduce((sum, e) => sum + e.amountThb, 0);
  const totalCosts = Math.abs(entries.filter((e) => e.amountThb < 0).reduce((sum, e) => sum + e.amountThb, 0));
  return { totalRevenueTh: totalRevenue, totalCostsTh: totalCosts, netTh: net };
}
