import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import {
  scheduleDepositPreauth,
  voidDepositPreauthIfClean,
  captureDepositPreauthOnClaim,
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getClaimsAwaitingResolution,
  releaseExpiredDepositPreauths,
} from './deposits.service';
import { checkOutBooking, checkInBooking } from '@/modules/booking';

describe('Deposits & Damage Claims (T-032)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('schedule deposit pre-auth', () => {
    it('schedules pre-auth deposit for a booking', async () => {
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

      // Schedule pre-auth deposit (e.g., 2000 THB hold)
      const preauth = await scheduleDepositPreauth(db, booking.id, 2000);

      expect(preauth.bookingId).toBe(booking.id);
      expect(preauth.amountThb).toBe(2000);
      expect(preauth.status).toBe('authorized');
      expect(preauth.authorizedAt).toBeInstanceOf(Date);
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

      // Schedule pre-auth deposit
      const preauth = await scheduleDepositPreauth(db, booking.id, 2000);
      expect(preauth.status).toBe('authorized');

      // Simulate checkout: mark booking as checked_out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
        },
      });

      // Condition report shows no damage → void the pre-auth
      const voided = await voidDepositPreauthIfClean(db, booking.id);

      expect(voided.id).toBe(preauth.id);
      expect(voided.status).toBe('voided');
      expect(voided.voidedAt).toBeInstanceOf(Date);
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

      await scheduleDepositPreauth(db, booking.id, 2000);

      // Mark as checked out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
        },
      });

      // Void on clean checkout
      await voidDepositPreauthIfClean(db, booking.id);

      // Verify preauth is voided (not captured/charged)
      const preauth = await db.depositPreauth.findUnique({
        where: { bookingId: booking.id },
      });

      expect(preauth?.status).toBe('voided');
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

      // Schedule pre-auth deposit
      const preauth = await scheduleDepositPreauth(db, booking.id, 2000);
      expect(preauth.status).toBe('authorized');

      // Guest checks out
      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
        },
      });

      // Guest files damage claim within 48h
      const claim = await fileDepositClaim(db, {
        bookingId: booking.id,
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

      // Verify preauth is now captured
      const updated = await db.depositPreauth.findUnique({
        where: { id: preauth.id },
      });

      expect(updated?.status).toBe('captured');
      expect(updated?.capturedAt).toBeDefined();
      expect(updated?.captureViaClaimId).toBe(claim.id);
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

      const preauth = await scheduleDepositPreauth(db, booking.id, 2000);

      await db.booking.update({
        where: { id: booking.id },
        data: {
          checkedOutAt: new Date(),
        },
      });

      // Guest files claim
      const claim = await fileDepositClaim(db, {
        bookingId: booking.id,
        claimantIdentityId: guest.id,
        description: 'Alleged stain on couch',
        claimedAmountThb: 500,
      });

      // Admin rejects claim (pre-existing damage) → releases pre-auth
      const rejected = await rejectClaim(db, claim.id, 'Rejected: pre-existing damage');

      expect(rejected.status).toBe('rejected');

      // Verify preauth is voided (funds returned)
      const updated = await db.depositPreauth.findUnique({
        where: { id: preauth.id },
      });

      expect(updated?.status).toBe('voided');
      expect(updated?.voidedAt).toBeDefined();
    });
  });

  describe('the claim window survives a real check-out (T-056)', () => {
    // Every other test in this file sets `checkedOutAt` with a direct DB write.
    // That is why this defect stayed invisible: `checkOutBooking` used to void
    // the pre-authorization unconditionally, so through the actual API the
    // 48-hour claim window opened at exactly the moment the deposit became
    // uncapturable, and `getStaysOpenToClaim` counted down against a hold that
    // was already gone.
    async function stayThroughRealCheckOut() {
      const guest = await createIdentity();
      const staff = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_in',
      });
      await scheduleDepositPreauth(db, booking.id, 500000);
      await checkOutBooking(db, booking.id);
      return { booking, staff, project };
    }

    it('leaves the hold authorized after check-out, so a claim can still capture it', async () => {
      const { booking, staff } = await stayThroughRealCheckOut();

      const afterCheckout = await db.depositPreauth.findUnique({
        where: { bookingId: booking.id },
      });
      expect(afterCheckout?.status).toBe('authorized');

      const claim = await fileDepositClaim(db, {
        bookingId: booking.id,
        claimantIdentityId: staff.id,
        description: 'Broken lamp',
        claimedAmountThb: 200000,
      });
      const approved = await approveClaim(db, claim.id, 'Confirmed against the baseline report');
      expect(approved.status).toBe('approved');

      const captured = await db.depositPreauth.findUnique({
        where: { bookingId: booking.id },
      });
      expect(captured?.status).toBe('captured');
    });

    it('releases the hold once the window has closed with no claim', async () => {
      const { booking } = await stayThroughRealCheckOut();

      // Still inside the window: the guest's money stays held.
      const during = await releaseExpiredDepositPreauths(db, new Date());
      expect(during.released).toBe(0);
      expect(
        (await db.depositPreauth.findUnique({ where: { bookingId: booking.id } }))?.status
      ).toBe('authorized');

      // Past it: nothing is outstanding, so the hold goes.
      const later = new Date(Date.now() + 49 * 60 * 60 * 1000);
      const after = await releaseExpiredDepositPreauths(db, later);
      expect(after.released).toBe(1);
      expect(
        (await db.depositPreauth.findUnique({ where: { bookingId: booking.id } }))?.status
      ).toBe('voided');
    });

    it('will not release under an unresolved claim, which would destroy the money it is about', async () => {
      const { booking, staff } = await stayThroughRealCheckOut();
      await fileDepositClaim(db, {
        bookingId: booking.id,
        claimantIdentityId: staff.id,
        description: 'Disputed damage',
        claimedAmountThb: 200000,
      });

      const later = new Date(Date.now() + 49 * 60 * 60 * 1000);
      const result = await releaseExpiredDepositPreauths(db, later);
      expect(result.released).toBe(0);
      expect(
        (await db.depositPreauth.findUnique({ where: { bookingId: booking.id } }))?.status
      ).toBe('authorized');
    });

    it('is a no-op once a rejected claim has already released the hold', async () => {
      // `rejectClaim` releases the pre-auth itself — the guest keeps their
      // deposit the moment the claim fails, without waiting out the window.
      // The job must not treat that as work left to do.
      const { booking, staff } = await stayThroughRealCheckOut();
      const claim = await fileDepositClaim(db, {
        bookingId: booking.id,
        claimantIdentityId: staff.id,
        description: 'Mark on the wall',
        claimedAmountThb: 200000,
      });
      await rejectClaim(db, claim.id, 'Pre-existing, in the baseline report');

      expect(
        (await db.depositPreauth.findUnique({ where: { bookingId: booking.id } }))?.status
      ).toBe('voided');

      const later = new Date(Date.now() + 49 * 60 * 60 * 1000);
      expect((await releaseExpiredDepositPreauths(db, later)).released).toBe(0);
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
          bookingId: booking.id,
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
          bookingId: booking.id,
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
        bookingId: booking1.id,
        claimantIdentityId: guest.id,
        description: 'Damage 1',
        claimedAmountThb: 1000,
      });

      const claim2 = await fileDepositClaim(db, {
        bookingId: booking2.id,
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
      await scheduleDepositPreauth(db, booking.id, 2000);

      await db.booking.update({
        where: { id: booking.id },
        data: { checkedOutAt: new Date() },
      });

      const claim = await fileDepositClaim(db, {
        bookingId: booking.id,
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
