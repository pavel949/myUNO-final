import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { getOpsBoard, getOpsMobilizationQueue } from '@/modules/ops';
import OpsBoardClient from './ops-client';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';
import UnitIcalConflictBanner, { UNIT_ICAL_CALENDAR_SURFACES } from '@/components/units/UnitIcalConflictBanner';
import { getProjectIcalConflictAlerts } from '@/modules/integrations';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';

export const dynamic = 'force-dynamic';

interface OpsBoardPageProps {
  searchParams?: {
    projectId?: string;
  };
}

export default async function OpsBoardPage({ searchParams }: OpsBoardPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops');
  }

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  const isStaff = opsContext.isAdmin || opsContext.staffProjectIds.length > 0;
  if (!isStaff) {
    redirect('/');
  }

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );

  const { arrivals, departures, pendingRequests, pendingPayment, pendingServiceOrders, openTickets, slaMetrics } =
    await getOpsBoard(prisma, new Date(), opsBoardScope(opsContext, validActiveProjectId));

  const mobilizationUnits = await getOpsMobilizationQueue(
    prisma,
    opsBoardScope(opsContext, validActiveProjectId)
  );

  const boardScope = opsBoardScope(opsContext, validActiveProjectId);
  const icalConflicts = await getProjectIcalConflictAlerts(
    prisma,
    boardScope ? { projectIds: boardScope.projectIds } : undefined
  );

  const switcherBasePath = '/ops';

  const labels = await getLabels({
    'staff.ops.title': 'Ops board',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
    'staff.ops.costs_link': 'Record a cost',
    'staff.ops.claims_link': 'Damage claims',
    'staff.ops.tm30_link': 'TM30 queue →',
    'staff.ops.requests_link': 'Booking requests →',
    'staff.ops.arrivals': "Today's arrivals",
    'staff.ops.booking_requests': 'Booking requests',
    'staff.ops.requests_open_inbox': 'Open inbox →',
    'staff.ops.requests_empty': 'No pending booking requests.',
    'staff.ops.approve_request': 'Approve',
    'staff.ops.decline_request': 'Decline',
    'staff.ops.confirm_decline_request': 'Decline this booking request? The guest will be notified.',
    'staff.ops.request_expires': 'Respond by',
    'staff.ops.departures': "Today's departures",
    'staff.ops.pending_cash': 'Awaiting payment (record cash)',
    'staff.ops.empty': 'Nothing here right now.',
    'staff.ops.guest': 'Guest',
    'staff.ops.unit': 'Unit',
    'staff.ops.dates': 'Dates',
    'staff.ops.total': 'Total',
    'staff.ops.paid': 'Paid',
    'staff.ops.unpaid': 'Unpaid',
    'staff.ops.verified': 'Passports OK',
    'staff.ops.not_verified': 'Passports missing',
    'staff.ops.check_in': 'Check in',
    'staff.ops.check_out': 'Check out',
    'staff.ops.record_cash': 'Record cash',
    'staff.ops.receipt_placeholder': 'Receipt / чек №',
    'staff.ops.confirm_cash': 'Confirm ฿{amount} received',
    'staff.ops.error_generic': 'Action failed. Please try again.',
    'staff.ops.service_pending_cash': 'Service orders awaiting cash',
    'staff.ops.tickets_title': 'Open tickets',
    'staff.ops.tickets_empty': 'No active tickets.',
    'staff.ops.ticket_reported_by': 'Reported by',
    'staff.ops.ticket_assign_me': 'Assign to me',
    'staff.ops.ticket_assigned_to': 'Assigned to',
    'staff.ops.ticket_acknowledge': 'Acknowledge',
    'staff.ops.ticket_start': 'Start work',
    'staff.ops.ticket_need_reporter': 'Need reporter input',
    'staff.ops.ticket_resume': 'Resume work',
    'staff.ops.ticket_resolve': 'Resolve',
    'staff.ops.ticket_view': 'View',
    'staff.ops.ticket_due': 'SLA due',
    'staff.ops.ticket_calendar_link': 'Open unit calendar',
    'staff.ops.ticket_resolve_note_prompt': 'Describe the resolution for the reporter',
    'staff.ops.ticket_resolve_note_required': 'Resolution note is required to resolve a ticket.',
    'staff.ops.sla_title': 'SLA health (last 7 days)',
    'staff.ops.tm30_on_time': 'TM30 on-time %',
    'staff.ops.tickets_past_sla': 'Tickets past SLA',
    'staff.ops.mobilization_title': 'Mobilization',
    'staff.ops.mobilization_empty': 'No units are currently in mobilization.',
    'staff.ops.mobilization_progress': '{completed} of {total} steps done',
    'staff.ops.mobilization_next': 'Next step',
    'staff.ops.mobilization_open': 'Open checklist →',
    'staff.ops.ical_conflicts_title': 'OTA calendar conflicts',
    'staff.ops.ical_conflicts_hint':
      'Imported OTA bookings overlap platform stays. The platform calendar wins — correct each OTA channel manually.',
    'staff.calendar.conflict_body_with_unit':
      '{unit_name} · {guest_name}: {start_date} — {end_date} clashes with an OTA import',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  // Display boundary: totalThb/total_thb are stored in satang (THB x 100);
  // convert to baht here, once, for the client board.
  const serialize = (list: typeof arrivals) =>
    list.map((b) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      totalThb: Math.round(b.totalThb / 100),
      party: b.adults + b.children,
      verificationStatus: b.verificationStatus,
      unitId: b.unit?.id || null,
      unitName: b.unit?.name || '—',
      guestName: b.guestIdentity
        ? `${b.guestIdentity.firstName} ${b.guestIdentity.lastName}`
        : '—',
      paid: b.payments.length > 0,
      requestExpiresAt: b.requestExpiresAt ? b.requestExpiresAt.toISOString() : null,
    }));

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-24">
          <h1 className="text-heading-1 font-bold text-text-ink">
            {labels['staff.ops.title']}
          </h1>
          <div className="flex items-center gap-16">
            <Link
              href={opsHref('/ops/costs', validActiveProjectId)}
              className="text-brand-andaman font-semibold hover:underline"
            >
              {labels['staff.ops.costs_link']}
            </Link>
            <Link
              href={opsHref('/ops/claims', validActiveProjectId)}
              className="text-brand-andaman font-semibold hover:underline"
            >
              {labels['staff.ops.claims_link']}
            </Link>
            <Link
              href={opsHref('/ops/tm30', validActiveProjectId)}
              className="text-brand-andaman font-semibold hover:underline"
            >
              {labels['staff.ops.tm30_link']}
            </Link>
            <Link
              href={opsHref('/ops/requests', validActiveProjectId)}
              className="text-brand-andaman font-semibold hover:underline"
            >
              {labels['staff.ops.requests_link']}
            </Link>
          </div>
        </div>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath={switcherBasePath}
          labels={labels}
        />

        {/* SLA health tiles */}
        <div className="mb-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['staff.ops.sla_title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['staff.ops.tm30_on_time']}</p>
              <p className="text-heading-2 font-semibold text-text-ink">{slaMetrics.tm30OnTimeRate7d}%</p>
            </div>
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['staff.ops.tickets_past_sla']}</p>
              <p className="text-heading-2 font-semibold text-text-ink">{slaMetrics.ticketsWithOpenSLA}</p>
            </div>
          </div>
        </div>

        <UnitIcalConflictBanner
          conflicts={icalConflicts}
          labels={labels}
          calendarSurface={UNIT_ICAL_CALENDAR_SURFACES.ops}
        />

        <OpsBoardClient
          viewerIdentityId={user.identityId}
          activeProjectId={validActiveProjectId}
          mobilizationUnits={mobilizationUnits}
          arrivals={serialize(arrivals)}
          departures={serialize(departures)}
          pendingRequests={serialize(pendingRequests)}
          pendingPayment={serialize(pendingPayment)}
          pendingServiceOrders={pendingServiceOrders.map((o) => ({
            id: o.id,
            scheduledStart: o.scheduled_start.toISOString(),
            totalThb: Math.round(o.total_thb / 100),
            serviceTitle: o.service?.title || '—',
            ordererName: o.orderer
              ? `${o.orderer.firstName} ${o.orderer.lastName}`
              : '—',
          }))}
          openTickets={openTickets.map((ticket) => ({
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            slaDueAt: ticket.slaDueAt ? ticket.slaDueAt.toISOString() : null,
            unitId: ticket.unit?.id || null,
            unitName: ticket.unit?.name || '—',
            raisedByName: `${ticket.raisedBy.firstName} ${ticket.raisedBy.lastName}`,
            assigneeIdentityId: ticket.assigneeIdentityId,
            assigneeName: ticket.assignee
              ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
              : null,
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
