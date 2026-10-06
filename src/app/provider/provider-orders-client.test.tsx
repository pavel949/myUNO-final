// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import ProviderOrdersClient from './provider-orders-client';
import { LocaleProvider } from '@/components/LocaleProvider';

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
        initialOrders={[
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
  it('shows Phuket appointment time and puts requests before fulfilled history', () => {
    render(
      <LocaleProvider locale="en">
      <ProviderOrdersClient
        initialOrders={[
          {
            id: 'history', status: 'fulfilled',
            scheduledStart: '2026-09-01T10:00:00.000Z', scheduledEnd: null,
            quantity: 1, totalThb: 10000, serviceTitle: 'Earlier service',
            noteToProvider: null, acceptDeadline: null,
          },
          {
            id: 'new', status: 'placed',
            scheduledStart: '2026-09-01T10:00:00.000Z', scheduledEnd: null,
            quantity: 1, totalThb: 20000, serviceTitle: 'New request',
            noteToProvider: null, acceptDeadline: null,
          },
        ]}
        labels={{
          ...labels,
          'provider.orders.needs_response': 'Awaiting response',
          'provider.orders.to_fulfil': 'Ready to fulfil',
          'provider.orders.refresh': 'Refresh orders',
        }}
      />
      </LocaleProvider>
    );
    // Rendered in the visitor's UI locale and Phuket time (10:00 UTC = 17:00 ICT).
    expect(screen.getAllByText(/1 Sept 2026, 17:00 ICT/)).toHaveLength(2);
    const request = screen.getByText('New request');
    const history = screen.getByText('Earlier service');
    expect(request.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Awaiting response:/)).toBeInTheDocument();
  });

});
