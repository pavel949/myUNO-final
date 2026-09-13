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

export async function recordProviderPayoutAtomic(db: PrismaClient, input: ProviderPayoutInput) {
  return db.$transaction(async (tx) => {
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

    return payout;
  });
}
