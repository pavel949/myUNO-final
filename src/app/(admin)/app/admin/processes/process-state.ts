import type { PrismaClient } from '@prisma/client';

/**
 * Read-only process health projection. Every number comes from its canonical
 * record; there is no separate workflow status table or mutable dashboard cache.
 */
export async function getProcessState(db: PrismaClient) {
  const [
    people, projects, draftProjects, units, liveUnits, uncategorizedUnits,
    activeOffers, ratePlans, requested, pendingPayment, confirmed,
    checkedIn, checkedOut, completed, openTickets, leads,
    statementsPending, outstandingPayments, payoutCount, serviceOrders,
    ledgerEntries, unlinkedSucceededPayments,
  ] = await Promise.all([
    db.identity.count({ where: { status: 'active' } }),
    db.project.count(),
    db.project.count({ where: { status: 'draft' } }),
    db.unit.count(),
    db.unit.count({ where: { status: 'live' } }),
    db.unit.count({ where: { inventoryCategoryId: null, status: { in: ['draft', 'mobilizing'] } } }),
    db.commercialOffering.count({ where: { status: 'active' } }),
    db.ratePlan.count({ where: { status: 'active' } }),
    db.booking.count({ where: { status: 'requested' } }),
    db.booking.count({ where: { status: 'pending_payment' } }),
    db.booking.count({ where: { status: 'confirmed' } }),
    db.booking.count({ where: { status: 'checked_in' } }),
    db.booking.count({ where: { status: 'checked_out' } }),
    db.booking.count({ where: { status: 'completed' } }),
    db.ticket.count({ where: { status: { in: ['open', 'acknowledged', 'in_progress'] } } }),
    db.identity.count({ where: { roleAssignments: { some: { role: 'buyer', status: 'active' } } } }),
    db.ownerStatement.count({ where: { status: { in: ['draft', 'pending_owner_review', 'signed_off'] } } }),
    db.payment.count({ where: { status: { in: ['created', 'pending'] }, bookingId: { not: null } } }),
    db.payout.count(),
    db.serviceOrder.count({ where: { status: { in: ['placed', 'paid', 'accepted'] } } }),
    db.ledgerEntry.count(),
    db.payment.count({ where: { status: 'succeeded', bookingId: { not: null }, ledgerEntries: { none: {} } } }),
  ]);
  return {
    '01': { summary: `${people} active identities`, attention: null },
    '02': { summary: `${projects} projects · ${draftProjects} drafts`, attention: draftProjects > 0 ? `${draftProjects} projects in draft` : null },
    '03': { summary: `${liveUnits} / ${units} live homes · ${activeOffers} active offers`, attention: uncategorizedUnits > 0 ? `${uncategorizedUnits} draft homes without category` : null },
    '04': { summary: `${ratePlans} active rate plans`, attention: null },
    '05': { summary: `${requested} requests · ${confirmed} confirmed`, attention: pendingPayment > 0 ? `${pendingPayment} awaiting payment` : null },
    '06': { summary: `${confirmed} pre-arrival · ${checkedIn} in-house · ${checkedOut} checked out · ${completed} completed`, attention: checkedOut > 0 ? `${checkedOut} awaiting completion review` : null },
    '07': { summary: `${openTickets} open operational tickets`, attention: openTickets > 0 ? `${openTickets} require action` : null },
    '08': { summary: `${leads} identities with buyer role`, attention: null },
    '09': { summary: `${statementsPending} statements not distributed`, attention: statementsPending > 0 ? `${statementsPending} in statement workflow` : null },
    '10': { summary: 'Partner attribution and providers', attention: null },
    '11': { summary: `${serviceOrders} active service orders`, attention: null },
    '12': { summary: `${ledgerEntries} ledger entries · ${payoutCount} payouts`, attention: unlinkedSucceededPayments > 0 ? `${unlinkedSucceededPayments} successful booking payments without ledger entries` : outstandingPayments > 0 ? `${outstandingPayments} pending booking payments` : null },
  } satisfies Record<string, { summary: string; attention: string | null }>;
}
