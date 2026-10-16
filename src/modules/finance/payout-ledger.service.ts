import { computeProviderRemittance } from './remittance.service';
import { assertStatementReceivablesResolved } from './statement-snapshot';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

interface CommonPayoutInput {
  amountThb: number;
  reference: string;
  executedOn: Date;
  recordedByIdentityId: string;
  periodStart: Date;
  periodEnd: Date;
}

interface OwnerPayoutInput extends CommonPayoutInput {
  ownerStatementId: string;
  unitId: string;
  projectId: string;
}

interface ProviderPayoutInput extends CommonPayoutInput {
  providerId: string;
}

/**
 * Money invariant: creating a payout and recording its append-only ledger
 * consequence are one database transaction. The DB unique indexes enforce
 * idempotency even when two requests race past an application pre-check.
 *
 * `ledger_entry.payout_id` is intentionally written with SQL until the full
 * Prisma schema cutover lands; production already has the additive column and
 * FK via 20260912010000_payout_ledger_integrity.
 */
export async function recordOwnerPayoutAtomic(db: PrismaClient, input: OwnerPayoutInput) {
  return db.$transaction(async (tx) => {
    const statement = await tx.ownerStatement.findUniqueOrThrow({ where: { id: input.ownerStatementId } });
    if (statement.unitId !== input.unitId) throw new Error('Payout statement unit mismatch');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${statement.unitId}))`;
    await assertStatementReceivablesResolved(tx, statement);
    const payout = await tx.payout.create({
      data: {
        payeeType: 'owner',
        ownerStatementId: input.ownerStatementId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        amountThb: input.amountThb,
        method: 'bank_transfer_thb',
        reference: input.reference,
        executedOn: input.executedOn,
        recordedByIdentityId: input.recordedByIdentityId,
        status: 'recorded',
      },
    });

    await tx.$executeRaw`
      INSERT INTO "ledger_entry" (
        "id", "created_at", "entry_type", "amount_thb", "unit_id",
        "project_id", "statement_id", "payout_id", "occurred_on",
        "description", "created_by_identity_id"
      ) VALUES (
        ${randomUUID()}, NOW(), CAST('payout_owner' AS "LedgerEntryType"),
        ${-input.amountThb}, ${input.unitId}, ${input.projectId},
        ${input.ownerStatementId}, ${payout.id}, ${input.executedOn},
        ${`Owner payout ${input.reference}`}, ${input.recordedByIdentityId}
      )
    `;

    return payout;
  });
}

export class ProviderPayoutConflict extends Error {
  constructor(message: string, public readonly status: 400 | 409 = 409) { super(message); }
}

export async function recordProviderPayoutAtomic(db: PrismaClient, input: ProviderPayoutInput) {
  if (!Number.isSafeInteger(input.amountThb) || input.amountThb <= 0 ||
      !Number.isFinite(input.periodStart.getTime()) || !Number.isFinite(input.periodEnd.getTime()) ||
      input.periodEnd <= input.periodStart || !Number.isFinite(input.executedOn.getTime()) ||
      typeof input.reference !== 'string' || !input.reference.trim() || input.reference.length > 200) {
    throw new ProviderPayoutConflict('Invalid provider payout amount, period or reference', 400);
  }
  if (input.periodEnd.getTime() > Date.now()) throw new ProviderPayoutConflict('Provider payout requires a completed period');
  return db.$transaction(async (tx) => {
    const providerKey = `provider-payout:${input.providerId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${providerKey}))`;
    const existing = await tx.payout.findFirst({ where: {
      payeeType: 'provider', providerId: input.providerId,
      OR: [{ periodStart: null }, { periodEnd: null }, { periodStart: { lt: input.periodEnd }, periodEnd: { gt: input.periodStart } }],
    }, select: { id: true } });
    if (existing) throw new ProviderPayoutConflict('Payout already recorded for an overlapping or unbounded provider period');

    // Closed periods cannot gain a newly fulfilled order through the runtime
    // writer. Lock all recognized source orders (including earlier orders that
    // may supply carried refunds), in deterministic order, before recomputing.
    const orders = await tx.serviceOrder.findMany({ where: { provider_id: input.providerId, fulfilled_at: { lt: input.periodEnd } }, select: { id: true }, orderBy: { id: 'asc' } });
    for (const order of orders) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${order.id}))`;
      await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${order.id} FOR UPDATE`;
    }
    const currentOrders = await tx.serviceOrder.findMany({ where: { provider_id: input.providerId, status: { in: ['fulfilled', 'closed'] }, fulfilled_at: { gte: input.periodStart, lt: input.periodEnd } }, select: { id: true } });
    const currentIds = currentOrders.map(order => order.id);
    if (currentIds.length && await tx.refund.count({ where: { payment: { serviceOrderId: { in: currentIds } }, status: { in: ['requested', 'processing'] } } })) {
      throw new ProviderPayoutConflict('Provider payout is blocked while service-order refunds are unresolved');
    }
    // Existing reporting attributes these orders to the fulfilment period and
    // carries only refunds arising after a recorded payout. A refund after this
    // period but BEFORE its first payout is not represented by either branch.
    // Refuse an overpayment rather than silently dropping that adjustment.
    if (currentIds.length && await tx.refund.count({ where: { payment: { serviceOrderId: { in: currentIds } }, status: 'succeeded', createdAt: { gte: input.periodEnd } } })) {
      throw new ProviderPayoutConflict('Late pre-payout refund requires financial reconciliation before provider payout');
    }
    const remittance = await computeProviderRemittance(tx as unknown as PrismaClient, input.providerId, input.periodStart, input.periodEnd);
    if (remittance.pendingRefundCount > 0) throw new ProviderPayoutConflict('Provider payout is blocked while service-order refunds are unresolved');
    if (remittance.netThb <= 0) throw new ProviderPayoutConflict('No positive provider payout is due for this period');
    if (input.amountThb !== remittance.netThb) throw new ProviderPayoutConflict('Payout amount does not match computed remittance', 400);
    const payout = await tx.payout.create({
      data: {
        payeeType: 'provider',
        providerId: input.providerId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        amountThb: input.amountThb,
        method: 'bank_transfer_thb',
        reference: input.reference,
        executedOn: input.executedOn,
        recordedByIdentityId: input.recordedByIdentityId,
        status: 'recorded',
      },
    });

    await tx.$executeRaw`
      INSERT INTO "ledger_entry" (
        "id", "created_at", "entry_type", "amount_thb", "payout_id",
        "occurred_on", "description", "created_by_identity_id"
      ) VALUES (
        ${randomUUID()}, NOW(), CAST('payout_provider' AS "LedgerEntryType"),
        ${-input.amountThb}, ${payout.id}, ${input.executedOn},
        ${`Provider payout ${input.reference}`}, ${input.recordedByIdentityId}
      )
    `;

    return { payout, remittance };
  }, { maxWait: 10000, timeout: 20000 });
}

