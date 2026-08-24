// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ActiveOrdersList } from './ActiveOrdersList';

// Q47 regression guard: order.totalThb arrives as satang (THB × 100)
// straight from getInStayHomeSpace — the list must show baht, not raw
// satang (this call site was flagged as "already confirmed buggy").
describe('ActiveOrdersList money display', () => {
  it('renders the order total converted to baht, not raw satang', () => {
    render(
      <ActiveOrdersList
        orders={[
          {
            id: 'order-1',
            serviceId: 'svc-1',
            serviceName: 'Airport transfer',
            status: 'accepted',
            totalThb: 250000, // ฿2,500
            scheduledStart: '2026-09-01T10:00:00.000Z',
            scheduledEnd: '2026-09-01T11:00:00.000Z',
          },
        ]}
      />
    );
    // Intl.NumberFormat('th-TH', {style: 'currency', currency: 'THB'})
    // renders as "THB2,500" (no fraction digits) — assert the digit group,
    // not the exact currency glyph, and assert the wrong value is absent.
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
    expect(screen.queryByText(/250,000/)).not.toBeInTheDocument();
  });

  it('renders an empty state with no orders', () => {
    render(<ActiveOrdersList orders={[]} />);
    expect(screen.getByText('No active orders')).toBeInTheDocument();
  });
});
