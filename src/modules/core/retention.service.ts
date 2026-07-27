import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';

/**
 * Scrub passport data for bookings checked out more than
 * `[cfg] retention.passport_media_days_after_checkout` days ago (doc 12 §6):
 * clears the encrypted passport number and date of birth, and marks any
 * passport scan for deletion (picked up by deleteExpiredMediaAssets).
 * The guest's name stays (it is on the booking record for statements);
 * identity anonymization handles full erasure separately.
 */
export async function scrubExpiredPassportData(
  db: PrismaClient
): Promise<{ scrubbedGuests: number; mediaMarked: number }> {
  const days =
    ((await getConfig(db, 'retention.passport_media_days_after_checkout')) as
      | number
      | undefined) ?? 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const guests = await db.bookingGuest.findMany({
    where: {
      OR: [{ passportNumber: { not: '' } }, { passportMediaId: { not: null } }],
      booking: {
        checkedOutAt: { not: null, lte: cutoff },
      },
    },
    select: { id: true, passportMediaId: true },
  });

  let mediaMarked = 0;
  const now = new Date();
  for (const guest of guests) {
    if (guest.passportMediaId) {
      await db.mediaAsset.update({
        where: { id: guest.passportMediaId },
        data: { deleteAfter: now },
      });
      mediaMarked++;
    }
    await db.bookingGuest.update({
      where: { id: guest.id },
      data: {
        passportNumber: '',
        dateOfBirth: null,
        passportMediaId: null,
      },
    });
  }

  return { scrubbedGuests: guests.length, mediaMarked };
}

/**
 * Delete expired media assets (passport images, documents past their delete_after date).
 * Called daily by scheduled job.
 */
export async function deleteExpiredMediaAssets(
  db: PrismaClient
): Promise<{ deleted: number }> {
  const now = new Date();

  const result = await db.mediaAsset.deleteMany({
    where: {
      deleteAfter: {
        lte: now,
      },
    },
  });

  return { deleted: result.count };
}

/**
 * Anonymize identities with deletion requests past their grace period.
 * Sets name to "Deleted user", nulls contact fields, but preserves financial/compliance records.
 * The deletion request and outcome are audit-logged.
 */
export async function anonymizeDeletedIdentities(
  db: PrismaClient,
  gracePeriodDays: number = 30
): Promise<{ anonymized: number; auditedCount: number }> {
  const now = new Date();
  const graceDeadline = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

  // Deletion requests carry their own status: `merged` means a duplicate
  // folded into another identity (merged_into_id) and must NEVER be
  // anonymized by this job (DM-4 — the old overload would have destroyed
  // genuinely merged identities).
  const identities = await db.identity.findMany({
    where: {
      status: 'deletion_requested',
      // And where the update happened past the grace period
      updatedAt: { lte: graceDeadline },
    },
  });

  let anonymizedCount = 0;

  for (const identity of identities) {
    // Anonymize the identity
    await db.identity.update({
      where: { id: identity.id },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        latinFirstName: null,
        latinLastName: null,
        email: null,
        phone: null,
        avatarMediaId: null,
      },
    });

    // Audit log the anonymization
    await db.auditLog.create({
      data: {
        action: 'identity_anonymized',
        entityType: 'identity',
        entityId: identity.id,
        actorIdentityId: null, // System-initiated action; no acting identity
        data: {
          reason: 'deletion_request_grace_period_expired',
          gracePeriodDays,
        } as any,
      },
    });

    anonymizedCount++;
  }

  return {
    anonymized: anonymizedCount,
    auditedCount: anonymizedCount,
  };
}

/**
 * Expire stale one-time tokens (verification, password reset, claim links).
 * Called daily by scheduled job.
 */
export async function expireOldTokens(db: PrismaClient): Promise<{ deleted: number }> {
  const now = new Date();

  const result = await db.oneTimeToken.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });

  return { deleted: result.count };
}

/**
 * Generate a data export for an identity (GDPR/PDPA data-subject rights).
 * Returns the identity's own data minus other identities' personal information.
 * Excludes 🔒 fields (encrypted data) from the export.
 */
