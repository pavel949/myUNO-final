import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import { processOpnEvent } from './provider-webhook.service';
import * as financeService from './finance.service';

describe('processOpnEvent (Opn webhook)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('confirms a pending payment on charge.complete', async () => {
    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      totalThb: 400_000,
    });

    const payment = await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'opn',
        providerSessionId: 'chrg_test_confirm',
        amountThb: 400_000,
        status: 'pending',
      },
    });

    // The event is verified by the route, but the payment service independently
    // re-fetches the charge and checks its amount. Stub the provider transport
    // rather than bypassing the real-provider verification gate.
    vi.stubEnv('PAYMENT_PROVIDER', 'opn');
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_webhook_integration');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('/charges/chrg_test_confirm');
      return {
        status: 200,
        json: async () => ({
          id: 'chrg_test_confirm', object: 'charge', amount: 400_000,
          currency: 'thb', status: 'successful', paid: true, authorized: true,
        }),
      };
    }));

    const result = await processOpnEvent(db, {
      id: 'evnt_1',
      object: 'event',
      key: 'charge.complete',
      data: { id: 'chrg_test_confirm', paid: true },
    });

    expect(result.handled).toBe(true);
    expect(result.action).toBe('payment_confirmed');

    const updated = await db.booking.findUnique({ where: { id: booking.id } });
    expect(updated?.status).toBe('confirmed');

    const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.status).toBe('succeeded');
  });

  it('marks refund failed when provider voids refund (N-10)', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const guest = await createIdentity();
    const actor = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'cancelled',
      totalThb: 300_000,
    });

    const payment = await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'opn',
        providerSessionId: 'chrg_test_refund',
        amountThb: 300_000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    });

    const refund = await financeService.refund(
      db,
      payment.id,
      300_000,
      'cancellation',
      actor.id
    );

    await db.refund.update({
      where: { id: refund.id },
      data: { providerRefundId: 'rfnd_test_voided' },
    });

    const result = await processOpnEvent(db, {
      id: 'evnt_2',
      object: 'event',
      key: 'refund.create',
      data: { id: 'rfnd_test_voided', voided: true },
    });

    expect(result.handled).toBe(true);
    expect(result.action).toBe('refund_failed');

    const failed = await db.refund.findUnique({ where: { id: refund.id } });
    expect(failed?.status).toBe('failed');

    const alert = await db.notification.findFirst({
      where: { identityId: admin.id, type: 'finance_refund_failed' },
    });
    expect(alert).not.toBeNull();
  });

  it('is idempotent for already-confirmed payments', async () => {
    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      totalThb: 200_000,
    });

    await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'opn',
        providerSessionId: 'chrg_already_done',
        amountThb: 200_000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    });

    const result = await processOpnEvent(db, {
      id: 'evnt_3',
      object: 'event',
      key: 'charge.complete',
      data: { id: 'chrg_already_done', paid: true },
    });

    expect(result.action).toBe('already_confirmed');
  });
});
