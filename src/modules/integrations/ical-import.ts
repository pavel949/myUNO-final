import { PrismaClient, BlockedDateReason, Booking } from '@prisma/client';
import { recordIntegrationSync } from './integrations';
import { createNotification } from '@/modules/comms';

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
): Promise<Booking | null> {
  // Find any active platform booking that overlaps this range. Platform bookings
  // are never created from OTA imports, so there is no self to exclude here —
  // idempotency for re-imported OTA UIDs is handled by getExistingBlockedDate.
  const conflicting = await db.booking.findFirst({
    where: {
      unitId,
      status: { in: ['pending_payment', 'confirmed', 'checked_in', 'checked_out', 'completed'] },
      // Overlap check: booking.start < this.end AND booking.end > this.start
      startDate: { lt: endDate },
      endDate: { gt: startDate },
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
 * and detecting conflicts with platform bookings. A conflicting range is not
 * imported; it is returned for `createConflictNotifications` to raise.
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
        // Conflict check and block creation are one transaction, under the same
        // per-unit advisory lock `createBooking` takes. Without it the two race:
        // an import can see a free calendar while a guest is mid-checkout, and
        // both commit — the unit sold on Airbnb and here for the same nights.
        // The lock makes the two paths queue; it releases on commit or rollback.
        const outcome = await db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;

          const conflictingBooking = await checkForConflicts(
            tx as PrismaClient,
            unitId,
            event.dtStart,
            event.dtEnd,
          );
          if (conflictingBooking) {
            return { kind: 'conflict' as const, conflictingBooking };
          }

          // Idempotency via externalRef (the OTA UID).
          const existing = await getExistingBlockedDate(tx as PrismaClient, unitId, event.uid);
          if (existing) {
            return { kind: 'already-imported' as const };
          }

          await tx.blockedDate.create({
            data: {
              unitId,
              startDate: event.dtStart,
              endDate: event.dtEnd,
              reason: BlockedDateReason.ota_import,
              note: event.summary || event.description,
              externalRef: event.uid,
            },
          });

          return { kind: 'imported' as const };
        });

        if (outcome.kind === 'conflict') {
          result.conflicts.push({ event, conflictingBooking: outcome.conflictingBooking });
          continue; // Don't import if conflict detected
        }

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
 * Tell ops that an OTA feed clashes with a stay we have already sold (N-25).
 *
 * The platform is the system of record, so the import never resolves the clash
 * itself — it refuses to write the block and raises the conflict for a human.
 */
export async function createConflictNotifications(
  db: PrismaClient,
  unitId: string,
  conflicts: Array<{
    event: ICalEvent;
    conflictingBooking: Booking;
  }>,
) {
  if (conflicts.length === 0) return { notified: 0 };

  // N-25 (doc 11): the ops lead and admins are told. This used to be a
  // console.warn with a note to build it "when ops identity routing is
  // available" — which meant a villa sold twice across two channels produced a
  // line in a log nobody reads, on a schedule nobody watches.
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { id: true, name: true, projectId: true },
  });
  if (!unit) return { notified: 0 };

  // Ops staff on this unit's project, plus every admin. Roles are data, so this
  // is a query rather than a hard-coded recipient list (doc 03).
  const [opsRoles, admins] = await Promise.all([
    db.roleAssignment.findMany({
      where: {
        role: { in: ['staff_ops', 'onsite_host'] },
        status: 'active',
        OR: [{ projectId: unit.projectId }, { unitId: unit.id }],
      },
      select: { identityId: true },
    }),
    db.identity.findMany({
      where: { isAdmin: true, status: 'active' },
      select: { id: true },
    }),
  ]);

  const recipients = Array.from(
    new Set([...opsRoles.map((r) => r.identityId), ...admins.map((a) => a.id)])
  );

  let notified = 0;
  for (const identityId of recipients) {
    // One notification per conflicting stay, not one per sync: an operator
    // needs to know which booking clashes, and a summary count would send them
    // hunting for it.
    for (const conflict of conflicts) {
      const created = await createNotification(db, {
        identityId,
        type: 'ops_ical_conflict',
        titleKey: 'notify.ops.ical_conflict.title',
        bodyKey: 'notify.ops.ical_conflict.body',
        params: {
          unit_name: unit.name,
          booking_id: conflict.conflictingBooking.id,
          start_date: conflict.event.dtStart.toISOString().slice(0, 10),
          end_date: conflict.event.dtEnd.toISOString().slice(0, 10),
        },
      });
      if (created) notified += 1;
    }
  }

  return { notified };
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
