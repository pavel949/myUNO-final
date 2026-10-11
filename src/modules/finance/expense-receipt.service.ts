import { Prisma, type Identity, type PrismaClient } from '@prisma/client';
import { canWriteUnitExpenses, resolveReceiptReader, type ReceiptReader } from './expense-access';
import {
  RECEIPT_EXTENSIONS,
  openReceipt,
  sealReceipt,
  validateReceiptFile,
  type ReceiptMime,
} from './expense-receipt-file';
import { lockUnitLedgerShared } from './ledger.service';
import { MANUAL_COST_TYPES, isIdempotencyKey } from './manual-cost-input';
import { reportImpactFor, type ReportImpact } from './manual-cost.service';

/**
 * Private receipts for manual costs.
 *
 * A receipt belongs to ONE cost on ONE unit. It is attached by the cost's
 * author (or an admin) who still holds write authority on that unit; it is read
 * by operators with that authority and by the recorded recipient of a visible
 * statement that cites it — decided afresh on every request. It has no public
 * URL, never enters a media gallery, and is returned only as an attachment.
 */

export type ReceiptErrorKind =
  | 'not_found'
  | 'forbidden'
  | 'not_attachable'
  | 'statement_locked'
  | 'idempotency_conflict'
  | 'receipt_reused'
  | 'concurrent_change';

export class ReceiptError extends Error {
  readonly kind: ReceiptErrorKind;
  constructor(kind: ReceiptErrorKind, message: string) {
    super(message);
    this.name = 'ReceiptError';
    this.kind = kind;
  }
}

