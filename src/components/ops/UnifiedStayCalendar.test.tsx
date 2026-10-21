// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup, within } from '@testing-library/react';
import UnifiedStayCalendar from './UnifiedStayCalendar';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: {
    children: React.ReactNode; href: string; [key: string]: unknown;
  }) => <a href={href} {...props}>{children}</a>,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const labels: Record<string,string> = {
  'staff.unified_calendar.title': 'Portfolio stay calendar',
  'staff.unified_calendar.kicker': 'ONE INVENTORY',
  'staff.unified_calendar.subtitle': 'Canonical bookings',
  'staff.unified_calendar.back': 'Back',
  'staff.unified_calendar.work_queue': 'Stay operations',
  'staff.unified_calendar.refresh': 'Refresh',
  'staff.unified_calendar.available': 'Available',
  'staff.unified_calendar.not_sellable': 'Not on sale',
  'staff.unified_calendar.booked': 'Booked',
  'staff.unified_calendar.holds': 'Holds',
  'staff.unified_calendar.arrivals': 'Arrivals',
  'staff.unified_calendar.departures': 'Departures',
  'staff.unified_calendar.project': 'Property',
  'staff.unified_calendar.all_projects': 'All properties',
  'staff.unified_calendar.category': 'Category',
  'staff.unified_calendar.all_categories': 'All categories',
  'staff.unified_calendar.home': 'Home',
  'staff.unified_calendar.all_homes': 'All homes',
  'staff.unified_calendar.search': 'Search',
  'staff.unified_calendar.prev': 'Previous',
  'staff.unified_calendar.next': 'Next',
  'staff.unified_calendar.today': 'Today',
  'staff.unified_calendar.days_suffix': ' days',
  'staff.unified_calendar.project_home': 'Property / Home',
  'staff.unified_calendar.inspect': 'Night details',
  'staff.unified_calendar.open_unit': 'Open home calendar',
  'staff.unified_calendar.open_stay': 'Open canonical stay',
  'staff.unified_calendar.manage_block': 'Manage block',
  'staff.unified_calendar.read_only': 'Read-only',
  'staff.unified_calendar.source': 'Live myUNO database',
  'staff.unified_calendar.no_entries': 'No entries',
  'staff.unified_calendar.readiness': 'Readiness',
  'staff.unified_calendar.ready': 'Ready',
  'staff.unified_calendar.needs_cleaning': 'Needs cleaning',
  'staff.unified_calendar.needs_inspection': 'Needs inspection',
  'staff.unified_calendar.in_progress': 'In progress',
  'staff.unified_calendar.channel_health': 'Channels',
  'staff.unified_calendar.rate_unavailable': 'Rate unavailable',
  'staff.unified_calendar.effective_rate': 'Effective daily rate',
  'staff.unified_calendar.tasks': 'Housekeeping & readiness',
};
const props = {
  labels, today: '2026-09-29', start: '2026-09-29',
  days: ['2026-09-29'], daysCount: 7,
  projects: [{ id: 'project-a', name: 'Resort' }],
  categories: [{ id: 'category-a', name: '2BR' }],
  units: [{
    id: 'unit-a', name: 'Villa A', projectId: 'project-a',
    projectName: 'Resort', categoryId: 'category-a',
    categoryName: '2BR', sellable: true,
    readiness: 'ready' as const, openTaskCount: 0,
    channelState: 'healthy' as const,
    channelRows: [{
      channel: 'airbnb', state: 'healthy' as const,
      availability: 'push' as const, rates: 'push' as const,
      restrictions: 'push' as const, lastSyncAt: null, error: null,
    }],
  }],
  allUnits: [{ id: 'unit-a', name: 'Villa A' }],
  projectId: 'project-a', categoryId: 'category-a', unitId: '',
  cells: { 'unit-a': [{
    state: 'confirmed' as const, entryIds: ['booking-a'],
    bookingIds: ['booking-a'], blocking: true,
  }] },
  entries: { 'booking-a': {
    id: 'booking-a', kind: 'booking' as const, status: 'confirmed',
    channel: 'direct', label: 'Reservation',
  } },
  rates: {
    'unit-a': {
      error: null,
      byDate: { '2026-09-29': { nightlyThb: 650000, source: 'category_season' } },
    },
  },
  arrivals: 1, departures: 0,
};

