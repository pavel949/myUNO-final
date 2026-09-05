import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getReporterTickets } from '@/modules/comms';
import { getLabels } from '@/lib/i18n';
import TicketsListClient from './tickets-list-client';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/tickets');
  }

  const tickets = await getReporterTickets(prisma, user.identityId);

  const labels = await getLabels({
    'tickets.list.title': 'My requests',
    'tickets.list.empty':
      'No requests yet. Raise one from your trip or unit and track its progress here.',
    'tickets.list.view': 'View',
    'tickets.list.raise': 'Raise from a trip',
    'tickets.list.filter_all': 'All',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  return (
    <TicketsListClient
      labels={labels}
      tickets={tickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        place: ticket.unit?.name || ticket.project?.name || null,
      }))}
    />
  );
}
