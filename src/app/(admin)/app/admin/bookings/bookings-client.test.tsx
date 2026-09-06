// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import BookingsAdminClient from './bookings-client';

const labels: Record<string, string> = {
  'admin.bookings.error_generic': 'Action failed. Please try again.',
  'admin.bookings.empty': 'No bookings yet.',
  'admin.bookings.filtered_empty': 'No bookings match this filter.',
  'admin.bookings.channel_all': 'All channels',
};

const booking = {
  id: 'bk-1',
  status: 'confirmed',
  startDate: '2026-01-04T00:00:00.000Z',
  endDate: '2026-01-12T00:00:00.000Z',
  totalThb: 36600,
  unitName: 'B-707',
  guestName: 'Anna Sokolova',
  paid: true,
  receiptRef: null,
  guestIdentityId: 'identity-1',
  guestInvited: false,
  channel: 'direct',
  guestNote: null,
  internalNote: null,
};

// Board 19's state coverage matrix: a channel filter matching zero bookings
// rendered nothing at all, indistinguishable from a slow network. This locks
// in the distinct "no bookings match this filter" message.
describe('BookingsAdminClient — filtered-to-zero (board 19)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [booking],
          pagination: { total: 1, hasMore: false },
        }),
      })
    );
  });

  it('shows a distinct message when the channel filter matches nothing on this page', async () => {
    render(<BookingsAdminClient labels={labels} declineReasons={[]} />);

    await waitFor(() => expect(screen.getByText('Anna Sokolova')).toBeInTheDocument());
    expect(screen.queryByText('No bookings match this filter.')).not.toBeInTheDocument();

    // The fixture's only booking is on "direct" — the channel select still
    // offers every BookingChannel enum value (not just ones on this loaded
    // page), so "airbnb" is selectable and legitimately matches zero here.
    await userEvent.selectOptions(screen.getByRole('combobox'), 'airbnb');
    expect(screen.getByText('No bookings match this filter.')).toBeInTheDocument();
    expect(screen.queryByText('Anna Sokolova')).not.toBeInTheDocument();
  });
});
