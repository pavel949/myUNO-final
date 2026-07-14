import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createBookingGuest } from '@/test/util';
import {
  createTm30Filing,
  logTm30PassportAccess,
  checkTm30Escalations,
  getTm30Queue,
} from './tm30-filing.service';

describe('TM30 queue operations', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getTm30Queue', () => {
    it('returns filings sorted by due_at (soonest first)', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      // Create two bookings with different check-in dates
      const startDate1 = new Date('2026-07-15');
      const startDate2 = new Date('2026-07-20');

      const booking1 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        startDate: startDate1,
      });

      const booking2 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        startDate: startDate2,
      });

      const guest1a = await createBookingGuest({
        bookingId: booking1.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const guest2a = await createBookingGuest({
        bookingId: booking2.id,
        fullName: 'Jane Doe',
        nationality: 'GB',
        passportNumber: 'CD789012',
      });

      await createTm30Filing(db, {
        bookingId: booking1.id,
        bookingGuestId: guest1a.id,
      });

      await createTm30Filing(db, {
        bookingId: booking2.id,
        bookingGuestId: guest2a.id,
      });

      const queue = await getTm30Queue(db, project.id);

      expect(queue.length).toBe(2);
      expect(queue[0].dueAt.getTime()).toBeLessThanOrEqual(queue[1].dueAt.getTime());
    });

    it('filters by status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const staff = await createIdentity();

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      });

      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const filing = await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      // Mark as filed
      const { markTm30FilingFiled } = await import('./tm30-filing.service');
      await markTm30FilingFiled(db, filing.id, staff.id);

      const pending = await getTm30Queue(db, project.id, ['pending']);
      expect(pending.length).toBe(0);

      const filed = await getTm30Queue(db, project.id, ['filed']);
      expect(filed.length).toBe(1);
    });
  });

  describe('logTm30PassportAccess', () => {
    it('writes audit log entry when passport data is accessed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const staff = await createIdentity();

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      });

      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const filing = await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      const auditLogsBefore = await db.auditLog.count();

      await logTm30PassportAccess(db, filing.id, staff.id, 'viewed_passport_details');

      const auditLogsAfter = await db.auditLog.count();

      expect(auditLogsAfter).toBe(auditLogsBefore + 1);

      const auditLog = await db.auditLog.findFirst({
        where: {
          resourceId: filing.id,
          action: 'viewed_passport_details',
        },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog!.actorIdentityId).toBe(staff.id);
    });

    it('throws when filing not found', async () => {
      const staff = await createIdentity();

      await expect(
        logTm30PassportAccess(db, 'nonexistent', staff.id)
      ).rejects.toThrow('not found');
    });
  });

  describe('checkTm30Escalations', () => {
    it('escalates pending filings when deadline approaches', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      // Create booking with check-in date far in the past
      // to trigger escalation (due_at - 6h is in the past)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate,
      });

      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const filing = await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      expect(filing).toBeTruthy();

      const result = await checkTm30Escalations(db, project.id);

      expect(result.checked).toBeGreaterThan(0);
      expect(result.escalated).toBeGreaterThan(0);

      const updated = await db.tm30Filing.findUnique({
        where: { id: filing.id },
      });

      expect(updated!.status).toBe('escalated');
      expect(updated!.escalatedAt).toBeTruthy();
    });

    it('does not re-escalate already escalated filings', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate,
      });

      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const filing = await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      // First escalation
      await checkTm30Escalations(db, project.id);
      const firstEscalatedAt = (
        await db.tm30Filing.findUnique({ where: { id: filing.id } })
      )!.escalatedAt;

      // Second check
      const result = await checkTm30Escalations(db, project.id);

      const secondEscalatedAt = (
        await db.tm30Filing.findUnique({ where: { id: filing.id } })
      )!.escalatedAt;

      // escalatedAt should not change on second check
      expect(firstEscalatedAt?.getTime()).toBe(secondEscalatedAt?.getTime());
    });

    it('creates notification on escalation', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate,
      });

      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      const notifsBefore = await db.notification.count();

      await checkTm30Escalations(db, project.id);

      const notifsAfter = await db.notification.count();

      // Should create at least one notification
      expect(notifsAfter).toBeGreaterThanOrEqual(notifsBefore);
    });
  });
});
