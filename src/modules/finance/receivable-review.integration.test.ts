import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { recordCashPayment, createCheckout } from './finance.service';
import { recordBankTransfer, getTransferInstructions } from './bank-transfer.service';

const providerCalls = vi.hoisted(() => ({ createCheckout: vi.fn() }));
vi.mock('./providers', () => ({
  getPaymentProvider: () => providerCalls,
  getProviderConfig: () => ({ provider: 'mock' }),
}));

async function fixture() {
  const project = await createProject();
  const unit = await createUnit(project.id);
  const guest = await createIdentity();
  const staff = await createIdentity();
  const booking = await createBooking({ unitId: unit.id, projectId: project.id,
    guestIdentityId: guest.id, status: 'confirmed', totalThb: 100000 });
  await db.booking.update({ where: { id: booking.id }, data: { receivableStatus: 'pending_reconciliation', balanceDueThb: 100000 } });
  return { booking, guest, staff };
}

describe('source receivable review blocks new collection, not verified outcomes', () => {
  beforeEach(async () => { await resetDb(); providerCalls.createCheckout.mockClear(); });
  it('blocks cash, bank instructions and bank receipts without changing gross balances', async () => {
    const { booking, guest, staff } = await fixture();
    const common = { purpose: 'stay_balance' as const, bookingId: booking.id,
      payerIdentityId: guest.id, amountThb: 100000 };
    await expect(recordCashPayment(db, { ...common, receivedByIdentityId: staff.id, receiptRef: 'test' }))
      .rejects.toMatchObject({ code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' });
    await expect(recordBankTransfer(db, { ...common, confirmedByIdentityId: staff.id, bankReference: 'test' }))
      .rejects.toMatchObject({ code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' });
    await expect(getTransferInstructions(db, { bookingId: booking.id, amountThb: 100000 }))
      .rejects.toMatchObject({ code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' });
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(0);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
      .toMatchObject({ totalThb: 100000, balanceDueThb: 100000, receivableStatus: 'pending_reconciliation' });
  });
  it('blocks checkout before creating a durable claim or calling the provider', async () => {
    const { booking, guest } = await fixture();
    await expect(createCheckout(db, { purpose: 'stay_balance', bookingId: booking.id,
      payerIdentityId: guest.id, amountThb: 100000 }))
      .rejects.toMatchObject({ code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' });
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
    expect(providerCalls.createCheckout).not.toHaveBeenCalled();
  });
  it.each(['created', 'succeeded'] as const)('DB guard refuses bypass insertion with status %s', async status => {
    const { booking, guest } = await fixture();
    await expect(db.payment.create({ data: { bookingId: booking.id, payerIdentityId: guest.id,
      purpose: 'stay_balance', amountThb: 100000, method: 'bank_transfer', provider: 'bank_transfer', status } }))
      .rejects.toThrow('BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED');
  });
  it('does not prevent an existing provider receipt from recording its verified outcome', async () => {
    const { booking, guest } = await fixture();
    await db.booking.update({ where: { id: booking.id }, data: { receivableStatus: 'collectible' } });
    const payment = await db.payment.create({ data: { bookingId: booking.id, payerIdentityId: guest.id,
      purpose: 'stay_balance', amountThb: 100000, method: 'card_provider', provider: 'opn', status: 'pending' } });
    await db.booking.update({ where: { id: booking.id }, data: { receivableStatus: 'pending_reconciliation' } });
    await db.payment.update({ where: { id: payment.id }, data: { status: 'succeeded',
      reconciliationReason: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED' } });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: 'succeeded' });
  });
});
