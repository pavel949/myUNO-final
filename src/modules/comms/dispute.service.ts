import { PrismaClient, Dispute, DisputeSubjectType, RoleType, TicketStatus } from '@prisma/client';
import { raiseTicket, updateTicketStatus } from './ticket.service';
import { refund, recordCashRefund } from '@/modules/finance/finance.service';
import { getConfig } from '@/modules/config';
import { recordCost } from '@/modules/finance/ledger.service';

/**
 * Disputes (doc 07 F-DIS-2, Q52).
 *
 * A dispute is a `Ticket(category='complaint', priority='high')` — the
 * shared comms layer, never rebuilt (CLAUDE.md) — plus a thin `Dispute` row
 * naming what is disputed and, once decided, the money movement the
 * decision produced. The ticket is the conversation and the record of
 * status; the `Dispute` row is what makes "resolve this" mean something
 * more specific than "close this ticket."
 *
 * Money always travels through the existing finance seam: a booking or
 * service-order dispute refunds the guest's original payment
 * (`RefundReason.dispute_resolution`, doc 10 §8's dispute-resolution
 * refund trigger); a statement dispute — no guest payment to refund —
 * posts a ledger adjustment against the unit instead. This module never
 * creates money itself, only decides which existing seam to call.
 */

export interface RaiseDisputeInput {
  subjectType: DisputeSubjectType;
  subjectId: string;
  raisedByIdentityId: string;
  raisedByRole: RoleType;
  title: string;
  description: string;
}

