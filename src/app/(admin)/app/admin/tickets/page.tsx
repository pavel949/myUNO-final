import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAdminTicketBoard, type AdminTicketBoardFilter } from '@/modules/comms';
import AdminTicketsClient from './tickets-client';

export const dynamic = 'force-dynamic';

const FILTER_VALUES: AdminTicketBoardFilter[] = [
  'active',
  'all',
  'open',
  'acknowledged',
  'in_progress',
  'waiting_reporter',
  'resolved',
  'closed',
  'cancelled',
];

/**
 * Cross-project ticket board (doc 08 §6 §9, S14).
 * Admin oversight of every open request, sorted by SLA.
 */
export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams?: {
    projectId?: string;
    filter?: string;
  };
}) {
  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';
  const requestedFilter =
    typeof searchParams?.filter === 'string' ? searchParams.filter : 'active';
  const filter: AdminTicketBoardFilter = FILTER_VALUES.includes(
    requestedFilter as AdminTicketBoardFilter
  )
    ? (requestedFilter as AdminTicketBoardFilter)
    : 'active';

  const projects = await prisma.project.findMany({
    where: { status: { in: ['live', 'draft'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const activeProjectId =
    requestedProjectId && projects.some((project) => project.id === requestedProjectId)
      ? requestedProjectId
      : '';

  const tickets = await getAdminTicketBoard(prisma, {
    projectId: activeProjectId || undefined,
    filter,
  });

  const labels = await getLabels({
    'admin.tickets.title': 'Tickets',
    'admin.tickets.subtitle':
      'Every request across the platform, sorted by SLA. Acknowledge and resolve here, or open a ticket for the full thread and history.',
    'admin.tickets.empty': 'No tickets match this filter.',
    'admin.tickets.project_filter': 'Project',
    'admin.tickets.all_projects': 'All projects',
    'admin.tickets.filter_active': 'Active',
    'admin.tickets.filter_all': 'All',
    'admin.tickets.filter_resolved': 'Resolved',
    'admin.tickets.filter_closed': 'Closed',
    'admin.tickets.raised_by': 'Raised by',
    'admin.tickets.assigned_to': 'Assigned to',
    'admin.tickets.unassigned': 'Unassigned',
    'admin.tickets.sla_due': 'SLA due',
    'admin.tickets.sla_breached': 'SLA breached',
    'admin.tickets.acknowledge': 'Acknowledge',
    'admin.tickets.start': 'Start work',
    'admin.tickets.resume': 'Resume',
    'admin.tickets.need_reporter': 'Need reporter',
    'admin.tickets.resolve': 'Resolve',
    'admin.tickets.resolve_note_prompt': 'Describe the resolution for the reporter',
    'admin.tickets.open': 'Open',
    'admin.tickets.error': 'That did not work.',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for reporter',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['admin.tickets.title']}</h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.tickets.subtitle']}
      </p>

      <AdminTicketsClient
        tickets={tickets.map((ticket) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          categoryKey: ticket.categoryKey,
          createdAt: ticket.createdAt.toISOString(),
          slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
          projectName: ticket.project.name,
          unitName: ticket.unit?.name ?? null,
          raisedByName: `${ticket.raisedBy.firstName} ${ticket.raisedBy.lastName}`.trim(),
          assigneeName: ticket.assignee
            ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`.trim()
            : null,
        }))}
        projects={projects}
        activeProjectId={activeProjectId}
        activeFilter={filter}
        labels={labels}
      />
    </div>
  );
}
