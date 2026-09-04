import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getOwnerUnitDashboard } from '@/modules/projects';
import { OwnerUnitDashboardClient } from './client';

export const dynamic = 'force-dynamic';

/**
 * Per-unit owner dashboard (doc 06 S7/S8, doc 07 F-OWN-2).
 * Portfolio owners drill into one unit; single-unit owners are redirected here from `/owner`.
 */
export default async function OwnerUnitPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/owner/units/${params.unitId}`);
  }

  const isOwner = user.roles.some((role) => role.role === 'owner');
  if (!isOwner) {
    redirect('/');
  }

  const data = await getOwnerUnitDashboard(prisma, user.identityId, params.unitId);
  if (!data) {
    notFound();
  }

  const locale = getRequestLocale();

  const labels = (await getLabels({
    'owner.unit.back': '← Owner dashboard',
    'owner.unit.subtitle': 'Everything about this unit — occupancy, bookings, statements, and open requests.',
    'owner.dashboard.occupancy_this_month': 'Occupied This Month',
    'owner.dashboard.revenue_this_month': 'Revenue This Month',
    'owner.stats.nights': 'nights',
    'owner.stats.vs_last_month': 'vs last month',
    'owner.stats.new_period': 'New',
    'owner.units.last30': 'Occupancy, last 30 nights',
    'owner.sections.bookings': 'Recent Bookings',
    'owner.sections.statement': 'Latest Statement',
    'owner.sections.tickets': 'Open Tickets',
    'owner.actions.title': 'Quick actions',
    'owner.actions.raise_ticket': 'Raise a request',
    'owner.actions.book_service': 'Book a service',
    'owner.alert.action_view': 'View',
    'owner.bookings.empty': 'No bookings yet',
    'owner.bookings.unknown_nationality': 'Unknown',
    'owner.tickets.empty': 'No open tickets',
    'owner.tickets.waiting_count': '{count} requests waiting for attention',
    'owner.tickets.view': 'View',
    'owner.stay.book_action': 'Stay in My Unit',
    'owner.stay.error': 'Failed to book owner stay',
    'owner.alerts.title': 'Alerts',
    'owner.compliance.title': 'Compliance',
    'owner.compliance.subtitle': 'Permitted use, TM30 on-time rate, and mobilization progress.',
    'owner.compliance.permitted_use': 'Permitted use',
    'owner.compliance.tm30_ontime': 'TM30 on time',
    'owner.compliance.records': 'Compliance records',
    'owner.compliance.mobilization': 'Mobilization',
    'owner.statement.title': 'Statements',
    'owner.statement.period': 'Period',
    'owner.statement.noi': 'NOI',
    'owner.statement.your_share': 'Your share',
    'owner.statement.view': 'View statement',
    'owner.alert.tm30_overdue.title': 'TM30 filing overdue',
    'owner.alert.tm30_overdue.body': 'TM30 filing for guest arrival on {date} is overdue.',
    'owner.alert.tm30_escalated.title': 'TM30 filing escalated',
    'owner.alert.tm30_escalated.body': 'An escalation has been flagged for this TM30 filing.',
    'owner.alert.unit_paused.title': 'Unit is paused',
    'owner.alert.unit_paused.body': 'This unit is currently paused and not accepting bookings.',
    'owner.alert.compliance_expiry.title': '{recordType} expiring soon',
    'owner.alert.compliance_expiry.body': 'Your {recordType} expires on {date}.',
    'owner.alert.ticket_sla.title': 'Ticket SLA breached',
    'owner.alert.ticket_sla.body': 'An open ticket has exceeded its SLA deadline.',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
    'owner.contract.title': 'Management contract',
    'owner.contract.basis': 'Management fee basis',
    'owner.contract.loading': 'Loading contract terms…',
    'owner.contract.rate': 'Management fee rate',
    'owner.contract.fixed': 'Fixed management fee',
    'owner.contract.period': 'Contract period',
    'owner.contract.performance': 'Performance fee',
    'owner.contract.basis.percentage_gop': '% of GOP',
    'owner.contract.basis.percentage_noi': '% of NOI',
    'owner.contract.basis.percentage_gross_booking': '% of gross bookings',
    'owner.contract.basis.fixed': 'Fixed fee',
    'owner.sell_interest.card_title': 'Thinking of selling?',
    'owner.sell_interest.card_description':
      'We connect you with qualified buyers. Share your interest and we will explore options together.',
    'owner.sell_interest.action': 'Express interest',
    'owner.statements.view_all': 'View all statements',
  })) as Record<string, string>;

  return (
    <OwnerUnitDashboardClient
      unit={data.unit}
      summary={{
        ...data.summary,
        nextArrivalDate: data.summary.nextArrivalDate?.toISOString() ?? null,
        openTickets: data.summary.openTickets.map((ticket) => ({
          ...ticket,
          createdAt: ticket.createdAt.toISOString(),
        })),
      }}
      bookings={data.bookings.map((booking) => ({
        ...booking,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
      }))}
      alerts={data.alerts.map((alert) => ({
        ...alert,
        createdAt: alert.createdAt.toISOString(),
      }))}
      compliance={data.compliance}
      statements={data.statements.map((statement) => ({
        id: statement.id,
        periodStart: statement.periodStart.toISOString(),
        periodEnd: statement.periodEnd.toISOString(),
        publishedAt: statement.publishedAt?.toISOString() ?? null,
        createdAt: statement.createdAt.toISOString(),
        noiTh: statement.noiTh,
        ownerShareTh: statement.ownerShareTh,
      }))}
      sparkline={data.sparkline}
      trends={data.trends}
      labels={labels}
      locale={locale}
    />
  );
}
