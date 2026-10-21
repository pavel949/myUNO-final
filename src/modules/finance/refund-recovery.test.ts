import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { processRequestedCardRefund } from './finance.service';
import { recoverRequestedBookingRefunds } from './refund-recovery';
vi.mock('./finance.service', () => ({ processRequestedCardRefund: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('bounded booking refund recovery', () => {
  it('selects only unclaimed, allocated requests and caps each batch', async () => {
    const findMany = vi.fn(async () => []);
    await expect(recoverRequestedBookingRefunds({ refund: { findMany } } as unknown as PrismaClient))
      .resolves.toEqual({ processed: 0, deferred: 0 });
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'requested', method: 'card_provider', payment: {
        bookingId: { not: null }, provider: 'opn', providerSessionId: { not: null },
        OR: [{ reconciliationReason: null }, { reconciliationReason: 'SERVICE_REFUND_PROVIDER_UNAVAILABLE' }],
      } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 20,
    });
    expect(processRequestedCardRefund).not.toHaveBeenCalled();
  });
  it('continues other requests after a dispatch failure', async () => {
    vi.mocked(processRequestedCardRefund).mockRejectedValueOnce(new Error('Unavailable source')).mockResolvedValueOnce(undefined);
    const fake = { refund: { findMany: vi.fn(async () => [{ id: 'first' }, { id: 'second' }]),
      findUniqueOrThrow: vi.fn(async () => ({ status: 'succeeded' })) } };
    expect(await recoverRequestedBookingRefunds(fake as unknown as PrismaClient)).toEqual({ processed: 1, deferred: 1 });
    expect(processRequestedCardRefund).toHaveBeenCalledTimes(2);
  });
});