describe('one calendar surface with mode-specific safe actions', () => {
  it('keeps MC occupancy in their authorized project/org scope and hides staff-only stay navigation', () => {
    render(<UnifiedStayCalendar {...props} mode="mc" organizationId="org-a"/>);
    expect(screen.queryByRole('link', { name: /Stay operations/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/mc');
    fireEvent.click(screen.getAllByRole('button', { name: /Villa A.*2026-09-29/ })[0]);
    const propertyHref = screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href') || '';
    expect(propertyHref).toContain('/mc/properties/unit-a');
    expect(propertyHref).toContain('projectId=project-a');
    expect(propertyHref).toContain('organizationId=org-a');
    expect(propertyHref).toContain('origin=calendar');
    expect(propertyHref).toContain('tab=calendar');
    expect(propertyHref).toContain('date=2026-09-29');
    expect(propertyHref).toContain('calendarStart=2026-09-29');
    expect(propertyHref).toContain('days=7');
    expect(propertyHref).toContain('categoryId=category-a');
    expect(screen.queryByRole('link', { name: /Open canonical stay/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Housekeeping & readiness/ }).getAttribute('href'))
      .toContain('mc=1');
    // Navigation stays on the same canonical board and retains organization.
    const nextHref = screen.getByRole('link', { name: /Next/ }).getAttribute('href') || '';
    expect(nextHref).toContain('organizationId=org-a');
    expect(nextHref).toContain('mc=1');
    expect(screen.getByRole('link', { name: '30 days' })).toBeTruthy();
    expect((screen.getByLabelText('Property') as HTMLSelectElement).disabled).toBe(false);
  });

  it('retains staff canonical stay actions and unit editor', () => {
    render(<UnifiedStayCalendar {...props} mode="staff"/>);
    expect(screen.getByRole('link', { name: /Stay operations/ }).getAttribute('href'))
      .toBe('/ops/stays?projectId=project-a');
    fireEvent.click(screen.getAllByRole('button', { name: /Villa A.*2026-09-29/ })[0]);
    expect(screen.getByRole('link', { name: /Open canonical stay/ }).getAttribute('href'))
      .toBe('/ops/stays/booking-a');
    expect(screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href'))
      .toContain('/ops/calendar/unit-a');
    expect(screen.getByText(/category_season/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Housekeeping & readiness/ }).getAttribute('href'))
      .toContain('/ops/tasks?unitId=unit-a');
  });
  it('retains operating space through range, filters, stay and unit/task drilldowns', () => {
    render(<UnifiedStayCalendar {...props} spaceId="resort-space" mode="staff" />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/ops/spaces/resort-space');
    for (const name of [/Next/, /Previous/, /^Today$/, /30 days/, /Stay operations/]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toContain('spaceId=resort-space');
    }
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '' } });
    expect(push.mock.calls.at(-1)?.[0]).toContain('spaceId=resort-space');
    fireEvent.click(screen.getAllByRole('button', { name: /Villa A.*2026-09-29/ })[0]);
    for (const name of [/Open canonical stay/, /Open home calendar/, /Housekeeping & readiness/]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toContain('spaceId=resort-space');
    }
  });

  it.each(['staff', 'mc'] as const)('retains the advanced range and original board filters through tasks (%s)', mode => {
    const current = { ...props, start: '2026-10-15', days: ['2026-10-15'], daysCount: 14,
      mode, spaceId: 'resort-space', organizationId: mode === 'mc' ? 'org-a' : '' };
    const { rerender } = render(<UnifiedStayCalendar {...current} />);
    const next = new URL(screen.getByRole('link', { name: /Next/ }).getAttribute('href')!, 'https://myuno.test');
    const start = next.searchParams.get('start')!;
    expect(start).toBe('2026-10-29');
    rerender(<UnifiedStayCalendar {...current} start={start} days={[start]} />);
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`Villa A.*${start}`) })[0]);
    const tasks = new URL(screen.getByRole('link', { name: /Housekeeping & readiness/ }).getAttribute('href')!, 'https://myuno.test');
    expect(tasks.pathname).toBe('/ops/tasks');
    expect(tasks.searchParams.get('unitId')).toBe('unit-a');
    expect(tasks.searchParams.get('spaceId')).toBe('resort-space');
    expect(tasks.searchParams.get('returnTo')).toBe(next.pathname + next.search);
    // The board was showing all category units, not just the selected task unit.
    expect(new URL(tasks.searchParams.get('returnTo')!, 'https://myuno.test').searchParams.has('unitId')).toBe(false);
  });

});


describe('calendar refresh and available inventory', () => {
  it('refreshes open night details when canonical occupancy changes', () => {
    const free = { state: 'free' as const, entryIds: [], bookingIds: [], blocking: false };
    const { rerender } = render(<UnifiedStayCalendar {...props} cells={{ 'unit-a': [free] }} entries={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /Villa A.*2026-09-29.*Available/ }));
    expect(within(screen.getByRole('region', { name: 'Night details' })).getByText('Available')).toBeTruthy();

    rerender(<UnifiedStayCalendar {...props} />);
    const occupied = screen.getByRole('region', { name: 'Night details' });
    expect(within(occupied).getByText('Reserved')).toBeTruthy();
    expect(within(occupied).getByRole('link', { name: /Open canonical stay/ }).getAttribute('href'))
      .toBe('/ops/stays/booking-a');

    rerender(<UnifiedStayCalendar {...props} cells={{ 'unit-a': [free] }} entries={{}} />);
    const released = screen.getByRole('region', { name: 'Night details' });
    expect(within(released).getByText('Available')).toBeTruthy();
    expect(within(released).getByText('No entries')).toBeTruthy();
    expect(within(released).queryByRole('link', { name: /Open canonical stay/ })).toBeNull();

    rerender(<UnifiedStayCalendar {...props} start="2026-10-01" days={['2026-10-01']} />);
    expect(screen.queryByRole('region', { name: 'Night details' })).toBeNull();
  });

  it('counts nonblocking request nights as available while excluding holds and unsellable units', () => {
    const unit = props.units[0];
    const request = { state: 'request' as const, entryIds: ['booking-a'], bookingIds: ['booking-a'], blocking: false };
    const hold = { state: 'hold' as const, entryIds: ['hold'], bookingIds: ['hold'], blocking: true };
    render(<UnifiedStayCalendar {...props}
      units={[unit, { ...unit, id: 'held' }, { ...unit, id: 'unsellable', sellable: false }]}
      cells={{ 'unit-a': [request], held: [hold], unsellable: [request] }} />);
    const summary = screen.getByRole('region', { name: 'Calendar summary' });
    expect(within(summary).getByText('Available').parentElement).toHaveTextContent('Available1');
    expect(within(summary).getByText('Holds').parentElement).toHaveTextContent('Holds1');
  });
});
