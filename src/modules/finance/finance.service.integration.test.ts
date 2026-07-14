import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import * as financeService from './finance.service';

describe('finance.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('recordCashPayment', () => {
    it('records cash payment and flips booking to confirmed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const receiver = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: false,
      });

      expect(booking.status).toBe('requested');

      const payment = await financeService.recordCashPayment(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
        receivedByIdentityId: receiver.id,
        receiptRef: 'CHK-001',
      });

      expect(payment.status).toBe('succeeded');
      expect(payment.method).toBe('cash');
      expect(payment.provider).toBe('cash');
      expect(payment.receiptRef).toBe('CHK-001');
      expect(payment.receivedByIdentityId).toBe(receiver.id);

      // Booking should be confirmed
      const updated = await db.booking.findUnique({ where: { id: booking.id } });
      expect(updated?.status).toBe('confirmed');

      // Ledger entry should exist
      const ledger = await db.ledgerEntry.findFirst({
        where: { paymentId: payment.id },
      });
      expect(ledger).toBeDefined();
      expect(ledger?.entryType).toBe('rental_revenue');
      expect(ledger?.amountThb).toBe(8000);
      expect(ledger?.unitId).toBe(unit.id);
      expect(ledger?.bookingId).toBe(booking.id);
    });

    it('records cash payment without a booking', async () => {
      const guest = await createIdentity();
      const receiver = await createIdentity();

      const payment = await financeService.recordCashPayment(db, {
        purpose: 'stay',
        payerIdentityId: guest.id,
        amountThb: 5000,
        receivedByIdentityId: receiver.id,
        receiptRef: 'CHK-002',
      });

      expect(payment.status).toBe('succeeded');
      expect(payment.bookingId).toBeNull();

      // No ledger entry created without booking
      const ledgers = await db.ledgerEntry.findMany({
        where: { paymentId: payment.id },
      });
      expect(ledgers).toHaveLength(0);
    });
  });

  describe('recordCashRefund', () => {
    it('records cash refund and creates ledger entry', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const receiver = await createIdentity();
      const refunder = await createIdentity();
      const actor = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: false,
      });

      // Record initial payment
      const payment = await financeService.recordCashPayment(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
        receivedByIdentityId: receiver.id,
        receiptRef: 'CHK-001',
      });

      // Record refund
      const refund = await financeService.recordCashRefund(db, {
        paymentId: payment.id,
        amountThb: 4000,
        reason: 'cancellation',
        paidBackByIdentityId: refunder.id,
        initiatedByIdentityId: actor.id,
      });

      expect(refund.status).toBe('succeeded');
      expect(refund.method).toBe('cash');
      expect(refund.amountThb).toBe(4000);
      expect(refund.reason).toBe('cancellation');

      // Ledger entry for refund (negative amount)
      const ledger = await db.ledgerEntry.findFirst({
        where: { refundId: refund.id },
      });
      expect(ledger).toBeDefined();
      expect(ledger?.entryType).toBe('refund_out');
      expect(ledger?.amountThb).toBe(-4000);
    });

    it('rejects refund on card payment', async () => {
      const guest = await createIdentity();
      const actor = await createIdentity();

      const payment = await db.payment.create({
        data: {
          purpose: 'stay',
          payerIdentityId: guest.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 8000,
          status: 'succeeded',
        },
      });

      await expect(
        financeService.recordCashRefund(db, {
          paymentId: payment.id,
          amountThb: 4000,
          reason: 'cancellation',
          paidBackByIdentityId: actor.id,
          initiatedByIdentityId: actor.id,
        })
      ).rejects.toThrow('Use recordCashRefund for cash payments');
    });
  });

  describe('createCheckout', () => {
    it('creates a checkout session for mock provider', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const session = await financeService.createCheckout(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
      });

      expect(session.checkoutUrl).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.paymentId).toBeDefined();
      expect(session.checkoutUrl).toContain('/checkout/');

      // Payment should be in pending state
      const payment = await db.payment.findUnique({
        where: { id: session.paymentId },
      });
      expect(payment?.status).toBe('pending');
      expect(payment?.method).toBe('card_provider');
      expect(payment?.provider).toBe('mock');
    });
  });

  describe('verifyAndConfirm', () => {
    it('confirms a pending payment and flips booking', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const session = await financeService.createCheckout(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
      });

      const result = await financeService.verifyAndConfirm(db, session.sessionId);

      expect(result.confirmed).toBe(true);
      expect(result.payment.status).toBe('succeeded');

      // Booking should be confirmed
      const updated = await db.booking.findUnique({ where: { id: booking.id } });
      expect(updated?.status).toBe('confirmed');

      // Ledger entry should exist
      const ledger = await db.ledgerEntry.findFirst({
        where: { paymentId: session.paymentId },
      });
      expect(ledger).toBeDefined();
      expect(ledger?.entryType).toBe('rental_revenue');
      expect(ledger?.amountThb).toBe(8000);
    });

    it('is idempotent on already confirmed payment', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const session = await financeService.createCheckout(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
      });

      // First confirmation
      const first = await financeService.verifyAndConfirm(db, session.sessionId);
      expect(first.confirmed).toBe(true);

      // Second confirmation (webhook might arrive after success return)
      const second = await financeService.verifyAndConfirm(db, session.sessionId);
      expect(second.confirmed).toBe(false); // Already confirmed
      expect(second.payment.status).toBe('succeeded');

      // Booking should still be confirmed
      const bookings = await db.booking.findMany({
        where: { id: booking.id },
      });
      expect(bookings).toHaveLength(1);
      expect(bookings[0]?.status).toBe('confirmed');

      // Ledger should have only one revenue entry
      const ledgers = await db.ledgerEntry.findMany({
        where: { paymentId: session.paymentId, entryType: 'rental_revenue' },
      });
      expect(ledgers).toHaveLength(1);
    });

    it('rejects confirmation of non-existent payment', async () => {
      await expect(
        financeService.verifyAndConfirm(db, 'nonexistent')
      ).rejects.toThrow('not found');
    });

    it('rejects confirmation of failed payment', async () => {
      const guest = await createIdentity();

      const payment = await db.payment.create({
        data: {
          purpose: 'stay',
          payerIdentityId: guest.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 8000,
          status: 'failed',
          failureReason: 'Declined by issuer',
        },
      });

      await expect(
        financeService.verifyAndConfirm(db, payment.id)
      ).rejects.toThrow('Cannot confirm payment with status failed');
    });
  });

  describe('refund', () => {
    it('initiates refund for card payment', async () => {
      const guest = await createIdentity();
      const actor = await createIdentity();

      const payment = await db.payment.create({
        data: {
          purpose: 'stay',
          payerIdentityId: guest.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 8000,
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });

      const refund = await financeService.refund(
        db,
        payment.id,
        4000,
        'cancellation',
        actor.id
      );

      expect(refund.status).toBe('processing');
      expect(refund.method).toBe('card_provider');
      expect(refund.amountThb).toBe(4000);

      // Ledger entry created
      const ledger = await db.ledgerEntry.findFirst({
        where: { refundId: refund.id },
      });
      expect(ledger?.entryType).toBe('refund_out');
      expect(ledger?.amountThb).toBe(-4000);
    });

    it('rejects refund of cash payment', async () => {
      const guest = await createIdentity();
      const receiver = await createIdentity();
      const actor = await createIdentity();

      const payment = await financeService.recordCashPayment(db, {
        purpose: 'stay',
        payerIdentityId: guest.id,
        amountThb: 8000,
        receivedByIdentityId: receiver.id,
        receiptRef: 'CHK-001',
      });

      await expect(
        financeService.refund(db, payment.id, 4000, 'cancellation', actor.id)
      ).rejects.toThrow('Use recordCashRefund for cash payments');
    });

    it('refund creates ledger entries', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const actor = await createIdentity();

      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const session = await financeService.createCheckout(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
      });

      await financeService.verifyAndConfirm(db, session.sessionId);

      const refund = await financeService.refund(
        db,
        session.paymentId,
        4000,
        'modification_decrease',
        actor.id
      );

      // Ledger entry with booking link
      const ledger = await db.ledgerEntry.findFirst({
        where: { refundId: refund.id },
      });
      expect(ledger?.bookingId).toBe(booking.id);
      expect(ledger?.paymentId).toBe(session.paymentId);
      expect(ledger?.amountThb).toBe(-4000);
    });
  });

  describe('full flow: cash payment then booking state', () => {
    it('transitions booking through request → pending → confirmed via cash', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const receiver = await createIdentity();

      // Create request-to-book
      const booking = await createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: false,
      });
      expect(booking.status).toBe('requested');

      // Approve request → pending_payment
      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'pending_payment' },
      });

      // Record cash payment → confirmed + ledger
      const payment = await financeService.recordCashPayment(db, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        amountThb: 8000,
        receivedByIdentityId: receiver.id,
        receiptRef: 'CHK-STAY-001',
      });

      expect(payment.status).toBe('succeeded');

      const final = await db.booking.findUnique({ where: { id: booking.id } });
      expect(final?.status).toBe('confirmed');

      const entries = await db.ledgerEntry.findMany({
        where: { bookingId: booking.id },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.entryType).toBe('rental_revenue');
      expect(entries[0]?.amountThb).toBe(8000);
    });
  });
});
