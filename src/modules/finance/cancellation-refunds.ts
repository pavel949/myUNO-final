import type { Prisma } from '@prisma/client';

/** Caller owns the booking inventory lock. Reserve refund work in the same
 * transaction as cancellation; never perform gateway I/O before commit. */
export async function reserveCancellationRefunds(
  tx: Prisma.TransactionClient,
  input: { bookingId: string; amountSatang: number; initiatedByIdentityId: string },
) {
  if (!Number.isSafeInteger(input.amountSatang) || input.amountSatang < 0) {
    throw new Error('Invalid cancellation refund amount');
  }
  if (!input.amountSatang) return [];
  const payments = await tx.payment.findMany({
    where: { bookingId: input.bookingId, status: 'succeeded', reconciliationReason: null,
      purpose: { in: ['stay', 'stay_balance'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { refunds: { where: { status: { in: ['requested', 'processing', 'succeeded'] } } } },
  });
  let remaining = input.amountSatang;
  const refundIds: string[] = [];
  for (const payment of payments) {
    if (!remaining) break;
    // All financial writers lock inventory before payment. This additional
    // payment lock preserves the same order for concurrent refund commands.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
    const amount = Math.min(remaining, Math.max(0,
      payment.amountThb - payment.refunds.reduce((sum, refund) => sum + refund.amountThb, 0)));
    if (!amount) continue;
    const refund = await tx.refund.create({ data: {
      paymentId: payment.id, method: payment.method === 'card_provider' ? 'card_provider' : 'cash',
      amountThb: amount, reason: 'cancellation', status: 'requested',
      initiatedByIdentityId: input.initiatedByIdentityId,
    } });
    refundIds.push(refund.id);
    remaining -= amount;
  }
  // Any unallocated liability remains on the booking for reconciliation. A
  // cancellation must not invent a receipt or a provider disbursement.
  return refundIds;
}
