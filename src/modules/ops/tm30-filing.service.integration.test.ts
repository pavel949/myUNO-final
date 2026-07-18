import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createBookingGuest } from '@/test/util';
import {
  createTm30Filing,
  markTm30FilingFiled,
  markTm30FilingFailed,
  getTm30Queue,
  createConditionReport,
  getConditionReport,
} from './tm30-filing.service';

describe('tm30-filing.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('createTm30Filing', () => {
    it('creates a filing with 24h default SLA', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
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

      const result = await createTm30Filing(db, {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
      });

      expect(result.id).toBeTruthy();
      const filing = await db.tm30Filing.findUnique({ where: { id: result.id } });
      expect(filing).toBeTruthy();
      expect(filing!.status).toBe('pending');

      // Verify dueAt is ~24h from check-in
      const expectedDue = new Date(booking.startDate.getTime() + 24 * 60 * 60 * 1000);
      expect(Math.abs(filing!.dueAt.getTime() - expectedDue.getTime())).toBeLessThan(1000);
    });

    it('throws when booking not found', async () => {
      await expect(
        createTm30Filing(db, {
          bookingId: 'nonexistent',
          bookingGuestId: 'guest-id',
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('markTm30FilingFiled', () => {
    it('marks filing as filed with receipt', async () => {
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

      await markTm30FilingFiled(db, filing.id, staff.id);

      const updated = await db.tm30Filing.findUnique({ where: { id: filing.id } });
      expect(updated!.status).toBe('filed');
      expect(updated!.filedAt).toBeTruthy();
      expect(updated!.filedByIdentityId).toBe(staff.id);
    });

    it('throws when filing not in pending/escalated', async () => {
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
      await markTm30FilingFiled(db, filing.id, staff.id);

      // Try to mark again
      await expect(markTm30FilingFiled(db, filing.id, staff.id)).rejects.toThrow('Cannot file');
    });
  });

  describe('markTm30FilingFailed', () => {
    it('marks filing as failed and sets escalation', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
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

      await markTm30FilingFailed(db, filing.id, 'Rejected by Immigration Office');

      const updated = await db.tm30Filing.findUnique({ where: { id: filing.id } });
      expect(updated!.status).toBe('failed');
      expect(updated!.failureNote).toBe('Rejected by Immigration Office');
      expect(updated!.escalatedAt).toBeTruthy();
    });

    it('notifies ops on first escalation', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
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

      // Ops lead who should receive the escalation notification
      const ops = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: ops.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId: project.id,
          status: 'active',
        },
      });

      const notificationsBefore = await db.notification.count();
      await markTm30FilingFailed(db, filing.id, 'Rejected by Immigration Office');
      const notificationsAfter = await db.notification.count();

      expect(notificationsAfter).toBe(notificationsBefore + 1);
    });
  });

  describe('getTm30Queue', () => {
    it('returns filings sorted by due_at', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      const booking1 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        startDate: new Date('2026-07-15'),
      });
      const bookingGuest1 = await createBookingGuest({
        bookingId: booking1.id,
        fullName: 'Guest 1',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const booking2 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        startDate: new Date('2026-07-16'),
      });
      const bookingGuest2 = await createBookingGuest({
        bookingId: booking2.id,
        fullName: 'Guest 2',
        nationality: 'US',
        passportNumber: 'CD789012',
      });

      await createTm30Filing(db, { bookingId: booking1.id, bookingGuestId: bookingGuest1.id });
      await createTm30Filing(db, { bookingId: booking2.id, bookingGuestId: bookingGuest2.id });

      const queue = await getTm30Queue(db, project.id);

      expect(queue.length).toBe(2);
      expect(queue[0].bookingId).toBe(booking1.id);
      expect(queue[1].bookingId).toBe(booking2.id);
    });

    it('filters by status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();
      const staff = await createIdentity();

      const booking1 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
      });
      const bookingGuest1 = await createBookingGuest({
        bookingId: booking1.id,
        fullName: 'Guest 1',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const booking2 = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
      });
      const bookingGuest2 = await createBookingGuest({
        bookingId: booking2.id,
        fullName: 'Guest 2',
        nationality: 'US',
        passportNumber: 'CD789012',
      });

      const filing1 = await createTm30Filing(db, { bookingId: booking1.id, bookingGuestId: bookingGuest1.id });
      const filing2 = await createTm30Filing(db, { bookingId: booking2.id, bookingGuestId: bookingGuest2.id });

      // Mark one as filed
      await markTm30FilingFiled(db, filing1.id, staff.id);

      // Query only pending
      const pending = await getTm30Queue(db, project.id, ['pending']);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(filing2.id);

      // Query only filed
      const filed = await getTm30Queue(db, project.id, ['filed']);
      expect(filed.length).toBe(1);
      expect(filed[0].id).toBe(filing1.id);
    });
  });

  describe('createConditionReport', () => {
    it('creates a condition report', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();

      const result = await createConditionReport(db, {
        unitId: unit.id,
        reportType: 'check_in',
        notes: 'All good on arrival',
        createdByIdentityId: staff.id,
      });

      expect(result.id).toBeTruthy();
      const report = await db.conditionReport.findUnique({ where: { id: result.id } });
      expect(report).toBeTruthy();
      expect(report!.reportType).toBe('check_in');
      expect(report!.notes).toBe('All good on arrival');
    });

    it('attaches photos if provided', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();
      const uploader = await createIdentity();

      // Create media assets for photos
      const photo1 = await db.mediaAsset.create({
        data: {
          storageKey: 'photo1.jpg',
          kind: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadedByIdentityId: uploader.id,
        },
      });

      const photo2 = await db.mediaAsset.create({
        data: {
          storageKey: 'photo2.jpg',
          kind: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          uploadedByIdentityId: uploader.id,
        },
      });

      const result = await createConditionReport(db, {
        unitId: unit.id,
        reportType: 'check_out',
        notes: 'Checkout complete',
        createdByIdentityId: staff.id,
        photoMediaIds: [photo1.id, photo2.id],
      });

      const report = await db.conditionReport.findUnique({
        where: { id: result.id },
        include: { media: true },
      });

      expect(report!.media.length).toBe(2);
      expect(report!.media[0].sort).toBe(0);
      expect(report!.media[1].sort).toBe(1);
      expect(report!.reportType).toBe('check_out');
    });
  });

  describe('getConditionReport', () => {
    it('retrieves report with photos', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();
      const uploader = await createIdentity();

      const photo = await db.mediaAsset.create({
        data: {
          storageKey: 'photo.jpg',
          kind: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadedByIdentityId: uploader.id,
        },
      });

      const created = await createConditionReport(db, {
        unitId: unit.id,
        reportType: 'baseline',
        createdByIdentityId: staff.id,
        photoMediaIds: [photo.id],
      });

      const { report, photos } = await getConditionReport(db, created.id);

      expect(report).toBeTruthy();
      expect(report.reportType).toBe('baseline');
      expect(photos.length).toBe(1);
      expect(photos[0].mediaId).toBe(photo.id);
    });

    it('throws when report not found', async () => {
      await expect(getConditionReport(db, 'nonexistent')).rejects.toThrow('not found');
    });
  });
});
