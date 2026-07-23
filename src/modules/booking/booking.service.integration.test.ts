import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import * as bookingService from './booking.service';
import { getInStayHomeSpace } from './home-space.service';

describe('booking.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('createBooking', () => {
    it('creates an instant booking in pending_payment status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      expect(booking.status).toBe('pending_payment');
      expect(booking.unitId).toBe(unit.id);
      expect(booking.guestIdentityId).toBe(guest.id);
      expect(booking.holdExpiresAt).toBeDefined();
      expect(booking.requestExpiresAt).toBeNull();
    });

    it('creates a request-to-book booking in requested status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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
      expect(booking.holdExpiresAt).toBeNull();
      expect(booking.requestExpiresAt).toBeDefined();
    });

    it('prevents double-booking with confirmed reservation', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create first confirmed booking
      await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      // Confirm it
      const confirmed = await db.booking.findFirst({
        where: { guestIdentityId: guest1.id },
      });
      await db.booking.update({
        where: { id: confirmed!.id },
        data: { status: 'confirmed' },
      });

      // Try to book overlapping dates
      let caught: any;
      try {
        await bookingService.createBooking(db, {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-07'),
          adults: 2,
          children: 0,
          totalThb: 8000,
          instantBook: true,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      expect(caught.code).toBe('DOUBLE_BOOK');
    });

    it('prevents double-booking with checked_in reservation', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create and mark checked-in
      await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const booking = await db.booking.findFirst({
        where: { guestIdentityId: guest1.id },
      });
      await db.booking.update({
        where: { id: booking!.id },
        data: { status: 'checked_in', checkedInAt: new Date() },
      });

      // Try to book overlapping dates
      await expect(
        bookingService.createBooking(db, {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-07'),
          adults: 2,
          children: 0,
          totalThb: 8000,
          instantBook: true,
        })
      ).rejects.toThrow('unavailable');
    });

    it('prevents double-booking with pending_payment hold', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create pending booking
      await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      // Try to book overlapping dates (should fail)
      await expect(
        bookingService.createBooking(db, {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2026-08-02'),
          endDate: new Date('2026-08-06'),
          adults: 2,
          children: 0,
          totalThb: 8000,
          instantBook: true,
        })
      ).rejects.toThrow('unavailable');
    });

    it('allows re-booking dates whose pending hold has expired', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // First guest starts a hold, then abandons it (hold expires in the past)
      const abandoned = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });
      await db.booking.update({
        where: { id: abandoned.id },
        data: { holdExpiresAt: new Date('2026-01-01') }, // expired
      });

      // Second guest can now book the same dates — the dead hold must not block
      const rebooked = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-02'),
        endDate: new Date('2026-08-06'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });
      expect(rebooked.status).toBe('pending_payment');
    });

    it('allows booking non-overlapping dates', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create first booking
      const booking1 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      // Confirm it
      await db.booking.update({
        where: { id: booking1.id },
        data: { status: 'confirmed' },
      });

      // Book after the first booking
      const booking2 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-05'),
        endDate: new Date('2026-08-10'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      expect(booking2.id).toBeDefined();
      expect(booking2.status).toBe('pending_payment');
    });

    it('sets custom hold and request durations', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const now = new Date();

      const booking = await bookingService.createBooking(db, {
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
        holdMinutes: 60,
      });

      const diff = booking.holdExpiresAt!.getTime() - now.getTime();
      expect(diff).toBeGreaterThan(59 * 60 * 1000); // at least 59 minutes
      expect(diff).toBeLessThanOrEqual(61 * 60 * 1000); // at most 61 minutes
    });
  });

  describe('approveBookingRequest', () => {
    it('transitions requested → pending_payment', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const approved = await bookingService.approveBookingRequest(db, {
        bookingId: booking.id,
      });

      expect(approved.status).toBe('pending_payment');
      expect(approved.holdExpiresAt).toBeDefined();
      expect(approved.requestExpiresAt).toBeNull();
    });

    it('rejects approval when not in requested status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await expect(
        bookingService.approveBookingRequest(db, { bookingId: booking.id })
      ).rejects.toThrow('Cannot approve booking with status pending_payment');
    });

    it('throws error when booking not found', async () => {
      await expect(
        bookingService.approveBookingRequest(db, { bookingId: 'nonexistent' })
      ).rejects.toThrow('not found');
    });
  });

  describe('declineBookingRequest', () => {
    it('transitions requested → declined', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const host = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const declined = await bookingService.declineBookingRequest(db, {
        bookingId: booking.id,
        declinedByIdentityId: host.id,
      });

      expect(declined.status).toBe('declined');
      expect(declined.cancellationReason).toBe('declined_by_host');
      expect(declined.requestExpiresAt).toBeNull();
      expect(declined.cancelledByIdentityId).toBe(host.id);
    });

    it('rejects decline when not in requested status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await expect(
        bookingService.declineBookingRequest(db, { bookingId: booking.id })
      ).rejects.toThrow('Cannot decline booking with status pending_payment');
    });
  });

  describe('confirmBooking', () => {
    it('transitions pending_payment → confirmed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const confirmed = await bookingService.confirmBooking(db, {
        bookingId: booking.id,
        paymentReceivedAt: new Date(),
      });

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.holdExpiresAt).toBeNull();
    });

    it('rejects confirmation when not in pending_payment status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await expect(
        bookingService.confirmBooking(db, {
          bookingId: booking.id,
          paymentReceivedAt: new Date(),
        })
      ).rejects.toThrow('Cannot confirm booking with status requested');
    });
  });

  describe('cancelBooking', () => {
    it('cancels a pending_payment booking', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const canceller = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const cancelled = await bookingService.cancelBooking(db, {
        bookingId: booking.id,
        cancelledByIdentityId: canceller.id,
        reason: 'guest_requested',
        refundAmountThb: 8000,
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.refundAccruedThb).toBe(8000);
      expect(cancelled.cancellationReason).toBe('guest_requested');
      expect(cancelled.holdExpiresAt).toBeNull();
      expect(cancelled.requestExpiresAt).toBeNull();
    });

    it('cancels a confirmed booking', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const canceller = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' },
      });

      const cancelled = await bookingService.cancelBooking(db, {
        bookingId: booking.id,
        cancelledByIdentityId: canceller.id,
        reason: 'host_requested',
        refundAmountThb: 6000,
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.refundAccruedThb).toBe(6000);
    });

    it('cancels a checked_in booking', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const canceller = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_in', checkedInAt: new Date() },
      });

      const cancelled = await bookingService.cancelBooking(db, {
        bookingId: booking.id,
        cancelledByIdentityId: canceller.id,
        reason: 'emergency',
        refundAmountThb: 0,
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.refundAccruedThb).toBe(0);
    });

    it('rejects cancellation of invalid statuses', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const canceller = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'declined' },
      });

      await expect(
        bookingService.cancelBooking(db, {
          bookingId: booking.id,
          cancelledByIdentityId: canceller.id,
          reason: 'test',
          refundAmountThb: 0,
        })
      ).rejects.toThrow('Cannot cancel booking with status declined');
    });
  });

  describe('checkInBooking', () => {
    it('transitions confirmed → checked_in', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' },
      });

      const checkedIn = await bookingService.checkInBooking(db, booking.id);

      expect(checkedIn.status).toBe('checked_in');
      expect(checkedIn.checkedInAt).toBeDefined();
    });

    it('rejects check-in when not confirmed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await expect(
        bookingService.checkInBooking(db, booking.id)
      ).rejects.toThrow('Cannot check in booking with status pending_payment');
    });
  });

  describe('checkOutBooking', () => {
    it('transitions checked_in → checked_out', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_in', checkedInAt: new Date() },
      });

      const checkedOut = await bookingService.checkOutBooking(db, booking.id);

      expect(checkedOut.status).toBe('checked_out');
      expect(checkedOut.checkedOutAt).toBeDefined();
    });

    it('rejects check-out when not checked-in', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' },
      });

      await expect(
        bookingService.checkOutBooking(db, booking.id)
      ).rejects.toThrow('Cannot check out booking with status confirmed');
    });
  });

  describe('completeBooking', () => {
    it('transitions checked_out → completed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_out', checkedOutAt: new Date() },
      });

      const completed = await bookingService.completeBooking(db, booking.id);

      expect(completed.status).toBe('completed');
    });

    it('rejects completion when not checked-out', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_in', checkedInAt: new Date() },
      });

      await expect(
        bookingService.completeBooking(db, booking.id)
      ).rejects.toThrow('Cannot complete booking with status checked_in');
    });
  });

  describe('expireHolds', () => {
    it('expires pending_payment holds past expiration time', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create booking with hold that expires in 1 minute
      const booking1 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
        holdMinutes: 1,
      });

      // Create another one with later expiration
      const booking2 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-15'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
        holdMinutes: 120,
      });

      // Manually set first booking's hold to past time
      await db.booking.update({
        where: { id: booking1.id },
        data: { holdExpiresAt: new Date(Date.now() - 5 * 60 * 1000) },
      });

      const expiredCount = await bookingService.expireHolds(db);

      expect(expiredCount).toBe(1);

      const expired = await db.booking.findUnique({ where: { id: booking1.id } });
      expect(expired?.status).toBe('expired');
      expect(expired?.holdExpiresAt).toBeNull();

      const notExpired = await db.booking.findUnique({ where: { id: booking2.id } });
      expect(notExpired?.status).toBe('pending_payment');
      expect(notExpired?.holdExpiresAt).toBeDefined();
    });

    it('does not expire confirmed bookings', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      // Confirm it
      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed', holdExpiresAt: new Date(Date.now() - 10 * 60 * 1000) },
      });

      const expiredCount = await bookingService.expireHolds(db);

      expect(expiredCount).toBe(0);

      const notExpired = await db.booking.findUnique({ where: { id: booking.id } });
      expect(notExpired?.status).toBe('confirmed');
    });
  });

  describe('autoDeclineRequests', () => {
    it('auto-declines requested bookings past deadline', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create request-to-book bookings
      const booking1 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: false,
        requestHours: 1,
      });

      const booking2 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-15'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: false,
        requestHours: 48,
      });

      // Manually set first booking's request expiry to past
      await db.booking.update({
        where: { id: booking1.id },
        data: { requestExpiresAt: new Date(Date.now() - 5 * 60 * 1000) },
      });

      const declinedCount = await bookingService.autoDeclineRequests(db);

      expect(declinedCount).toBe(1);

      const autoDeclined = await db.booking.findUnique({ where: { id: booking1.id } });
      expect(autoDeclined?.status).toBe('declined');
      expect(autoDeclined?.cancellationReason).toBe('auto_declined_timeout');
      expect(autoDeclined?.requestExpiresAt).toBeNull();

      const notDeclined = await db.booking.findUnique({ where: { id: booking2.id } });
      expect(notDeclined?.status).toBe('requested');
      expect(notDeclined?.requestExpiresAt).toBeDefined();
    });

    it('does not auto-decline approved bookings', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      // Approve the request
      await bookingService.approveBookingRequest(db, { bookingId: booking.id });

      // Try to auto-decline (should not affect pending_payment bookings)
      const declinedCount = await bookingService.autoDeclineRequests(db);

      expect(declinedCount).toBe(0);

      const notDeclined = await db.booking.findUnique({ where: { id: booking.id } });
      expect(notDeclined?.status).toBe('pending_payment');
    });
  });

  describe('getBooking', () => {
    it('retrieves a booking with all includes', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const retrieved = await bookingService.getBooking(db, booking.id);

      expect(retrieved?.id).toBe(booking.id);
      expect(retrieved?.unit).toBeDefined();
      expect(retrieved?.guestIdentity).toBeDefined();
      expect(Array.isArray(retrieved?.guests)).toBe(true);
      expect(Array.isArray(retrieved?.changes)).toBe(true);
    });

    it('returns null for nonexistent booking', async () => {
      const retrieved = await bookingService.getBooking(db, 'nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getUnitBookings', () => {
    it('retrieves all bookings for a unit', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      const booking1 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      const booking2 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        adults: 1,
        children: 0,
        totalThb: 5000,
        instantBook: false,
      });

      const bookings = await bookingService.getUnitBookings(db, unit.id);

      expect(bookings).toHaveLength(2);
      expect(bookings[0].startDate < bookings[1].startDate).toBe(true);
    });

    it('filters by date range', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        adults: 1,
        children: 0,
        totalThb: 5000,
        instantBook: false,
      });

      const filtered = await bookingService.getUnitBookings(
        db,
        unit.id,
        new Date('2026-09-01'),
        new Date('2026-09-30')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].startDate.getMonth()).toBe(8); // September
    });
  });

  describe('getGuestBookings', () => {
    it('retrieves all bookings for a guest, ordered by date desc', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking1 = await bookingService.createBooking(db, {
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

      const booking2 = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        adults: 1,
        children: 0,
        totalThb: 5000,
        instantBook: false,
      });

      const bookings = await bookingService.getGuestBookings(db, guest.id);

      expect(bookings).toHaveLength(2);
      expect(bookings[0].startDate > bookings[1].startDate).toBe(true);
    });
  });

  describe('getInStayHomeSpace (D1)', () => {
    it('returns booking details, active orders, and announcements for an authorized guest', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const booking = await bookingService.createBooking(db, {
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

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.booking.id).toBe(booking.id);
      expect(data.booking.startDate).toBe(booking.startDate.toISOString());
      expect(data.booking.endDate).toBe(booking.endDate.toISOString());
      expect(data.activeOrders).toEqual([]);
      expect(data.announcements).toEqual([]);
    });

    it('rejects access when guestIdentityId does not match the booking guest', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      const booking = await bookingService.createBooking(db, {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        instantBook: true,
      });

      await expect(getInStayHomeSpace(db, booking.id, guest2.id)).rejects.toThrow('Access denied');
    });

    it('throws when booking is not found', async () => {
      const guest = await createIdentity();
      await expect(getInStayHomeSpace(db, 'nonexistent-id', guest.id)).rejects.toThrow('Booking not found');
    });
  });
});
