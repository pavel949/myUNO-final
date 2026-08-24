import { PrismaClient, PaymentPurpose } from '@prisma/client';
import { getConfig } from '@/modules/config';

/**
 * Paying by bank transfer into the company account.
 *
 * Loop one charges cash, and the card rail sits behind a provider seam with no
 * provider (Q8). That left a real hole: a Russian-speaking guest booking from
 * abroad cannot hand over cash and cannot pay by card either, so the only way
 * to take their money was outside the platform — off the ledger, invisible on
 * the owner's statement.
 *
 * A transfer is the same shape as cash. Money moves outside the system, a named
 * person confirms it arrived, and the ledger records it. Nothing here authorises
 * or captures anything, which is exactly why it is **not** dressed up as a
 * provider rail: `finance.recordBankTransfer` is the honest sibling of
 * `recordCashPayment`, not of `verifyAndConfirm`.
 *
 * Where the money goes is configuration (doc 04 §11), never a literal — the
 * payee is a legal fact about the business, it appears on what the guest reads,
 * and there must be exactly one of it.
 */

export interface TransferInstructions {
  legalName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  taxId: string;
  amountThb: number;
  /** What the payer must put in the transfer reference so ops can match it. */
  reference: string;
  /** When the instruction stops being useful and ops should chase. */
  expiresAt: Date;
}

/**
 * The reference a payer quotes and ops matches on.
 *
 * Short enough to survive a bank's reference field and to be typed correctly by
 * a person, and derived from the booking so it cannot collide. Uppercase because
 * bank statements arrive uppercased and a case-sensitive match would fail on
 * half of them.
 */
export function transferReference(bookingId: string): string {
  return `MYUNO-${bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/**
 * What to tell someone who wants to pay by transfer.
 *
 * Refuses rather than improvising when the account is not configured: a
 * transfer instruction with a missing account number sends money nowhere, and
 * "nowhere" is not something to be vague about.
 */
export async function getTransferInstructions(
  db: PrismaClient,
  input: { bookingId: string; amountThb: number; projectId?: string }
): Promise<TransferInstructions> {
  const scope = input.projectId ? { projectId: input.projectId } : undefined;

  const [enabled, legalName, bankName, accountName, accountNumber, swift, taxId, windowHours] =
    await Promise.all([
      getConfig(db, 'merchant.bank_transfer_enabled', scope),
      getConfig(db, 'merchant.legal_name'),
      getConfig(db, 'merchant.bank_name'),
      getConfig(db, 'merchant.bank_account_name'),
      getConfig(db, 'merchant.bank_account_number'),
      getConfig(db, 'merchant.bank_swift'),
      getConfig(db, 'merchant.tax_id'),
      getConfig(db, 'merchant.bank_transfer_window_hours', scope),
    ]);

  if (enabled === false) {
    const error = new Error('Bank transfer is not offered here');
    (error as { code?: string }).code = 'TRANSFER_DISABLED';
    throw error;
  }

  if (!accountNumber || !bankName || !accountName) {
    const error = new Error(
      'No company bank account is configured, so transfer instructions cannot be issued'
    );
    (error as { code?: string }).code = 'MERCHANT_NOT_CONFIGURED';
    throw error;
  }

  if (!Number.isInteger(input.amountThb) || input.amountThb <= 0) {
    throw new Error('A transfer must be for a positive amount in satang');
  }

  const hours = typeof windowHours === 'number' && windowHours > 0 ? windowHours : 72;

  return {
    legalName: (legalName as string) ?? (accountName as string),
    bankName: bankName as string,
    accountName: accountName as string,
    accountNumber: accountNumber as string,
    swift: (swift as string) ?? '',
    taxId: (taxId as string) ?? '',
    amountThb: input.amountThb,
    reference: transferReference(input.bookingId),
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  };
}

export interface RecordBankTransferInput {
  purpose: PaymentPurpose;
  bookingId?: string;
  serviceOrderId?: string;
  payerIdentityId: string;
  amountThb: number;
  /** The staff member who checked the bank statement. Never the payer. */
  confirmedByIdentityId: string;
  /** The bank's own reference for the credit, so the entry can be traced. */
  bankReference: string;
}

/**
 * Record that a transfer landed.
 *
 * Only a staff member can call this, and the reference is required: a payment
 * marked received with nothing to tie it to a line on a bank statement is
 * unreconcilable, and an unreconcilable payment on an owner's statement is
 * exactly the kind of figure that destroys trust in the whole document.
 */
export async function recordBankTransfer(
  db: PrismaClient,
  input: RecordBankTransferInput
) {
  if (!input.bankReference?.trim()) {
    throw new Error('The bank reference is required so the credit can be traced');
  }
  if (!Number.isInteger(input.amountThb) || input.amountThb <= 0) {
    throw new Error('A transfer must be for a positive amount in satang');
  }

  const now = new Date();

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        purpose: input.purpose,
        bookingId: input.bookingId,
        serviceOrderId: input.serviceOrderId,
        payerIdentityId: input.payerIdentityId,
        method: 'bank_transfer',
        provider: 'bank_transfer',
        amountThb: input.amountThb,
        receivedByIdentityId: input.confirmedByIdentityId,
        receivedAt: now,
        receiptRef: input.bankReference.trim(),
        status: 'succeeded',
        succeededAt: now,
      },
    });

    // The ledger entry belongs in the same transaction as the payment. Money
    // recorded as received with no ledger row is money missing from the owner's
    // statement, and the ledger is append-only so it cannot be patched later.
    if (input.bookingId && input.purpose === 'stay') {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { unitId: true },
      });

      if (booking) {
        await tx.ledgerEntry.create({
          data: {
            entryType: 'rental_revenue',
            amountThb: input.amountThb,
            unitId: booking.unitId,
            bookingId: input.bookingId,
            paymentId: payment.id,
            description: `Bank transfer received (ref ${input.bankReference.trim()})`,
            occurredOn: now,
          },
        });
      }
    }

    return payment;
  });
}
