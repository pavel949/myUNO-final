import { beforeEach, describe, it, expect, vi } from 'vitest';
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
beforeEach(() => {
  push.mockClear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});

describe('DiscoverySearch', () => {
  it('requires dates and avoids native mobile date inputs', () => {
    const { container } = render(<DiscoverySearch labels={labels} />);
    expect(container.querySelector('input[type="date"]')).toBeNull();
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid dates');
    expect(push).not.toHaveBeenCalled();
  });
  it('selects a stay range and sends all rental filters', () => {
    render(<DiscoverySearch labels={labels} areas={[{slug: 'layan', name: 'Layan'}]} />);
    fireEvent.click(screen.getByRole('button', {name: 'Check-in → Check-out'}));
    const days = screen.getAllByRole('button', {name: /\w+, \w+ \d+, \d{4}/}).filter(button => !button.hasAttribute('disabled'));
    expect(days.length).toBeGreaterThan(1);
    fireEvent.click(days[0]); fireEvent.click(days[1]);
    fireEvent.change(screen.getByLabelText('Where'), {target: {value: 'area:layan'}});
    fireEvent.change(screen.getByLabelText('Property type'), {target: {value: 'villa'}});
    fireEvent.change(screen.getByLabelText('Bedrooms'), {target: {value: '2'}});
    fireEvent.change(screen.getByLabelText('Budget up to, ฿ / night'), {target: {value: '8000'}});
    fireEvent.submit(screen.getByRole('form'));
    const url = new URL(push.mock.calls[0][0], 'https://example.com');
    expect(url.pathname).toBe('/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({areaSlug: 'layan', unitTypes: 'villa', bedrooms: '2', maxPrice: '8000', adults: '2', children: '0'});
  });
  it('changes fields and forwards purchase filters', () => {
    render(<DiscoverySearch labels={labels} projects={[{id: 'p1', name: 'Project'}]} />);
    fireEvent.click(screen.getByRole('button', {name: 'Buy'}));
    expect(screen.queryByLabelText('Adults')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Check-in → Check-out'})).toBeNull();
    fireEvent.change(screen.getByLabelText('Where'), {target: {value: 'project:p1'}});
    fireEvent.change(screen.getByLabelText('Property type'), {target: {value: 'condo'}});
    fireEvent.change(screen.getByLabelText('Purchase budget up to, ฿'), {target: {value: '5000000'}});
    fireEvent.submit(screen.getByRole('form'));
    expect(push).toHaveBeenCalledWith('/homes?intent=buy&projectId=p1&type=condo&maxPrice=5000000');
  });
  it('connects management and selling to existing workflows', () => {
    render(<DiscoverySearch labels={labels} />);
    fireEvent.click(screen.getByRole('button', {name: 'Manage'}));
    fireEvent.submit(screen.getByRole('form'));
    expect(push).toHaveBeenLastCalledWith('/property/onboard?kind=home&operatingModel=direct_managed');
    fireEvent.click(screen.getByRole('button', {name: 'Sell'}));
    fireEvent.submit(screen.getByRole('form'));
    expect(push).toHaveBeenLastCalledWith('/property/onboard?kind=home&offers=sale');
  });
});
