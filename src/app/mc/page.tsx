import React from 'react';
import { redirect } from 'next/navigation';
import { fetchMCDashboard, fetchMCFeeReport } from '@/app/actions/getMCDashboard';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { MCDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function MCPortalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc');
  }

  const mcRole = user.roles.find(
    (role) => role.role === 'mc_member' && role.projectId && role.organizationId
  );
  if (!mcRole) {
    redirect('/');
  }

  const data = await fetchMCDashboard(
    user.identityId,
    mcRole.projectId as string,
    mcRole.organizationId as string
  );

  // Current-month fee report for the reports tab
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let feeReport = null;
  try {
    feeReport = await fetchMCFeeReport(
      user.identityId,
      mcRole.projectId as string,
      mcRole.organizationId as string,
      periodStart,
      periodEnd
    );
  } catch {
    feeReport = null;
  }

  const labels = await getLabels({
    'mc.portal.title': 'Management Company Portal',
    'mc.portal.subtitle': 'Manage your units, bookings, and operations',
    'mc.tabs.overview': 'Overview',
    'mc.tabs.bookings': 'Bookings',
    'mc.tabs.tickets': 'Tickets',
    'mc.tabs.calendar': 'Calendar',
    'mc.tabs.reports': 'Fee Reports',
    'mc.stats.units': 'Managed Units',
    'mc.stats.bookings_month': 'Bookings This Month',
    'mc.stats.open_tickets': 'Open Tickets',
    'mc.stats.vs_last_month': 'vs last month',
    'mc.stats.new_period': 'New',
    'mc.units.title': 'Your Managed Units',
    'mc.units.empty': 'No units under management',
    'mc.units.per_night': '/ night',
    'mc.units.manage': 'Manage',
    'mc.bookings.title': 'Bookings',
    'mc.bookings.empty': 'No bookings',
    'mc.bookings.unit': 'Unit',
    'mc.bookings.guest': 'Guest',
    'mc.bookings.check_in': 'Check-in',
    'mc.bookings.check_out': 'Check-out',
    'mc.bookings.amount': 'Amount',
    'mc.bookings.status': 'Status',
    'mc.tickets.title': 'Tickets',
    'mc.tickets.empty': 'No open tickets',
    'mc.tickets.view': 'View',
    'mc.tickets.reported_by': 'Reported by',
    'mc.calendar.title': 'Calendar View',
    'mc.calendar.empty': 'No bookings in the period.',
    'mc.calendar.occupied': 'Booked',
    'mc.calendar.vacant': 'Free',
    'mc.calendar.no_data': 'No data',
    'mc.reports.title': 'Fee Reports',
    'mc.reports.empty': 'No fee data for this period.',
    'mc.reports.gross': 'Gross revenue',
    'mc.reports.fees': 'Platform fees',
    'mc.reports.by_unit': 'Gross & fees by unit',
    'mc.reports.net_of_fee': 'Net of fee',
    'mc.reports.platform_fee': 'Platform fee',
    'mc.chart.unit': 'Unit',
    'mc.chart.amount': 'Amount',
    'mc.chart.show_table': 'View as table',
    'mc.chart.hide_table': 'Hide table',
    'mc.status.confirmed': 'Confirmed',
    'mc.status.checked_in': 'Checked in',
    'mc.status.checked_out': 'Checked out',
    'mc.status.pending_payment': 'Pending payment',
    'mc.status.open': 'Open',
    'mc.status.acknowledged': 'Acknowledged',
    'mc.status.in_progress': 'In progress',
    'mc.status.waiting_reporter': 'Waiting for reporter',
    'mc.status.resolved': 'Resolved',
  });

  return <MCDashboardClient {...data} feeReport={feeReport as never} labels={labels} />;
}
