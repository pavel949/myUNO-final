import { PrismaClient, Dispute, DisputeSubjectType, RoleType, TicketStatus } from '@prisma/client';
import { raiseTicket, updateTicketStatus } from './ticket.service';
import { refund, recordCashRefund } from '@/modules/finance/finance.service';
import { getConfig } from '@/modules/config';
import { recordCost } from '@/modules/finance/ledger.service';

export interface RaiseDisputeInput {
  subjectType: DisputeSubjectType;
  subjectId: string;
  raisedByIdentityId: string;
  raisedByRole: RoleType;
  title: string;
  description: string;
}

interface SubjectContext {
  projectId: string | null;
  unitId: string | null;
  ownerIdentityId: string;
  paymentId: string | null;
  closedReason?: string;
}

/** Load the canonical subject and the identity allowed to dispute it. */
async function loadSubject(
  db: PrismaClient,
  subjectType: DisputeSubjectType,
  subjectId: string
): Promise<SubjectContext> {
  if (subjectType === 'booking') {
    const booking = await db.booking.findUnique({
      where: { id: subjectId },
      select: {
        projectId: true,
        unitId: true,
        guestIdentityId: true,
        payments: {
          where: { status: 'succeeded' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!booking) throw new Error('Booking not found');
    return {
      projectId: booking.projectId,
      unitId: booking.unitId,
      ownerIdentityId: booking.guestIdentityId,
      paymentId: booking.payments[0]?.id ?? null,
    };
  }

  if (subjectType === 'service_order') {
    const order = await db.serviceOrder.findUnique({
      where: { id: subjectId },
      select: {
        project_id: true,
        unit_id: true,
        orderer_identity_id: true,
        status: true,
        fulfilled_at: true,
        payments: {
          where: { status: 'succeeded' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!order) throw new Error('Service order not found');

    let closedReason: string | undefined;
    if (order.status === 'closed') {
      closedReason = 'This order is closed — its window for raising a dispute has passed';
    } else if (order.status === 'fulfilled' && order.fulfilled_at) {
      const windowHours =
        ((await getConfig(db, 'service.fulfilment_confirm_window_hours', {
          projectId: order.project_id,
        })) as number | undefined) ?? 48;
      if (!Number.isInteger(windowHours) || windowHours <= 0) {
        throw new Error('Invalid fulfilment confirmation window configuration');
      }
      const deadline = new Date(order.fulfilled_at.getTime() + windowHours * 60 * 60 * 1000);
      if (deadline <= new Date()) {
        closedReason = `The ${windowHours}-hour window for disputing this order has passed`;
      }
    }

    return {
      projectId: order.project_id,
      unitId: order.unit_id,
      ownerIdentityId: order.orderer_identity_id,
      paymentId: order.payments[0]?.id ?? null,
      closedReason,
    };
  }

  const statement = await db.ownerStatement.findUnique({
    where: { id: subjectId },
    select: { unit: { select: { id: true, projectId: true } }, ownerIdentityId: true },
  });
  if (!statement) throw new Error('Statement not found');
  return {
    projectId: statement.unit.projectId,
    unitId: statement.unit.id,
    ownerIdentityId: statement.ownerIdentityId,
    paymentId: null,
  };
}

/**
 * Raise one dispute for a canonical subject.
 * Service-order creation shares the order row lock with confirm/auto-close;
 * the database unique constraint protects all subject types from duplicates.
 */
export async function raiseDispute(db: PrismaClient, input: RaiseDisputeInput): Promise<Dispute> {
  const { subjectType, subjectId, raisedByIdentityId, raisedByRole, title, description } = input;
  const subject = await loadSubject(db, subjectType, subjectId);

  if (subject.ownerIdentityId !== raisedByIdentityId) {
    throw new Error('You can only raise a dispute over your own booking, order, or statement');
  }
  if (subject.closedReason) throw new Error(subject.closedReason);

  // Ticket is still the canonical dispute conversation record and currently
  // requires property scope. Fail closed for a standalone service instead of
  // inventing a synthetic project or creating an orphan dispute.
  if (!subject.projectId) {
    throw new Error('Standalone service disputes require operator support until projectless tickets are enabled');
  }

  try {
    return await db.$transaction(
      async (tx) => {
        if (subjectType === 'service_order') {
          await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${subjectId} FOR UPDATE`;

          const fresh = await tx.serviceOrder.findUnique({
            where: { id: subjectId },
            select: { status: true, fulfilled_at: true, project_id: true },
          });
          if (!fresh) throw new Error('Service order not found');
          if (fresh.status === 'closed') {
            throw new Error('This order is closed — its window for raising a dispute has passed');
          }
          if (fresh.status === 'fulfilled' && fresh.fulfilled_at) {
            const configured =
              ((await getConfig(tx as unknown as PrismaClient, 'service.fulfilment_confirm_window_hours', {
                projectId: fresh.project_id,
              })) as number | undefined) ?? 48;
            if (!Number.isInteger(configured) || configured <= 0) {
              throw new Error('Invalid fulfilment confirmation window configuration');
            }
            const deadline = new Date(fresh.fulfilled_at.getTime() + configured * 60 * 60 * 1000);
            if (deadline <= new Date()) {
              throw new Error(`The ${configured}-hour window for disputing this order has passed`);
            }
          }
        }

        const existing = await tx.dispute.findFirst({
          where: { subjectType, subjectId },
          select: { id: true },
        });
        if (existing) throw new Error('A dispute has already been raised for this record');

        const { id: ticketId } = await raiseTicket(tx as unknown as PrismaClient, {
          projectId: subject.projectId,
          unitId: subject.unitId ?? undefined,
          raisedByIdentityId,
          raisedByRole,
          categoryKey: 'complaint',
          title,
          description,
          priority: 'high',
        });

        return tx.dispute.create({ data: { ticketId, subjectType, subjectId } });
      },
      { timeout: 15000 }
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      throw new Error('A dispute has already been raised for this record');
    }
    throw error;
  }
}

export interface DecideDisputeInput {
  disputeId: string;
  decidedByIdentityId: string;
  resolutionAmountThb?: number;
  decisionNote: string;
}

/** Resolve a dispute and route any money through canonical finance seams. */
export async function decideDispute(db: PrismaClient, input: DecideDisputeInput): Promise<Dispute> {
  const { disputeId, decidedByIdentityId, resolutionAmountThb, decisionNote } = input;
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: { ticket: { select: { id: true, status: true } } },
  });
  if (!dispute) throw new Error('Dispute not found');
  if (dispute.decidedAt) throw new Error('This dispute has already been decided');

  const subject = await loadSubject(db, dispute.subjectType, dispute.subjectId);
  const amount = resolutionAmountThb ?? 0;
  if (amount < 0) throw new Error('resolutionAmountThb must not be negative');

  let refundId: string | null = null;
  let ledgerEntryId: string | null = null;

  if (amount > 0) {
    if (subject.paymentId) {
      const payment = await db.payment.findUnique({
        where: { id: subject.paymentId },
        select: { method: true },
      });
      const created =
        payment?.method === 'cash'
          ? await recordCashRefund(db, {
              paymentId: subject.paymentId,
              amountThb: amount,
              reason: 'dispute_resolution',
              paidBackByIdentityId: decidedByIdentityId,
              initiatedByIdentityId: decidedByIdentityId,
            })
          : await refund(db, subject.paymentId, amount, 'dispute_resolution', decidedByIdentityId);
      refundId = created.id;
    } else {
      if (!subject.unitId) {
        throw new Error(
          'Cannot resolve this dispute with an amount: the disputed record has no payment to refund and no unit to post a ledger adjustment against'
        );
      }
      const entry = await recordCost(db, {
        entryType: 'adjustment',
        amountThb: -Math.abs(amount),
        unitId: subject.unitId,
        description: `Dispute resolution: ${decisionNote}`.slice(0, 500),
        recordedByIdentityId: decidedByIdentityId,
        occurredOn: new Date(),
      });
      ledgerEntryId = entry.id;
    }
  }

  const decided = await db.dispute.update({
    where: { id: disputeId },
    data: {
      resolutionAmountThb: amount || null,
      refundId,
      ledgerEntryId,
      decidedByIdentityId,
      decidedAt: new Date(),
    },
  });

  const resolvePathByStatus: Record<TicketStatus, TicketStatus[]> = {
    open: ['acknowledged', 'in_progress', 'resolved'],
    acknowledged: ['in_progress', 'resolved'],
    in_progress: ['resolved'],
    waiting_reporter: ['in_progress', 'resolved'],
    resolved: [],
    closed: [],
    cancelled: [],
  };

  for (const nextStatus of resolvePathByStatus[dispute.ticket.status] || []) {
    await updateTicketStatus(db, {
      ticketId: dispute.ticketId,
      newStatus: nextStatus,
      actorIdentityId: decidedByIdentityId,
      ...(nextStatus === 'resolved' ? { note: decisionNote } : {}),
    });
  }

  return decided;
}

/** Open disputes for the admin queue. */
export async function getOpenDisputes(db: PrismaClient, options: { projectId?: string } = {}) {
  return db.dispute.findMany({
    where: {
      decidedAt: null,
      ...(options.projectId ? { ticket: { projectId: options.projectId } } : {}),
    },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          description: true,
          projectId: true,
          unitId: true,
          raisedByIdentityId: true,
          createdAt: true,
          raisedBy: { select: { firstName: true, lastName: true } },
          unit: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Full dispute detail including decision metadata. */
export async function getDisputeDetail(db: PrismaClient, disputeId: string) {
  return db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          projectId: true,
          unitId: true,
          raisedByIdentityId: true,
          createdAt: true,
          raisedBy: { select: { firstName: true, lastName: true } },
          unit: { select: { name: true } },
        },
      },
      decidedBy: { select: { firstName: true, lastName: true } },
    },
  });
}
