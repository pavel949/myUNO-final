import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import * as financeService from './finance.service';

const mockCreateCheckout = vi.fn();
const mockConfirmPayment = vi.fn();

vi.mock('./providers', () => ({
  getProviderConfig: () => ({ provider: 'opn' }),
  getPaymentProvider: () => ({
    createCheckout: mockCreateCheckout,
    confirmPayment: mockConfirmPayment,
    refund: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  }),
}));

describe('createCheckout with Opn provider', () => {
  const previousEnv = { ...process.env };

  beforeEach(async () => {
    await resetDb();
    process.env.PAYMENT_PROVIDER = 'opn';
    process.env.OMISE_SECRET_KEY = 'skey_test_checkout';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    mockCreateCheckout.mockReset();
    mockConfirmPayment.mockReset();
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it('creates an Opn charge and stores providerSessionId on the payment row', async () => {
    mockCreateCheckout.mockResolvedValue({
      id: 'chrg_opn_checkout',
      url: 'https://pay.omise.co/authorize/chrg_opn_checkout',
      status: 'pending',
      amount: 800_000,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const guest = await createIdentity({ email: 'guest@example.com' });
    const project = await createProject();
    const unit = await createUnit(project.id);

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      totalThb: 800_000,
    });

    const session = await financeService.createCheckout(db, {
      purpose: 'stay',
      bookingId: booking.id,
      payerIdentityId: guest.id,
      amountThb: 800_000,
    });

    expect(session.checkoutUrl).toBe('https://pay.omise.co/authorize/chrg_opn_checkout');
    expect(session.sessionId).toBe(session.paymentId);

    const payment = await db.payment.findUnique({ where: { id: session.paymentId } });
    expect(payment?.provider).toBe('opn');
    expect(payment?.providerSessionId).toBe('chrg_opn_checkout');

    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: booking.id,
        amount: 800_000,
        paymentId: payment?.id,
        returnUrl: `http://localhost:3000/checkout/${payment?.id}`,
      })
    );
  });

  it('verifyAndConfirm checks provider charge status before confirming', async () => {
    mockCreateCheckout.mockResolvedValue({
      id: 'chrg_verify',
      url: 'https://pay.omise.co/authorize/chrg_verify',
      status: 'pending',
      amount: 500_000,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    mockConfirmPayment.mockResolvedValue({
      chargeId: 'chrg_verify',
      amount: 500_000,
      currency: 'THB',
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      totalThb: 500_000,
    });

    const session = await financeService.createCheckout(db, {
      purpose: 'stay',
      bookingId: booking.id,
      payerIdentityId: guest.id,
      amountThb: 500_000,
    });

    const result = await financeService.verifyAndConfirm(db, session.sessionId);

    expect(result.confirmed).toBe(true);
    expect(mockConfirmPayment).toHaveBeenCalledWith('chrg_verify');

    const updated = await db.booking.findUnique({ where: { id: booking.id } });
    expect(updated?.status).toBe('confirmed');
  });
});
