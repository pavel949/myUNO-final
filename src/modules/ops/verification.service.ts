import { PrismaClient, VerificationStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/encryption';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';

export interface CapturePassportDataInput {
  bookingGuestId: string;
  passportNumber: string;
  passportMediaId?: string;
}

export interface VerificationCheckResult {
  bookingId: string;
  guestIdentityId: string;
  status: VerificationStatus;
  deadline: Date;
}

/**
 * Capture passport data for a booking guest (encrypted storage).
 * Called by guest or staff during pre-arrival or at check-in door.
 */
export async function capturePassportData(
  db: PrismaClient,
  input: CapturePassportDataInput
): Promise<void> {
  const { bookingGuestId, passportNumber, passportMediaId } = input;

  const bookingGuest = await db.bookingGuest.findUnique({
    where: { id: bookingGuestId },
    include: { booking: true },
  });

  if (!bookingGuest) {
    throw new Error(`BookingGuest ${bookingGuestId} not found`);
  }

  // Encrypt the passport number before storing
  const encryptedPassport = encrypt(passportNumber);

  await db.bookingGuest.update({
    where: { id: bookingGuestId },
    data: {
      passportNumber: encryptedPassport,
      passportMediaId: passportMediaId,
    },
  });

  // If all guests in the booking have provided passports, mark as passports_received
  const booking = await db.booking.findUnique({
    where: { id: bookingGuest.bookingId },
    include: { guests: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingGuest.bookingId} not found`);
  }

  const allGuests = await db.bookingGuest.findMany({
    where: { bookingId: booking.id },
  });

  // Check if all guests have passport numbers (not all may be required)
  const allHavePassports = allGuests.every((g) => g.passportNumber);

  if (allHavePassports && allGuests.length > 0) {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        verificationStatus: 'passports_received',
      },
    });
  }
}

/**
 * Mark verification as failed when deadline is missed.
 * Triggered by the deadline job.
 */
export async function markVerificationFailed(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { project: true, guestIdentity: true, unit: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  if (booking.verificationStatus === 'failed' || booking.verificationStatus === 'passports_received') {
    return; // Already processed
  }

  await db.booking.update({
    where: { id: bookingId },
    data: {
      verificationStatus: 'failed',
    },
  });

  // Alert ops lead (N-08: stay.verification_failed)
  // Find ops lead for this project
  const opsLead = await db.roleAssignment.findFirst({
    where: {
      projectId: booking.projectId,
      role: 'staff_ops',
      status: 'active',
    },
    include: { identity: true },
  });

  if (opsLead?.identity) {
    await createNotification(db, {
      identityId: opsLead.identity.id,
      type: 'stay_verification_failed',
      titleKey: 'notify.stay.verification_failed.title',
      bodyKey: 'notify.stay.verification_failed.body',
      params: {
        guest_name: booking.guestIdentity?.firstName || 'Guest',
        unit_name: booking.unit?.name || 'Unit',
        booking_id: booking.id,
      },
    });
  }
}

/**
 * Decrypt a passport number (for viewing by authorized staff).
 * Caller is responsible for access logging.
 */
export function decryptPassportNumber(encryptedPassport: string): string {
  return decrypt(encryptedPassport);
}

/**
 * Check verification deadlines and transition statuses.
 * Called by the deadline job scheduler.
 * Returns a summary of transitions made.
 */
export async function checkVerificationDeadlines(
  db: PrismaClient
): Promise<{ checked: number; failed: number }> {
  const now = new Date();
  let checkedCount = 0;
  let failedCount = 0;

  // Get all active bookings that are pending or not_required verification
  const bookings = await db.booking.findMany({
    where: {
      status: 'confirmed',
      verificationStatus: 'pending',
    },
    include: {
      project: true,
      guestIdentity: true,
      unit: true,
    },
  });

  for (const booking of bookings) {
    checkedCount++;

    // Calculate deadline: startDate - [cfg] compliance.passport_required_hours_before_checkin
    const configHours =
      ((await getConfig(db, 'compliance.passport_required_hours_before_checkin', {
        projectId: booking.projectId,
      })) as number | undefined) || 24;

    const deadline = new Date(booking.startDate.getTime() - configHours * 60 * 60 * 1000);

    if (now >= deadline) {
      await markVerificationFailed(db, booking.id);
      failedCount++;
    }
  }

  return { checked: checkedCount, failed: failedCount };
}
