import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createBookingGuest } from '@/test/util';
import { decrypt } from '@/lib/encryption';

describe('POST /api/bookings/[id]/verify-passports', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('encrypts and stores passport data when guest submits', async () => {
    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      verificationStatus: 'pending',
    });
    const bookingGuest = await createBookingGuest({
      bookingId: booking.id,
      fullName: 'John Doe',
      nationality: 'US',
      passportNumber: 'PLACEHOLDER',
    });

    // Verify that captured passport data is encrypted
    // We simulate the API call by directly calling the service
    const { capturePassportData } = await import('@/modules/ops');

    const testPassportNumber = 'US1234567890';
    await capturePassportData(db, {
      bookingGuestId: bookingGuest.id,
      passportNumber: testPassportNumber,
    });

    const stored = await db.bookingGuest.findUnique({
      where: { id: bookingGuest.id },
    });

    // Verify raw DB value is not plaintext
    expect(stored!.passportNumber).not.toBe(testPassportNumber);
    expect(stored!.passportNumber).toContain(':'); // Contains IV:authTag:ciphertext format

    // Verify we can decrypt it
    const decrypted = decrypt(stored!.passportNumber);
    expect(decrypted).toBe(testPassportNumber);
  });

  it('marks verification complete when all guests provide passports', async () => {
    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);
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
      passportNumber: 'PLACEHOLDER',
    });

    const guest2 = await createBookingGuest({
      bookingId: booking.id,
      fullName: 'Jane Doe',
      nationality: 'GB',
      passportNumber: 'PLACEHOLDER',
    });

    const { capturePassportData } = await import('@/modules/ops');

    // Capture both guests
    await capturePassportData(db, {
      bookingGuestId: guest1.id,
      passportNumber: 'US1234567890',
    });

    await capturePassportData(db, {
      bookingGuestId: guest2.id,
      passportNumber: 'GB9876543210',
    });

    const updatedBooking = await db.booking.findUnique({
      where: { id: booking.id },
    });

    expect(updatedBooking!.verificationStatus).toBe('passports_received');
  });

  it('handles verification deadline failure', async () => {
    const ops = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);
    const guest = await createIdentity();

    // Create booking with startDate in the past
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

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

    const { checkVerificationDeadlines } = await import('@/modules/ops');

    const result = await checkVerificationDeadlines(db);

    expect(result.failed).toBeGreaterThan(0);

    const updatedBooking = await db.booking.findUnique({
      where: { id: booking.id },
    });

    expect(updatedBooking!.verificationStatus).toBe('failed');

    // Verify notification was created for ops
    const notifications = await db.notification.findMany({
      where: { identityId: ops.id },
    });

    expect(notifications.length).toBeGreaterThan(0);
  });
});
