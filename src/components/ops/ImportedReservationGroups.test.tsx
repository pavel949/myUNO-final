import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImportedReservationGroups from './ImportedReservationGroups';

describe('imported group operational display', () => {
  it('shows one source quote, unknown villa amounts and no financial actions', () => {
    const group = {
      id: 'group', sourceReference: 'SYNTHETIC-001', quotedTotalThb: 123456,
      sourcePaymentStatus: 'Unpaid', reportedPaidThb: 0, adults: null, children: null,
      reservationGroup: { guest: { firstName: 'Synthetic', lastName: 'Fixture' }, notes: 'Check source notes' },
      placements: ['AA', 'V7'].map((name, index) => ({ id: String(index), unit: { name }, allocatedTotalThb: null,
        blockedDate: { startDate: new Date('2026-12-17T00:00:00Z'), endDate: new Date('2026-12-22T00:00:00Z') } })),
    } as unknown as React.ComponentProps<typeof ImportedReservationGroups>['groups'][number];
    render(<ImportedReservationGroups groups={[group]} />);
    expect(screen.getAllByText(/1,234\.56/)).toHaveLength(1);
    expect(screen.getAllByText(/Villa amount not allocated/)).toHaveLength(2);
    expect(screen.getByText(/Guest counts awaiting confirmation/)).toBeTruthy();
    expect(screen.getByText(/not a receipt/)).toBeTruthy();
    expect(screen.getByText(/owner settlement are unavailable/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('does not present an empty group list as operational bookings', () => {
    const { container } = render(<ImportedReservationGroups groups={[]} />);
    expect(container.textContent).toBe('');
  });
});
