import React from 'react';
import { redirect } from 'next/navigation';
import { fetchOwnerDashboard } from '@/app/actions/getOwnerDashboard';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { resolveOwnerPortalPath } from '@/modules/projects';
import { OwnerDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/owner');
  }

  const isOwner = user.roles.some((role) => role.role === 'owner');
  if (!isOwner) {
    redirect('/');
  }

  const data = await fetchOwnerDashboard(user.identityId);
  const ownerPath = resolveOwnerPortalPath(data.shape, data.dashboard.units);
  if (ownerPath !== '/owner') {
    redirect(ownerPath);
  }

  const locale = getRequestLocale();

  const labels = await getLabels({
    'owner.dashboard.title': 'Owner Dashboard',
    'owner.dashboard.subtitle': 'Manage your properties and stay informed',
    'owner.dashboard.occupancy_this_month': 'Occupied This Month',
    'owner.dashboard.revenue_this_month': 'Revenue This Month',
    'owner.stats.nights': 'nights',
    'owner.stats.vs_last_month': 'vs last month',
    'owner.stats.new_period': 'New',
    'owner.trends.title': 'Last 6 Months',
    'owner.trends.revenue': 'Revenue by month',
    'owner.trends.occupancy': 'Occupancy by month',
    'owner.trends.empty': 'No history yet — trends appear after the first nightly rollup.',
    'owner.chart.month': 'Month',
    'owner.chart.revenue': 'Revenue',
    'owner.chart.occupancy': 'Occupancy %',
    'owner.chart.show_table': 'View as table',
    'owner.chart.hide_table': 'Hide table',
    'owner.units.occupancy': 'Occupancy',
    'owner.units.revenue': 'Revenue',
    'owner.units.bookings': 'Bookings',
    'owner.units.open_tickets': 'Open tickets',
    'owner.units.view_detail': 'Unit dashboard',
    'owner.units.last30': 'Occupancy, last 30 nights',
    'owner.sections.bookings': 'Recent Bookings',
    'owner.sections.statement': 'Latest Statement',
    'owner.sections.tickets': 'Open Tickets',
    'owner.switcher.select_project': 'Select project',
    'owner.switcher.unit_singular': 'unit',
    'owner.switcher.unit_plural': 'units',
    'owner.stay.book_action': 'Stay in My Unit',
    'owner.stay.error': 'Failed to book owner stay',
    'owner.actions.title': 'Quick actions',
    'owner.actions.raise_ticket': 'Raise a request',
    'owner.actions.book_service': 'Book a service',
    'owner.alert.action_view': 'View',
    'owner.bookings.empty': 'No bookings yet',
    'owner.bookings.unknown_nationality': 'Unknown',
    'owner.tickets.empty': 'No open tickets',
    'owner.tickets.waiting_count': '{count} requests waiting for attention',
    'owner.tickets.view': 'View',
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
    'owner.sell_interest.card_title': 'Thinking of selling?',
    'owner.sell_interest.card_description':
      'We connect you with qualified buyers. Share your interest and we will explore options together.',
    'owner.sell_interest.action': 'Express interest',
    'owner.statements.view_all': 'View all statements',
  });

  return <OwnerDashboardClient {...data} labels={labels} locale={locale} />;
}
