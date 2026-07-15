import { PrismaClient, BlockedDateReason, Booking } from '@prisma/client';
import { recordIntegrationSync } from './integrations';

export interface ICalEvent {
  uid: string; // Unique identifier for idempotency
  summary: string;
  dtStart: Date;
  dtEnd: Date;
  description?: string;
}

export interface ICalImportResult {
  imported: number;
  conflicts: Array<{
    event: ICalEvent;
    conflictingBooking: Booking;
  }>;
  errors: Array<{
    event: ICalEvent;
    error: string;
  }>;
}

/**
 * Check if an OTA booking (date range) overlaps with any platform booking or block.
 * Platform bookings/blocks win; OTA overlaps are conflicts to be resolved manually.
 */
async function checkForConflicts(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date,
  excludeUid?: string, // UID to exclude from conflict check (for idempotency)
): Promise<Booking | null> {
  // Find any confirmed booking that overlaps this range
  const conflicting = await db.booking.findFirst({
    where: {
      unitId,
      status: { in: ['pending_payment', 'confirmed', 'checked_in', 'checked_out', 'completed'] },
      // Overlap check: booking.start < this.end AND booking.end > this.start
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      // Exclude self if re-importing the same UID
      externalRef: excludeUid ? { not: excludeUid } : undefined,
    },
  });

  return conflicting || null;
}

/**
 * Check if a blocked date already exists for this UID (idempotency).
 */
async function getExistingBlockedDate(db: PrismaClient, unitId: string, uid: string) {
  return await db.blockedDate.findFirst({
    where: {
      unitId,
      externalRef: uid,
    },
  });
}

/**
 * Import OTA bookings from iCal events, creating BlockedDate entries (reason: ota_import)
 * and detecting conflicts with platform bookings. Conflicts are logged but not created.
 *
 * Idempotency: uses externalRef (OTA UID) to prevent duplicate imports.
 */
export async function importICalEvents(
  db: PrismaClient,
  integrationAccountId: string,
  unitId: string,
  events: ICalEvent[],
): Promise<ICalImportResult> {
  const result: ICalImportResult = {
    imported: 0,
    conflicts: [],
    errors: [],
  };

  try {
    for (const event of events) {
      try {
        // Check for conflicts with platform bookings
        const conflictingBooking = await checkForConflicts(
          db,
          unitId,
          event.dtStart,
          event.dtEnd,
          event.uid,
        );

        if (conflictingBooking) {
          result.conflicts.push({
            event,
            conflictingBooking,
          });
          continue; // Don't import if conflict detected
        }

        // Check if already imported (idempotency via externalRef)
        const existing = await getExistingBlockedDate(db, unitId, event.uid);
        if (existing) {
          result.imported++; // Count as already imported
          continue;
        }

        // Create BlockedDate for OTA booking
        await db.blockedDate.create({
          data: {
            unitId,
            startDate: event.dtStart,
            endDate: event.dtEnd,
            reason: BlockedDateReason.ota_import,
            note: event.summary || event.description,
            externalRef: event.uid, // Store UID for idempotency
          },
        });

        result.imported++;
      } catch (error) {
        result.errors.push({
          event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Record successful sync
    await recordIntegrationSync(db, integrationAccountId);
  } catch (error) {
    // Record sync error
    const errorMsg = error instanceof Error ? error.message : String(error);
    await recordIntegrationSync(db, integrationAccountId, errorMsg);
    throw error;
  }

  return result;
}

/**
 * Mark OTA imports as conflicts and log for admin resolution (N-25).
 * Called after import to handle the conflict banners and admin alerts.
 *
 * Stub for loop one: In production, this would:
 * 1. Find ops staff identities for this project
 * 2. Create notification for each with type='ops_ical_conflict'
 * 3. Set params JSON with conflict details (event UID, dates, booking ID)
 * 4. Use titleKey/bodyKey from content layer (N-25)
 */
export async function createConflictNotifications(
  conflicts: Array<{
    event: ICalEvent;
    conflictingBooking: Booking;
  }>,
) {
  if (conflicts.length > 0) {
    console.warn(
      `[iCal import] ${conflicts.length} conflicts detected; create N-25 notifications when ops identity routing available`
    );
  }
}

/**
 * Remove OTA-imported blocked dates for a unit (cleanup before re-sync).
 */
export async function clearOtaImports(db: PrismaClient, unitId: string) {
  return await db.blockedDate.deleteMany({
    where: {
      unitId,
      reason: BlockedDateReason.ota_import,
    },
  });
}
