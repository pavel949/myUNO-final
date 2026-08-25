import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOpenDisputes } from '@/modules/comms';
import DisputesAdminClient from './disputes-client';

export const dynamic = 'force-dynamic';

/**
 * Disputes (doc 07 F-DIS-2, Q52).
 *
 * A guest, owner, or orderer raises a dispute over a booking, service
 * order, or statement from `/api/disputes`; this is the admin side that
 * decides it — a written decision, and the money it calls for, moved
 * through the existing refund/ledger seam (never invented here).
 */
export default async function AdminDisputesPage() {
  const disputes = await getOpenDisputes(prisma);

  const labels = await getLabels({
    'admin.disputes.title': 'Disputes',
    'admin.disputes.subtitle':
      'Open disputes, most recently raised first. A decision closes the underlying ticket and, if you enter an amount, moves the money through a refund or a ledger adjustment.',
    'admin.disputes.empty': 'No open disputes.',
    'admin.disputes.subject.booking': 'Booking',
    'admin.disputes.subject.service_order': 'Service order',
    'admin.disputes.subject.statement': 'Statement',
    'admin.disputes.raised_by': 'Raised by',
    'admin.disputes.unit': 'Unit',
    'admin.disputes.raised_at': 'Raised',
    'admin.disputes.description': 'Description',
    'admin.disputes.amount': 'Resolution amount (THB, optional)',
    'admin.disputes.amount_hint': 'Leave blank if no money is owed.',
    'admin.disputes.note': 'Decision (the raiser may be shown this)',
    'admin.disputes.note_required': 'A decision note is required.',
    'admin.disputes.decide': 'Record decision',
    'admin.disputes.working': 'Working…',
    'admin.disputes.error': 'That did not work.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['admin.disputes.title']}</h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.disputes.subtitle']}
      </p>

      <DisputesAdminClient
        disputes={disputes.map((d) => ({
          id: d.id,
          subjectType: d.subjectType,
          createdAt: d.createdAt.toISOString(),
          title: d.ticket.title,
          description: d.ticket.description ?? '',
          unitName: d.ticket.unit?.name ?? null,
          raisedBy: `${d.ticket.raisedBy.firstName} ${d.ticket.raisedBy.lastName}`.trim(),
        }))}
        labels={labels}
      />
    </div>
  );
}
