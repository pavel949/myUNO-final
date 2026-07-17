import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import {
  createPreAuthDeposit,
  voidDepositOnCleanCheckout,
  captureDepositOnClaim,
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getClaimsAwaitingResolution,
} from './deposits.service';

describe('Deposits & Damage Claims (T-032)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('pre-auth deposit creation', () => {
    it('creates pre-auth deposit for a booking', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // Create pre-auth deposit (e.g., 2000 THB hold)
      const deposit = await createPreAuthDeposit(db, booking.id, 2000);

      expect(deposit.purpose).toBe('deposit_preauth');
      expect(deposit.bookingId).toBe(booking.id);
      expect(deposit.amountThb).toBe(2000);
      expect(deposit.status).toBe('created');
      expect(deposit.payerIdentityId).toBe(guest.id);
    });
  });

  describe('void-on-clean-checkout (DoD #1)', () => {
    it('voids pre-auth deposit when checkout shows no damage', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // Create pre-auth deposit
      const deposit = await createPreAuthDeposit(db, booking.id, 2000);
      expect(deposit.status).toBe('created');

      // Simulate checkout: mark booking as checked_out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
          status: 'checked_out',
        },
      });

      // Condition report shows no damage → void the pre-auth
      const voided = await voidDepositOnCleanCheckout(db, deposit.id);

      expect(voided.id).toBe(deposit.id);
      expect(voided.status).toBe('voided');
    });

    it('guest is not charged when deposit is voided on clean checkout', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      const deposit = await createPreAuthDeposit(db, booking.id, 2000);

      // Mark as checked out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
          status: 'checked_out',
        },
      });

      // Void on clean checkout
      await voidDepositOnCleanCheckout(db, deposit.id);

      // Verify payment is voided (not captured/charged)
      const payment = await db.payment.findUnique({
        where: { id: deposit.id },
      });

      expect(payment?.status).toBe('voided');
    });
  });

  describe('capture-on-claim (DoD #2)', () => {
    it('captures pre-auth deposit when damage claim is filed and approved', async () => {
      const guest = await createIdentity();
      const admin = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // Create pre-auth deposit
      const deposit = await createPreAuthDeposit(db, booking.id, 2000);
      expect(deposit.status).toBe('created');

      // Guest checks out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
          status: 'checked_out',
        },
      });

      // Guest files damage claim within 48h
      const claim = await fileDepositClaim(db, {
        reservationId: booking.id,
        claimantIdentityId: guest.id,
        description: 'Broken mirror in bedroom',
        claimedAmountThb: 1500,
        evidenceMediaIds: [],
      });

      expect(claim.status).toBe('filed');
      expect(claim.claimedAmountThb).toBe(1500);

      // Admin approves claim → captures pre-auth
      const approved = await approveClaim(db, claim.id, 'Approved: mirror damage confirmed');

      expect(approved.status).toBe('approved');
      expect(approved.resolutionAt).toBeDefined();

      // Verify payment is now succeeded (captured)
      const payment = await db.payment.findUnique({
        where: { id: deposit.id },
      });

      expect(payment?.status).toBe('succeeded');
      expect(payment?.receivedAt).toBeDefined();
    });

    it('refunds pre-auth when damage claim is rejected', async () => {
      const guest = await createIdentity();
      const admin = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      const deposit = await createPreAuthDeposit(db, booking.id, 2000);

      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
          status: 'checked_out',
        },
      });

      // Guest files claim
      const claim = await fileDepositClaim(db, {
        reservationId: booking.id,
        claimantIdentityId: guest.id,
        description: 'Alleged stain on couch',
        claimedAmountThb: 500,
      });

      // Admin rejects claim (pre-existing damage) → releases pre-auth
      const rejected = await rejectClaim(db, claim.id, 'Rejected: pre-existing damage');

      expect(rejected.status).toBe('rejected');

      // Verify payment is voided (funds returned)
      const payment = await db.payment.findUnique({
        where: { id: deposit.id },
      });

      expect(payment?.status).toBe('voided');
    });
  });

  describe('claim filing constraints', () => {
    it('refuses to file claim after 48h window', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // Mark checked out 49 hours ago
      const checkedOutTime = new Date(Date.now() - 49 * 60 * 60 * 1000);
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: checkedOutTime,
          status: 'checked_out',
        },
      });

      // Attempt to file claim (should fail)
      await expect(
        fileDepositClaim(db, {
          reservationId: booking.id,
          claimantIdentityId: guest.id,
          description: 'Damage claim',
          claimedAmountThb: 1000,
        })
      ).rejects.toThrow('within 48 hours');
    });

    it('refuses to file claim on booking that has not checked out', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // No checkout → checkedOutAt is null

      await expect(
        fileDepositClaim(db, {
          reservationId: booking.id,
          claimantIdentityId: guest.id,
          description: 'Damage claim',
          claimedAmountThb: 1000,
        })
      ).rejects.toThrow('not checked out');
    });
  });

  describe('claims awaiting resolution', () => {
    it('lists filed and disputed claims for admin board', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking1 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      const booking2 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-07'),
      });

      // File claims on both
      await db.booking.update({ where: { id: booking1.id }, data: { checkedOutAt: new Date() } });
      await db.booking.update({ where: { id: booking2.id }, data: { checkedOutAt: new Date() } });

      const claim1 = await fileDepositClaim(db, {
        reservationId: booking1.id,
        claimantIdentityId: guest.id,
        description: 'Damage 1',
        claimedAmountThb: 1000,
      });

      const claim2 = await fileDepositClaim(db, {
        reservationId: booking2.id,
        claimantIdentityId: guest.id,
        description: 'Damage 2',
        claimedAmountThb: 500,
      });

      // Get awaiting resolution
      const awaiting = await getClaimsAwaitingResolution(db);

      expect(awaiting.length).toBeGreaterThanOrEqual(2);
      expect(awaiting.map((c) => c.id)).toContain(claim1.id);
      expect(awaiting.map((c) => c.id)).toContain(claim2.id);
    });

    it('approved/rejected claims do not appear in awaiting resolution list', async () => {
      const guest = await createIdentity();
      const admin = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-07'),
      });

      // A pre-auth deposit must exist so approving the claim can capture it
      await createPreAuthDeposit(db, booking.id, 2000);

      await db.booking.update({
        where: { id: booking.id },
        data: { checkedOutAt: new Date() },
      });

      const claim = await fileDepositClaim(db, {
        reservationId: booking.id,
        claimantIdentityId: guest.id,
        description: 'Damage',
        claimedAmountThb: 1000,
      });

      // Approve the claim
      await approveClaim(db, claim.id);

      // Get awaiting resolution
      const awaiting = await getClaimsAwaitingResolution(db);

      expect(awaiting.map((c) => c.id)).not.toContain(claim.id);
    });
  });
});