interface SubjectContext {
  projectId: string;
  unitId: string | null;
  /** The identity allowed to raise a dispute over this subject. */
  ownerIdentityId: string;
  /** The Payment to refund against, if this subject has one. */
  paymentId: string | null;
  /**
   * Set when the subject has stopped accepting disputes — a service order
   * whose confirm window has closed (doc 07 F-PROV-3). The message is shown
   * to the raiser, so it must say why, not merely that.
   */
  closedReason?: string;
}

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
        payments: { where: { status: 'succeeded' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
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
        payments: { where: { status: 'succeeded' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
      },
    });
    if (!order) throw new Error('Service order not found');

    // The confirm/dispute window (doc 07 F-PROV-3). A closed order is
    // finished: the orderer either confirmed it or let the window lapse, and
    // the provider has been remitted against it. Reopening that from an
    // unbounded past is what the window exists to prevent.
    let closedReason: string | undefined;
    if (order.status === 'closed') {
      closedReason = 'This order is closed — its window for raising a dispute has passed';
    } else if (order.status === 'fulfilled' && order.fulfilled_at) {
      // Read the window here rather than through the services module: comms
      // must not import services, which already imports comms. `loadSubject`
      // is where each subject type's shape is known, so the rule lives with
      // the other per-subject knowledge instead of inverting the dependency.
      const windowHours =
        ((await getConfig(db, 'service.fulfilment_confirm_window_hours', {
          projectId: order.project_id,
        })) as number | undefined) ?? 48;
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

  // statement
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
 * Raise a dispute over a booking, service order, or statement.
 * Refuses on behalf of the wrong identity — a dispute is the raiser's own
 * grievance, not one anyone can file about anyone else's record.
 */
export async function raiseDispute(db: PrismaClient, input: RaiseDisputeInput): Promise<Dispute> {
  const { subjectType, subjectId, raisedByIdentityId, raisedByRole, title, description } = input;

  const subject = await loadSubject(db, subjectType, subjectId);
  if (subject.ownerIdentityId !== raisedByIdentityId) {
    throw new Error('You can only raise a dispute over your own booking, order, or statement');
  }

  if (subject.closedReason) {
    throw new Error(subject.closedReason);
  }

  const existing = await db.dispute.findFirst({ where: { subjectType, subjectId } });
  if (existing) {
    throw new Error('A dispute has already been raised for this record');
  }

  // Everything above read the subject a moment ago. For a service order that
  // read races the nightly close sweep (doc 07 F-PROV-3): the sweep can commit
  // between the window check above and the rows written below, leaving a
  // `closed` order carrying an open dispute — precisely the state the window
  // exists to prevent. The sweep takes this same row lock before it closes, so
  // whichever arrives second sees what the first actually wrote.
  //
  // The ticket moves inside the transaction with the dispute, which also fixes
  // a smaller pre-existing flaw: a failing `dispute.create` used to leave an
  // orphan complaint ticket behind with nothing pointing at it.
  return db.$transaction(
    async (tx) => {
      if (subjectType === 'service_order') {
        await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${subjectId} FOR UPDATE`;

        const fresh = await tx.serviceOrder.findUnique({
          where: { id: subjectId },
          select: { status: true },
        });
        if (fresh?.status === 'closed') {
          throw new Error(
            'This order is closed — its window for raising a dispute has passed'
          );
        }
      }

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

      return tx.dispute.create({
        data: { ticketId, subjectType, subjectId },
      });
    },
    // raiseTicket resolves the SLA and the default assignee before writing, so
    // the default 5s interactive-transaction budget is tighter than it looks.
    { timeout: 15000 }
  );
}

export interface DecideDisputeInput {
  disputeId: string;
  decidedByIdentityId: string;
  /** Satang (THB x 100) — CLAUDE.md money rules. Omit/0 for "no money owed." */
  resolutionAmountThb?: number;
  /** The written decision — becomes the ledger/refund's audit trail. */
  decisionNote: string;
}

/**
 * Decide a dispute: record the admin's written decision, move the money
 * it calls for (if any) through the existing finance seam, and close the
 * ticket. Doc 10 §8: "Dispute resolution / goodwill: Admin-entered amount,
 * decision-referenced, audit-logged" — every branch below produces exactly
 * that.
 */
export async function decideDispute(db: PrismaClient, input: DecideDisputeInput): Promise<Dispute> {
  const { disputeId, decidedByIdentityId, resolutionAmountThb, decisionNote } = input;

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: { ticket: { select: { id: true, status: true } } },
  });
  if (!dispute) {
    throw new Error('Dispute not found');
  }
  if (dispute.decidedAt) {
    throw new Error('This dispute has already been decided');
  }

  const subject = await loadSubject(db, dispute.subjectType, dispute.subjectId);
  const amount = resolutionAmountThb ?? 0;
  if (amount < 0) {
    throw new Error('resolutionAmountThb must not be negative');
  }

  let refundId: string | null = null;
  let ledgerEntryId: string | null = null;

  if (amount > 0) {
    if (subject.paymentId) {
      // A real payment exists — refund it through the provider, never a
      // wallet (doc 10 §8).
      let paymentMethod: string | null = null;
      const payment = await db.payment.findUnique({ where: { id: subject.paymentId }, select: { method: true } });
      paymentMethod = payment?.method ?? null;

      const created =
        paymentMethod === 'cash'
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
      // No underlying payment (e.g. a statement dispute) — a direct ledger
      // adjustment against the unit, same shape as a failed-refund write-off
      // (payout.service.ts's resolveFailedRefund).
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
  const transitions = resolvePathByStatus[dispute.ticket.status] || [];

  for (const nextStatus of transitions) {
    await updateTicketStatus(db, {
      ticketId: dispute.ticketId,
      newStatus: nextStatus,
      actorIdentityId: decidedByIdentityId,
      ...(nextStatus === 'resolved' ? { note: decisionNote } : {}),
    });
  }

  return decided;
}

/** Open (undecided) disputes, most recently raised first — the admin queue. */
export async function getOpenDisputes(db: PrismaClient, options: { projectId?: string } = {}) {
  return db.dispute.findMany({
    where: {
      decidedAt: null,
      ...(options.projectId
        ? { ticket: { projectId: options.projectId } }
        : {}),
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

/** One dispute's full detail, including its decision once made. */
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
