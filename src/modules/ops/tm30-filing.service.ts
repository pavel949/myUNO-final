import { PrismaClient, Tm30FilingStatus } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';

export interface CreateTm30FilingInput {
  bookingId: string;
  bookingGuestId: string;
  dueDateOffset?: number; // hours from arrival; default 24 (doc 07 F-OPS-2 ceiling)
}

export interface Tm30FilingDetails {
  id: string;
  bookingId: string;
  bookingGuestId: string;
  dueAt: Date;
  status: Tm30FilingStatus;
  filedAt?: Date;
  filedByIdentityId?: string;
  failureNote?: string;
  escalatedAt?: Date;
  [key: string]: any;
}

/**
 * Create a TM30 filing for a foreign guest arrival.
 * Spawned by check-in confirmation (S12); 24h SLA per immigration (doc 07 F-OPS-2).
 */
export async function createTm30Filing(
  db: PrismaClient,
  input: CreateTm30FilingInput
): Promise<{ id: string }> {
  const { bookingId, bookingGuestId, dueDateOffset } = input;

  // Get the booking to read arrival date
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { guests: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // Get config: max ceiling is 24h per law, can only be tightened (doc 04 §7)
  const configHours = ((await getConfig(db, 'compliance.tm30_sla_hours', {
    projectId: booking.projectId,
  })) as number | undefined) || 24;

  // Use provided offset or config default
  const hoursWindow = dueDateOffset ?? configHours;
  const dueAt = new Date(booking.startDate.getTime() + hoursWindow * 60 * 60 * 1000);

  const filing = await db.tm30Filing.create({
    data: {
      bookingId,
      bookingGuestId,
      dueAt,
      status: 'pending',
    },
  });

  return { id: filing.id };
}

/**
 * Mark a TM30 filing as successfully filed.
 * Called after staff uploads the receipt to the portal (doc 07 F-OPS-2).
 */
export async function markTm30FilingFiled(
  db: PrismaClient,
  tm30FilingId: string,
  filedByIdentityId: string,
  receiptMediaId?: string
): Promise<void> {
  const filing = await db.tm30Filing.findUnique({
    where: { id: tm30FilingId },
  });

  if (!filing) {
    throw new Error(`Tm30Filing ${tm30FilingId} not found`);
  }

  if (filing.status !== 'pending' && filing.status !== 'escalated') {
    throw new Error(`Cannot file TM30 in ${filing.status} status`);
  }

  await db.tm30Filing.update({
    where: { id: tm30FilingId },
    data: {
      status: 'filed',
      filedAt: new Date(),
      filedByIdentityId: filedByIdentityId,
      receiptMediaId: receiptMediaId,
    },
  });
}

/**
 * Mark a TM30 filing as failed (e.g., rejected by Immigration).
 * Sets escalated state to trigger staff SLA escalation (doc 07 F-OPS-2).
 */
export async function markTm30FilingFailed(
  db: PrismaClient,
  tm30FilingId: string,
  failureNote: string
): Promise<void> {
  const filing = (await db.tm30Filing.findUnique({
    where: { id: tm30FilingId },
    include: { booking: true, bookingGuest: true },
  })) as any;

  if (!filing) {
    throw new Error(`Tm30Filing ${tm30FilingId} not found`);
  }

  // Transition to failed; if not yet escalated, also mark escalated
  const now = new Date();
  const newStatus: Tm30FilingStatus = 'failed';
  const escalatedAt = filing.escalatedAt || now;

  await db.tm30Filing.update({
    where: { id: tm30FilingId },
    data: {
      status: newStatus,
      failureNote: failureNote,
      escalatedAt: escalatedAt,
    },
  });

  // Notify ops team of escalation if this is the first escalation
  if (!filing.escalatedAt) {
    await createNotification(db, {
      identityId: filing.booking.projectId, // Will be refined to ops role per project
      type: 'compliance_tm30_escalation',
      titleKey: 'tm30.escalation.title',
      bodyKey: 'tm30.escalation.body',
      params: {
        filing_id: tm30FilingId,
        guest_name: filing.bookingGuest.fullName,
      },
    });
  }
}

/**
 * Get TM30 filings due soon (for ops board queue).
 * Returns filings sorted by due_at (soonest first).
 */
export async function getTm30Queue(
  db: PrismaClient,
  projectId: string,
  statusFilter?: Tm30FilingStatus[]
): Promise<Tm30FilingDetails[]> {
  const filings = await db.tm30Filing.findMany({
    where: {
      booking: {
        projectId,
      },
      status: statusFilter?.length ? { in: statusFilter } : undefined,
    },
    include: {
      booking: true,
      bookingGuest: true,
    },
    orderBy: { dueAt: 'asc' },
  });

  return filings as any;
}

/**
 * Log access to TM30 filing passport data (for audit trail).
 * Called when staff views passport details for a filing.
 */
export async function logTm30PassportAccess(
  db: PrismaClient,
  tm30FilingId: string,
  accessorIdentityId: string,
  action: string = 'viewed_passport'
): Promise<void> {
  const filing = (await db.tm30Filing.findUnique({
    where: { id: tm30FilingId },
    include: { booking: true, bookingGuest: true },
  })) as any;

  if (!filing) {
    throw new Error(`Tm30Filing ${tm30FilingId} not found`);
  }

  // Log access in the audit log
  await db.auditLog.create({
    data: {
      action,
      entityType: 'tm30_filing',
      entityId: tm30FilingId,
      actorIdentityId: accessorIdentityId,
      data: {
        bookingId: filing.bookingId,
        guestName: filing.bookingGuest?.fullName,
      } as any,
    },
  });
}

/**
 * Check and escalate TM30 filings that are approaching their deadline.
 * Sets escalated status when due_at - escalation_hours_before is reached.
 */
export async function checkTm30Escalations(
  db: PrismaClient,
  projectId: string
): Promise<{ checked: number; escalated: number }> {
  const now = new Date();
  let checkedCount = 0;
  let escalatedCount = 0;

  const filings = (await db.tm30Filing.findMany({
    where: {
      booking: { projectId },
      status: 'pending',
    },
    include: { booking: true, bookingGuest: true },
  })) as any;

  for (const filing of filings) {
    checkedCount++;

    // Get escalation threshold
    const escalationHoursBefore =
      ((await getConfig(db, 'compliance.tm30_escalation_hours_before', {
        projectId,
      })) as number | undefined) || 6;

    const escalationThreshold = new Date(filing.dueAt.getTime() - escalationHoursBefore * 60 * 60 * 1000);

    if (now >= escalationThreshold && !filing.escalatedAt) {
      // Escalate and notify admin (N-24)
      await db.tm30Filing.update({
        where: { id: filing.id },
        data: {
          status: 'escalated',
          escalatedAt: now,
        },
      });

      // Notify admin/ops
      await createNotification(db, {
        identityId: filing.booking.projectId,
        type: 'compliance_tm30_escalation',
        titleKey: 'tm30.escalation.title',
        bodyKey: 'tm30.escalation.body',
        params: {
          filing_id: filing.id,
          guest_name: filing.bookingGuest?.fullName || 'Guest',
        },
      });

      escalatedCount++;
    }
  }

  return { checked: checkedCount, escalated: escalatedCount };
}

/**
 * Create a condition report (check-in/check-out/incident).
 * Photos are attached via ConditionReportMedia join.
 */
export interface CreateConditionReportInput {
  unitId: string;
  bookingId?: string;
  reportType: 'baseline' | 'check_in' | 'check_out' | 'incident';
  notes?: string;
  createdByIdentityId: string;
  photoMediaIds?: string[];
}

export async function createConditionReport(
  db: PrismaClient,
  input: CreateConditionReportInput
): Promise<{ id: string }> {
  const { unitId, bookingId, reportType, notes, createdByIdentityId, photoMediaIds } = input;

  const report = await db.conditionReport.create({
    data: {
      unitId,
      bookingId,
      reportType,
      notes,
      createdByIdentityId,
    },
  });

  // Attach photos if provided
  if (photoMediaIds?.length) {
    for (let i = 0; i < photoMediaIds.length; i++) {
      await db.conditionReportMedia.create({
        data: {
          reportId: report.id,
          mediaId: photoMediaIds[i],
          sort: i,
        },
      });
    }
  }

  return { id: report.id };
}

/**
 * Get a condition report with its photos.
 */
export async function getConditionReport(
  db: PrismaClient,
  reportId: string
): Promise<{ report: any; photos: any[] }> {
  const report = await db.conditionReport.findUnique({
    where: { id: reportId },
    include: {
      media: {
        include: {
          media: true,
        },
        orderBy: { sort: 'asc' },
      },
    },
  });

  if (!report) {
    throw new Error(`ConditionReport ${reportId} not found`);
  }

  return {
    report,
    photos: report.media,
  };
}