export interface ReceiptView {
  id: string;
  ledgerEntryId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AttachReceiptResult {
  receipt: ReceiptView;
  replayed: boolean;
  supersededReceiptId: string | null;
  reportImpact: ReportImpact;
}

const toView = (r: {
  id: string;
  ledgerEntryId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): ReceiptView => ({
  id: r.id,
  ledgerEntryId: r.ledgerEntryId,
  mimeType: r.mimeType,
  sizeBytes: r.sizeBytes,
  createdAt: r.createdAt.toISOString(),
});

export async function attachExpenseReceipt(
  db: PrismaClient,
  actor: Identity,
  input: { ledgerEntryId: string; uploadKey: string; declaredMime: string; bytes: Buffer },
  now: Date = new Date()
): Promise<AttachReceiptResult> {
  const entry = await db.ledgerEntry.findUnique({
    where: { id: input.ledgerEntryId },
    select: {
      id: true,
      unitId: true,
      entryType: true,
      createdByIdentityId: true,
      occurredOn: true,
      unit: { select: { id: true, projectId: true } },
    },
  });
  // Unknown id, a non-cost entry and a cost the caller may not touch all read
  // as "not found": the endpoint must not confirm which ledger ids exist.
  if (
    !entry ||
    !entry.unit ||
    !(MANUAL_COST_TYPES as readonly string[]).includes(entry.entryType)
  ) {
    throw new ReceiptError('not_found', 'Cost not found');
  }
  const isAuthor = entry.createdByIdentityId === actor.id;
  if (
    !(await canWriteUnitExpenses(db, actor, entry.unit, now)) ||
    !(isAuthor || actor.isAdmin)
  ) {
    throw new ReceiptError('not_found', 'Cost not found');
  }

  // Content is judged after authority, so an unauthorised caller learns nothing
  // from the validation messages either.
  const file = validateReceiptFile(input.declaredMime, input.bytes);

  if (!isIdempotencyKey(input.uploadKey)) {
    throw new ReceiptError('not_attachable', 'A valid upload key is required.');
  }
  const uploadKey = input.uploadKey.toLowerCase();

  const replay = async (): Promise<AttachReceiptResult | null> => {
    const prior = await db.expenseReceipt.findUnique({
      where: { uploadedByIdentityId_uploadKey: { uploadedByIdentityId: actor.id, uploadKey } },
      select: {
        id: true,
        ledgerEntryId: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        sha256: true,
      },
    });
    if (!prior) return null;
    if (prior.ledgerEntryId !== entry.id || prior.sha256 !== file.sha256) {
      throw new ReceiptError(
        'idempotency_conflict',
        'This upload key was already used for a different receipt.'
      );
    }
    return {
      receipt: toView(prior),
      replayed: true,
      supersededReceiptId: null,
      reportImpact: await reportImpactFor(db, entry.unitId as string, entry.occurredOn),
    };
  };

  const prior = await replay();
  if (prior) return prior;

  try {
    const outcome = await db.$transaction(
      async (tx) => {
        await lockUnitLedgerShared(tx, entry.unitId as string);

        const [linked, reversal, current] = await Promise.all([
          tx.ledgerEntry.findUnique({
            where: { id: entry.id },
            select: { statement: { select: { status: true } } },
          }),
          tx.ledgerEntry.findUnique({
            where: { reversesEntryId: entry.id },
            select: { id: true },
          }),
          tx.expenseReceipt.findFirst({
            where: { ledgerEntryId: entry.id, supersededAt: null },
            select: { id: true, sha256: true, mimeType: true, sizeBytes: true, createdAt: true },
          }),
        ]);

        // A cost that has been reversed takes no new evidence.
        if (reversal) {
          throw new ReceiptError('not_attachable', 'This cost has been reversed.');
        }
        // Evidence cited by an issued statement is part of what was issued.
        if (linked?.statement && linked.statement.status !== 'draft') {
          throw new ReceiptError(
            'statement_locked',
            'This cost is on an issued statement; its receipt can no longer change.'
          );
        }
        // Re-sending the file already current is not a change.
        if (current && current.sha256 === file.sha256) {
          return { receipt: toView({ ...current, ledgerEntryId: entry.id }), superseded: null, noop: true };
        }
        if (current) {
          await tx.expenseReceipt.update({
            where: { id: current.id },
            data: { supersededAt: now },
          });
        }

        const created = await tx.expenseReceipt.create({
          data: {
            ledgerEntryId: entry.id,
            uploadedByIdentityId: actor.id,
            uploadKey,
            mimeType: file.mime,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            ciphertext: sealReceipt(input.bytes),
          },
          select: { id: true, ledgerEntryId: true, mimeType: true, sizeBytes: true, createdAt: true },
        });

        await tx.auditLog.create({
          data: {
            action: current ? 'expense_receipt_replaced' : 'expense_receipt_attached',
            entityType: 'ledger_entry',
            entityId: entry.id,
            actorIdentityId: actor.id,
            data: {
              receiptId: created.id,
              supersededReceiptId: current?.id ?? null,
              mimeType: file.mime,
              sizeBytes: file.sizeBytes,
            },
          },
        });
        return { receipt: toView(created), superseded: current?.id ?? null, noop: false };
      },
      { timeout: 20_000 }
    );

    return {
      receipt: outcome.receipt,
      replayed: outcome.noop,
      supersededReceiptId: outcome.superseded,
      reportImpact: await reportImpactFor(db, entry.unitId as string, entry.occurredOn),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // The same upload key raced (replay), the same bytes already evidence
      // another cost (reuse), or another file landed on this cost first.
      const winner = await replay();
      if (winner) return winner;
      const reused = await db.expenseReceipt.findFirst({
        where: { sha256: file.sha256, supersededAt: null, NOT: { ledgerEntryId: entry.id } },
        select: { id: true },
      });
      if (reused) {
        throw new ReceiptError('receipt_reused', 'This file is already attached to another cost.');
      }
      throw new ReceiptError('concurrent_change', 'The receipt for this cost changed. Reload and try again.');
    }
    throw error;
  }
}

export interface ReceiptDownload {
  bytes: Buffer;
  mimeType: ReceiptMime;
  filename: string;
  reader: ReceiptReader;
}

/**
 * Read a receipt as `actor`, or `null` — which the route answers with 404 —
 * for a receipt that does not exist AND for one the caller may not read. Rights
 * are evaluated now: a role revoked a moment ago, or a statement no longer
 * visible, already yields `null`.
 */
export async function readExpenseReceipt(
  db: PrismaClient,
  actor: Identity,
  receiptId: string,
  now: Date = new Date()
): Promise<ReceiptDownload | null> {
  const receipt = await db.expenseReceipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      mimeType: true,
      sha256: true,
      ciphertext: true,
      ledgerEntry: { select: { unit: { select: { id: true, projectId: true } } } },
    },
  });
  if (!receipt) return null;

  const reader = await resolveReceiptReader(
    db,
    actor,
    { id: receipt.id, unit: receipt.ledgerEntry.unit },
    now
  );
  if (!reader) return null;

  const bytes = openReceipt(receipt.ciphertext, receipt.sha256);
  const mimeType = receipt.mimeType as ReceiptMime;

  await db.auditLog.create({
    data: {
      action: 'expense_receipt_viewed',
      entityType: 'expense_receipt',
      entityId: receipt.id,
      actorIdentityId: actor.id,
      data: { reader },
    },
  });

  return { bytes, mimeType, filename: `expense-receipt.${RECEIPT_EXTENSIONS[mimeType]}`, reader };
}
