import React from 'react';
import { redirect } from 'next/navigation';
import { fetchOwnerDashboard } from '@/app/actions/getOwnerDashboard';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { OwnerDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/owner');
  }

  const data = await fetchOwnerDashboard(user.identityId);

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
    'owner.units.last30': 'Occupancy, last 30 nights',
    'owner.sections.bookings': 'Recent Bookings',
    'owner.sections.statement': 'Latest Statement',
    'owner.sections.tickets': 'Open Tickets',
    'owner.stay.book_action': 'Stay in My Unit',
    'owner.stay.error': 'Failed to book owner stay',
  });

  return <OwnerDashboardClient {...data} labels={labels} />;
}
