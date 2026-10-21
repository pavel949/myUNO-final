import type { PrismaClient } from '@prisma/client';
import { processRequestedCardRefund } from './finance.service';

/** Recover a cancellation committed before its post-commit gateway dispatch.
 * Processing refunds are deliberately excluded: a crash after provider I/O is
 * an uncertain outcome requiring reconciliation, never an automatic retry.
 */
export async function recoverRequestedBookingRefunds(db: PrismaClient) {
  const requests = await db.refund.findMany({
    where: { status: 'requested', method: 'card_provider', payment: {
      bookingId: { not: null }, provider: 'opn', providerSessionId: { not: null },
      OR: [{ reconciliationReason: null }, { reconciliationReason: 'SERVICE_REFUND_PROVIDER_UNAVAILABLE' }],
    } },
    select: { id: true }, orderBy: { createdAt: 'asc' }, take: 20,
  });
  let processed = 0;
  let deferred = 0;
  for (const request of requests) {
    try {
      await processRequestedCardRefund(db, request.id);
      const current = await db.refund.findUniqueOrThrow({ where: { id: request.id }, select: { status: true } });
      if (current.status === 'requested') deferred++;
      else processed++;
    } catch {
      // One unavailable source must not starve other durable requests. A
      // provider exception after claim remains processing inside the writer.
      deferred++;
    }
  }
  return { processed, deferred };
}
