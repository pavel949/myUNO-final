import { Prisma, PrismaClient, LedgerEntry, LedgerEntryType } from '@prisma/client';

// Finance helpers are valid both on the root client and inside a Prisma
// transaction. Keeping this explicit lets state transitions and their ledger
// effects commit atomically instead of forcing callers into two writes.
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

/** Record a cost entry. Append-only. */
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
 * Create an auto entry for service commission.
 * Append-only; callers may pass a transaction client so the operational state
 * transition and the financial earning commit together.
 */
export async function recordServiceCommission(
  db: DbClient,
  serviceOrderId: string,
  unitId: string | null,
  projectId: string,
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

/**
 * Get all ledger entries for a unit within a period.
 */
export async function getLedgerEntries(
  db: DbClient,
  unitId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<LedgerEntry[]> {
  return db.ledgerEntry.findMany({
    where: {
      unitId,
      occurredOn: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    orderBy: { occurredOn: 'asc' },
  });
}
