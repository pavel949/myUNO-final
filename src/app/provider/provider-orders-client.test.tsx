// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import ProviderOrdersClient from './provider-orders-client';

// Q47 regression guard: order.totalThb arrives as satang (THB × 100)
// straight from serializeOrder — the provider's order queue must show
// baht, not raw satang.
describe('ProviderOrdersClient money display', () => {
  const labels = {
    'provider.orders.title': 'Order queue',
    'provider.orders.empty': 'No orders yet',
    'provider.orders.accept': 'Accept',
    'provider.orders.decline': 'Decline',
    'provider.orders.note': 'Customer note',
  };

  it('renders the order total converted to baht, not raw satang', () => {
    render(
      <ProviderOrdersClient
        orders={[
          {
            id: 'order-1',
            status: 'placed',
            scheduledStart: '2026-09-01T10:00:00.000Z',
            scheduledEnd: null,
            quantity: 1,
            totalThb: 300000, // ฿3,000
            serviceTitle: 'Yacht charter',
            noteToProvider: null,
            acceptDeadline: null,
          },
        ]}
        labels={labels}
      />
    );
    expect(screen.getByText(/฿3,000/)).toBeInTheDocument();
    expect(screen.queryByText(/300,000/)).not.toBeInTheDocument();
  });
});
