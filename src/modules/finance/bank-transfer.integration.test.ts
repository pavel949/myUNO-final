import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { seedConfig, setConfigOverride, clearConfigCache } from '@/modules/config';
import {
  getTransferInstructions,
  recordBankTransfer,
  transferReference,
} from './bank-transfer.service';

/**
 * A guest booking from abroad can neither hand over cash nor pay by card (Q8),
 * so the only way to take their money was outside the platform — off the ledger
 * and invisible on the owner's statement. This is the rail that closes that.
 */
describe('paying by transfer into the company account', () => {
  let bookingId: string;
  let projectId: string;
  let guestId: string;
  let staffId: string;

  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);

    const project = await createProject();
    projectId = project.id;
    const unit = await createUnit(projectId);
    const guest = await createIdentity();
    guestId = guest.id;
    const staff = await createIdentity();
    staffId = staff.id;

    const booking = await createBooking({
      unitId: unit.id,
      projectId,
      guestIdentityId: guest.id,
      totalThb: 4_500_00,
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    bookingId = booking.id;
  });

  describe('the instructions a payer is given', () => {
    it('name the company account the money must reach', async () => {
      const instructions = await getTransferInstructions(db, {
        bookingId,
        amountThb: 4_500_00,
        projectId,
      });

      expect(instructions.legalName).toBe('Ignatev Estate Co., Ltd');
      expect(instructions.bankName).toBe('Bank of Ayudhya (Krungsri)');
      expect(instructions.accountNumber).toBe('475-1-22131-3');
      expect(instructions.swift).toBe('AYUDTHBK');
    });

    it('carry the corporate tax number, not a personal one', async () => {
      // The founder's personal tax id must never appear on something a guest
      // reads: it is his personal data, and the company registration is what
      // belongs on a receipt.
      const instructions = await getTransferInstructions(db, {
        bookingId,
        amountThb: 4_500_00,
      });

      expect(instructions.taxId).toBe('083-5-56602358-7');
      expect(instructions.taxId).not.toContain('099-1');
    });

    it('carry a reference that ties the credit back to the booking', async () => {
      const instructions = await getTransferInstructions(db, {
        bookingId,
        amountThb: 4_500_00,
      });

      expect(instructions.reference).toBe(transferReference(bookingId));
      expect(instructions.reference).toMatch(/^MYUNO-[0-9A-F]{8}$/);
    });

    it('expire, so an unpaid instruction becomes something ops chases', async () => {
      const instructions = await getTransferInstructions(db, {
        bookingId,
        amountThb: 4_500_00,
      });
      expect(instructions.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('are refused when a project has turned transfers off', async () => {
      await setConfigOverride(db, 'merchant.bank_transfer_enabled', false, {
        scopeType: 'project',
        scopeId: projectId,
        changedByIdentityId: staffId,
      });
      clearConfigCache();

      await expect(
        getTransferInstructions(db, { bookingId, amountThb: 4_500_00, projectId })
      ).rejects.toMatchObject({ code: 'TRANSFER_DISABLED' });
    });

    it('are refused rather than improvised when no account is configured', async () => {
      // Instructions with a missing account number send money nowhere, and
      // "nowhere" is not something to be vague about.
      await db.configParameter.updateMany({
        where: { key: 'merchant.bank_account_number' },
        data: { defaultValue: '' },
      });
      clearConfigCache();

      await expect(
        getTransferInstructions(db, { bookingId, amountThb: 4_500_00 })
      ).rejects.toMatchObject({ code: 'MERCHANT_NOT_CONFIGURED' });
    });
  });

  describe('recording that the money arrived', () => {
    it('records who confirmed it and against which bank reference', async () => {
      const payment = await recordBankTransfer(db, {
        purpose: 'stay',
        bookingId,
        payerIdentityId: guestId,
        amountThb: 4_500_00,
        confirmedByIdentityId: staffId,
        bankReference: 'KRUNGSRI-20260824-0042',
      });

      expect(payment.method).toBe('bank_transfer');
      expect(payment.status).toBe('succeeded');
      expect(payment.receivedByIdentityId).toBe(staffId);
      expect(payment.receiptRef).toBe('KRUNGSRI-20260824-0042');
    });

    it('writes the ledger entry in the same breath', async () => {
      // Money recorded as received with no ledger row is money missing from the
      // owner's statement, and the ledger is append-only so it cannot be
      // patched afterwards.
      const payment = await recordBankTransfer(db, {
        purpose: 'stay',
        bookingId,
        payerIdentityId: guestId,
        amountThb: 4_500_00,
        confirmedByIdentityId: staffId,
        bankReference: 'KRUNGSRI-20260824-0042',
      });

      const entry = await db.ledgerEntry.findFirst({ where: { paymentId: payment.id } });
      expect(entry).not.toBeNull();
      expect(entry!.entryType).toBe('rental_revenue');
      expect(entry!.amountThb).toBe(4_500_00);
      expect(entry!.projectId).toBe(projectId);
      expect(entry!.description).toContain('KRUNGSRI-20260824-0042');
    });

    it('confirms a pending booking when stay transfer is recorded', async () => {
      await recordBankTransfer(db, {
        purpose: 'stay',
        bookingId,
        payerIdentityId: guestId,
        amountThb: 4_500_00,
        confirmedByIdentityId: staffId,
        bankReference: 'KRUNGSRI-20260824-0043',
      });

      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, holdExpiresAt: true },
      });

      expect(booking?.status).toBe('confirmed');
      expect(booking?.holdExpiresAt).toBeNull();
    });

    it('does not alter booking status for stay_balance payments', async () => {
      const other = await createBooking({
        unitId: (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'checked_in',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-03'),
      });

      await recordBankTransfer(db, {
        purpose: 'stay_balance',
        bookingId: other.id,
        payerIdentityId: guestId,
        amountThb: 1_000_00,
        confirmedByIdentityId: staffId,
        bankReference: 'KRUNGSRI-20260824-0044',
      });

      const after = await db.booking.findUnique({
        where: { id: other.id },
        select: { status: true },
      });
      expect(after?.status).toBe('checked_in');
    });

    it('refuses without a bank reference, because an untraceable credit cannot be reconciled', async () => {
      await expect(
        recordBankTransfer(db, {
          purpose: 'stay',
          bookingId,
          payerIdentityId: guestId,
          amountThb: 4_500_00,
          confirmedByIdentityId: staffId,
          bankReference: '   ',
        })
      ).rejects.toThrow(/bank reference is required/i);
    });

    it('refuses a zero or negative amount', async () => {
      await expect(
        recordBankTransfer(db, {
          purpose: 'stay',
          bookingId,
          payerIdentityId: guestId,
          amountThb: 0,
          confirmedByIdentityId: staffId,
          bankReference: 'REF',
        })
      ).rejects.toThrow(/positive amount/i);
    });
  });

  describe('the reference', () => {
    it('is stable for the same booking', () => {
      expect(transferReference(bookingId)).toBe(transferReference(bookingId));
    });

    it('is uppercase, because bank statements arrive uppercased', () => {
      const reference = transferReference('abcdef01-2345-6789-abcd-ef0123456789');
      expect(reference).toBe(reference.toUpperCase());
    });
  });
});
