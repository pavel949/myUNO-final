import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { listTicketsFor } from '@/modules/comms';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const statusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  waiting_reporter: 'bg-state-warning-soft text-state-warning',
  resolved: 'bg-state-success-soft text-state-success',
  closed: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-surface-ivory text-text-stone',
};

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/tickets');
  }

  const tickets = await listTicketsFor(prisma, user.identityId);

  const labels = await getLabels({
    'tickets.list.title': 'My requests',
    'tickets.list.empty':
      'No requests yet. Raise one from your trip or unit and track its progress here.',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['tickets.list.title']}
        </h1>
        {tickets.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-secondary">{labels['tickets.list.empty']}</p>
          </div>
        ) : (
          <div className="bg-surface-paper border border-border-line rounded-lg">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between gap-12 p-16 border-b border-border-line last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-ink truncate">
                    {ticket.title}
                  </p>
                  <p className="text-small text-text-secondary">
                    {ticket.unit?.name || ticket.project?.name} ·{' '}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-12 py-4 rounded-full text-small font-semibold ${
                    statusStyle[ticket.status] || 'bg-surface-ivory text-text-ink'
                  }`}
                >
                  {labels[`tickets.status.${ticket.status}`] || ticket.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-16">
          <Link href="/trips" className="text-brand-andaman font-semibold hover:underline">
            ← {labels['tickets.list.title']}
          </Link>
        </p>
      </div>
    </main>
  );
}
