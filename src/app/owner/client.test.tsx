import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OwnerDashboardClient } from './client';
import type { OwnerTrends } from '@/app/actions/getOwnerDashboard';

const labels: Record<string, string> = {
  'owner.dashboard.title': 'Owner dashboard',
  'owner.dashboard.subtitle': 'Manage your properties',
  'owner.units.empty_title': 'No units yet',
  'owner.units.empty_description': 'When a unit is registered to you, it will appear here.',
};

const emptyTrends: OwnerTrends = { monthly: [], prevMonth: null, sparklines: {} };

// Board 19's state coverage matrix names this as a genuine gap: an owner with
// zero units rendered the full portfolio dashboard (stat tiles at zero,
// no unit list, no message explaining why) rather than a clear empty state.
describe('OwnerDashboardClient — zero units (board 19 state coverage)', () => {
  it('shows an explanatory empty state instead of an empty dashboard', () => {
    render(
      <OwnerDashboardClient
        dashboard={{
          identityId: 'identity-1',
          units: [],
          combinedOccupancyThisMonth: 0,
          combinedRevenueThisMonth: 0,
          alertsCount: 0,
        }}
        shape={{ unitCount: 0, projectCount: 0, isPortfolio: false, projectIds: [] }}
        projects={[]}
        bookings={[]}
        trends={emptyTrends}
        alerts={[]}
        complianceSummary={[]}
        statements={[]}
        labels={labels}
        locale="en"
      />
    );

    expect(screen.getByText('No units yet')).toBeInTheDocument();
    expect(
      screen.getByText('When a unit is registered to you, it will appear here.')
    ).toBeInTheDocument();
    expect(screen.queryByText('0 nights')).not.toBeInTheDocument();
  });
});
