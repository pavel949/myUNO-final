import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DiscoverySearch } from './DiscoverySearch';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const labels = {
  rent: 'Rent', buy: 'Buy', manage: 'Manage', sell: 'Sell', where: 'Where',
  allPhuket: 'All Phuket', locations: 'Locations', projects: 'Projects',
  checkIn: 'Check-in', checkOut: 'Check-out', adults: 'Adults', children: 'Children',
  explore: 'Search', properties: 'Continue', hint: 'Choose your next step', error: 'Invalid dates',
};

describe('DiscoverySearch', () => {
  it('rejects an expired arrival even when departure is later', () => {
    push.mockClear();
    render(<DiscoverySearch labels={labels} />);
    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: '2000-01-01' } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2000-01-03' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid dates');
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps search usable on tablets and requires a complete guest count', () => {
    render(<DiscoverySearch labels={labels} />);
    expect(screen.getByLabelText('Where').closest('label')?.parentElement?.className).toContain('lg:grid-cols-');
    expect(screen.getByLabelText('Adults')).toBeRequired();
    expect(screen.getByLabelText('Children')).toBeRequired();
  });
});