export async function exportIdentityData(
  db: PrismaClient,
  identityId: string
): Promise<any> {
  const identity = await db.identity.findUnique({
    where: { id: identityId },
  });

  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  // Export identity's own data (exclude hashed password)
  const identityExport = {
    id: identity.id,
    firstName: identity.firstName,
    lastName: identity.lastName,
    latinFirstName: identity.latinFirstName,
    latinLastName: identity.latinLastName,
    email: identity.email,
    phone: identity.phone,
    preferredLocale: identity.preferredLocale,
    status: identity.status,
    isAdmin: identity.isAdmin,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };

  // Get bookings made by this identity
  const bookings = await db.booking.findMany({
    where: { guestIdentityId: identityId },
    include: {
      unit: {
        include: {
          project: true,
        },
      },
    },
  });

  // Get units owned by this identity
  const units = await db.unit.findMany({
    where: { ownerIdentityId: identityId },
    include: {
      project: true,
      engagements: {
        include: {
          owner: false, // Don't include other owner data
        },
      },
    },
  });

  // Get roles assigned to this identity
  const roles = await db.roleAssignment.findMany({
    where: { identityId },
    include: {
      project: true,
      unit: true,
    },
  });

  // Get messages sent by this identity (not received, which would include others' data)
  const messages = await db.message.findMany({
    where: { senderIdentityId: identityId },
    include: {
      thread: {
        select: {
          id: true,
          contextType: true,
          contextId: true,
          lastMessageAt: true,
        },
      },
    },
  });

  // Get notifications for this identity
  const notifications = await db.notification.findMany({
    where: { identityId },
  });

  // Get reviews authored by this identity (note: using relation filter)
  const reviews = await db.review.findMany({
    where: {
      author: {
        id: identityId,
      },
    },
  });

  // Get guest reviews authored by this identity (as a host)
  // Note: GuestReview model may not exist in schema, skipping for now
  const guestReviews: any[] = [];

  // Get audit log entries related to actions by this identity
  const auditEntries = await db.auditLog.findMany({
    where: { actorIdentityId: identityId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    exportedAt: new Date(),
    identity: identityExport,
    bookings: bookings.map((b: any) => ({
      id: b.id,
      unitId: b.unitId,
      status: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      totalPrice: b.totalPrice,
      guestCount: b.guestCount,
      bookingType: b.bookingType,
      createdAt: b.createdAt,
    })),
    units: units.map((u: any) => ({
      id: u.id,
      projectId: u.projectId,
      status: u.status,
      createdAt: u.createdAt,
    })),
    roles,
    messages: messages.map((m: any) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      threadId: m.thread.id,
    })),
    notifications: notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
    })),
    reviews: reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    guestReviews: guestReviews.map((gr: any) => ({
      id: gr.id,
      rating: gr.rating,
      comment: gr.comment,
      createdAt: gr.createdAt,
    })),
    auditEntries,
  };
}

/**
 * Run all retention jobs (called daily by scheduled job).
 * Returns aggregate stats.
 */
export async function runRetentionJobs(
  db: PrismaClient
): Promise<{
  deletedMedia: number;
  anonymizedIdentities: number;
  expiredTokens: number;
  scrubbedPassports: number;
}> {
  // Scrub first so freshly-marked passport media is deleted in the same run.
  const passportResult = await scrubExpiredPassportData(db);
  const mediaResult = await deleteExpiredMediaAssets(db);
  const identityResult = await anonymizeDeletedIdentities(db);
  const tokenResult = await expireOldTokens(db);

  return {
    deletedMedia: mediaResult.deleted,
    anonymizedIdentities: identityResult.anonymized,
    expiredTokens: tokenResult.deleted,
    scrubbedPassports: passportResult.scrubbedGuests,
  };
}

/**
 * Initiate a deletion request for an identity.
 * Logs the request in the audit trail. Actual deletion happens after grace period.
 * Marks the identity status deletion_requested; the retention job anonymizes it after the grace period.
 */
export async function requestIdentityDeletion(
  db: PrismaClient,
  identityId: string
): Promise<void> {
  const identity = await db.identity.findUnique({
    where: { id: identityId },
  });

  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  // Mark for deletion with the dedicated status — never 'merged', which
  // means a duplicate folded into another identity (doc 02 §2.1).
  await db.identity.update({
    where: { id: identityId },
    data: {
      status: 'deletion_requested',
    },
  });

  // Audit log the deletion request
  await db.auditLog.create({
    data: {
      action: 'identity_deletion_requested',
      entityType: 'identity',
      entityId: identityId,
      actorIdentityId: identityId, // The user requested their own deletion
      data: {
        gracePeriodDays: 30,
        deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } as any,
    },
  });
}
