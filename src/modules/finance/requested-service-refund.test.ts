import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { processRequestedCardRefund } from './finance.service';
import { getPaymentProvider, getProviderConfig } from './providers';
vi.mock('./providers', () => ({ getPaymentProvider: vi.fn(), getProviderConfig: vi.fn() }));
const payment = { id: 'payment', bookingId: null, serviceOrderId: 'order', provider: 'opn', providerSessionId: 'charge', reconciliationReason: null as string | null };
let status = 'requested';
const gatewayRefund = vi.fn();
const fake = {
  $executeRaw: vi.fn(),
  $transaction: async (action: (tx: unknown) => Promise<unknown>) => action(fake),
  refund: { findUniqueOrThrow: vi.fn(async () => ({ id: 'refund', paymentId: 'payment', method: 'card_provider', amountThb: 50000, reason: 'cancellation', status, payment })), update: vi.fn(async ({ data }: { data: { status?: string } }) => { if (data.status) status = data.status; return { id: 'refund', status }; }) },
  payment: { findUniqueOrThrow: vi.fn(async () => payment), update: vi.fn(async () => payment), updateMany: vi.fn(async () => ({ count: 1 })) },
};
beforeEach(() => { vi.clearAllMocks(); payment.reconciliationReason = null; status = 'requested'; vi.stubEnv('PAYMENT_PROVIDER', 'opn'); vi.mocked(getProviderConfig).mockReturnValue({ provider: 'opn' } as never); vi.mocked(getPaymentProvider).mockReturnValue({ refund: gatewayRefund } as never); });
afterEach(() => vi.unstubAllEnvs());
describe('durable requested service refunds', () => {
  it('never overwrites a quarantined receipt or dispatches its refund', async () => {
    payment.reconciliationReason = 'SERVICE_REFUND_OUTCOME_UNKNOWN';
    await processRequestedCardRefund(fake as unknown as PrismaClient, 'refund');
    expect(status).toBe('requested');
    expect(gatewayRefund).not.toHaveBeenCalled();
    expect(fake.payment.update).not.toHaveBeenCalled();
    expect(fake.payment.updateMany).not.toHaveBeenCalled();
  });
  it('does not claim a request when the gateway is not configured', async () => {
    vi.mocked(getPaymentProvider).mockImplementation(() => { throw new Error('Missing credentials'); });
    await processRequestedCardRefund(fake as unknown as PrismaClient, 'refund');
    expect(status).toBe('requested'); expect(fake.refund.update).not.toHaveBeenCalled();
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('keeps an unknown provider result processing for reconciliation and never dispatches it again', async () => {
    gatewayRefund.mockRejectedValue(new Error('Connection lost after provider may have processed request'));
    await processRequestedCardRefund(fake as unknown as PrismaClient, 'refund');
    await processRequestedCardRefund(fake as unknown as PrismaClient, 'refund');
    expect(status).toBe('processing'); expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect(fake.payment.update).toHaveBeenCalledWith({ where: { id: 'payment' }, data: { reconciliationReason: 'SERVICE_REFUND_OUTCOME_UNKNOWN' } });
  });
});
