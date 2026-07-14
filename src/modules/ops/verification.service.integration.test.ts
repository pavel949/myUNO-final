import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createBookingGuest } from '@/test/util';
import {
  capturePassportData,
  markVerificationFailed,
  decryptPassportNumber,
  checkVerificationDeadlines,
} from './verification.service';
import { decrypt } from '@/lib/encryption';

describe('verification.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('capturePassportData', () => {
    it('encrypts and stores passport number', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
      });
      const bookingGuest = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });

      const testPassport = 'US1234567';
      await capturePassportData(db, {
        bookingGuestId: bookingGuest.id,
        passportNumber: testPassport,
      });

      const updated = await db.bookingGuest.findUnique({ where: { id: bookingGuest.id } });
      expect(updated).toBeTruthy();
      // Verify the stored value is encrypted (not plaintext)
      expect(updated!.passportNumber).not.toBe(testPassport);
      // Verify we can decrypt it correctly
      const decrypted = decrypt(updated!.passportNumber);
      expect(decrypted).toBe(testPassport);
    });

    it('marks verification as complete when all guests provide passports', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
        verificationStatus: 'pending',
      });
      const guest1 = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'John Doe',
        nationality: 'US',
        passportNumber: 'AB123456',
      });
      const guest2 = await createBookingGuest({
        bookingId: booking.id,
        fullName: 'Jane Doe',
        nationality: 'GB',
        passportNumber: 'CD789012',
      });

      // Capture first guest
      await capturePassportData(db, {
        bookingGuestId: guest1.id,
        passportNumber: 'US1234567',
      });

      let booking1 = await db.booking.findUnique({ where: { id: booking.id } });
      // Should still be pending (not all guests have captured)
      expect(booking1!.verificationStatus).toBe('pending');

      // Capture second guest
      await capturePassportData(db, {
        bookingGuestId: guest2.id,
        passportNumber: 'GB9876543',
      });

      const updatedBooking = await db.booking.findUnique({ where: { id: booking.id } });
      // Now should be complete
      expect(updatedBooking!.verificationStatus).toBe('passports_received');
    });

    it('throws when booking guest not found', async () => {
      await expect(
        capturePassportData(db, {
          bookingGuestId: 'nonexistent',
          passportNumber: 'TEST123',
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('decryptPassportNumber', () => {
    it('decrypts encrypted passport numbers', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      });

      const encrypted = await db.bookingGuest.create({
        data: {
          bookingId: booking.id,
          fullName: 'Test User',
          nationality: 'US',
          passportNumber: 'ENCRYPTED_VALUE',
          isLead: true,
        },
      });

      const decrypted = decryptPassportNumber(encrypted.passportNumber);
      expect(decrypted).toBe('ENCRYPTED_VALUE');
    });
  });

  describe('markVerificationFailed', () => {
    it('marks booking verification as failed', async () => {
      const ops = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
        verificationStatus: 'pending',
      });

      // Set up ops lead role
      await db.roleAssignment.create({
        data: {
          identityId: ops.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId: project.id,
          status: 'active',
        },
      });

      await markVerificationFailed(db, booking.id);

      const updated = await db.booking.findUnique({ where: { id: booking.id } });
      expect(updated!.verificationStatus).toBe('failed');

      // Verify notification was created
      const notifs = await db.notification.findMany({
        where: { identityId: ops.id },
      });
      expect(notifs.length).toBeGreaterThan(0);
    });

    it('ignores if already marked failed or received', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        verificationStatus: 'passports_received',
      });

      const notifCountBefore = await db.notification.count();
      await markVerificationFailed(db, booking.id);
      const notifCountAfter = await db.notification.count();

      expect(notifCountAfter).toBe(notifCountBefore);
    });
  });

  describe('checkVerificationDeadlines', () => {
    it('marks pending verifications as failed when deadline passes', async () => {
      const ops = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      // Create booking with startDate in the past (deadline already passed)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); // Yesterday

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
        verificationStatus: 'pending',
        startDate,
      });

      // Set up ops lead role
      await db.roleAssignment.create({
        data: {
          identityId: ops.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId: project.id,
          status: 'active',
        },
      });

      const result = await checkVerificationDeadlines(db);

      expect(result.checked).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);

      const updated = await db.booking.findUnique({ where: { id: booking.id } });
      expect(updated!.verificationStatus).toBe('failed');
    });

    it('does not mark verified or received as failed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
        verificationStatus: 'passports_received',
        startDate,
      });

      const result = await checkVerificationDeadlines(db);

      const updated = await db.booking.findUnique({ where: { id: booking.id } });
      expect(updated!.verificationStatus).toBe('passports_received');
    });

    it('returns result with checked and failed counts', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest1.id,
        status: 'confirmed',
        verificationStatus: 'pending',
        startDate,
      });

      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest2.id,
        status: 'confirmed',
        verificationStatus: 'pending',
        startDate,
      });

      const result = await checkVerificationDeadlines(db);

      expect(result.checked).toBe(2);
      expect(result.failed).toBe(2);
    });
  });
});
