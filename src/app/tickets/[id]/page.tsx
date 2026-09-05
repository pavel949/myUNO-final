import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { loadTicketForUser } from '@/app/libs/ticketScope';
import TicketDetailClient, { type TicketDetailView } from './ticket-detail-client';

export const dynamic = 'force-dynamic';

function isStatusError(error: unknown, statusCode: number): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      (error as { statusCode?: number }).statusCode === statusCode
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/tickets/${params.id}`)}`);
  }

  let canManage = false;
  let isReporter = false;
  try {
    const scope = await loadTicketForUser(params.id, user);
    canManage = scope.canManage;
    isReporter = scope.isReporter;
  } catch (error) {
    if (isStatusError(error, 404)) {
      notFound();
    }
    throw error;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      raisedBy: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      events: {
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  const labels = await getLabels({
    'tickets.detail.back': '← My requests',
    'tickets.detail.title': 'Request details',
    'tickets.detail.project': 'Project',
    'tickets.detail.unit': 'Unit',
    'tickets.detail.reported_by': 'Reported by',
    'tickets.detail.assigned_to': 'Assigned to',
    'tickets.detail.unassigned': 'Unassigned',
    'tickets.detail.created_at': 'Created',
    'tickets.detail.history_title': 'Activity',
    'tickets.detail.empty_history': 'No updates yet.',
    'tickets.detail.assign_me': 'Assign to me',
    'tickets.detail.acknowledge': 'Acknowledge',
    'tickets.detail.start': 'Start work',
    'tickets.detail.need_reporter': 'Need reporter input',
    'tickets.detail.resume': 'Resume work',
    'tickets.detail.resolve': 'Resolve',
    'tickets.detail.resolve_note_prompt': 'Describe the resolution for the reporter',
    'tickets.detail.resolve_note_required': 'Resolution note is required to resolve a ticket.',
    'tickets.detail.cancel': 'Cancel request',
    'tickets.detail.cancel_confirm': 'Cancel this request?',
    'tickets.detail.reopen': 'Reopen request',
    'tickets.detail.reopen_prompt': 'What still needs to be fixed? (optional)',
    'tickets.detail.error_generic': 'Action failed. Please try again.',
    'tickets.detail.event_opened': 'Request opened with status {status}.',
    'tickets.detail.event_status_changed': 'Status changed from {from} to {to}.',
    'tickets.detail.event_assignment': 'Assignment updated.',
    'tickets.detail.event_comment': 'Comment added.',
    'tickets.detail.event_sla': 'SLA escalation recorded.',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  const detail: TicketDetailView = {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt.toISOString(),
    projectName: ticket.project?.name || null,
    unitName: ticket.unit?.name || null,
    raisedByName: `${ticket.raisedBy.firstName} ${ticket.raisedBy.lastName}`.trim(),
    assigneeIdentityId: ticket.assigneeIdentityId,
    assigneeName: ticket.assignee
      ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`.trim()
      : null,
    events: ticket.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString(),
      actorName: event.actor ? `${event.actor.firstName} ${event.actor.lastName}`.trim() : null,
      data:
        event.data && typeof event.data === 'object' && !Array.isArray(event.data)
          ? (event.data as Record<string, unknown>)
          : null,
    })),
  };

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <p className="mb-12">
          <Link href="/tickets" className="text-brand-andaman font-semibold hover:underline">
            {labels['tickets.detail.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-20">
          {labels['tickets.detail.title']}
        </h1>
        <TicketDetailClient
          ticket={detail}
          labels={labels}
          canManage={canManage}
          isReporter={isReporter}
          viewerIdentityId={user.identityId}
        />
      </div>
    </main>
  );
}
