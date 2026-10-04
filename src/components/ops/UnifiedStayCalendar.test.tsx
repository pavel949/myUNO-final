// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
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
  it('keeps MC occupancy in scope and opens the canonical booking from the calendar', () => {
    render(<UnifiedStayCalendar {...props} mode="mc" organizationId="org-a"/>);
    expect(screen.queryByRole('link', { name: /Stay operations/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/mc');
    fireEvent.click(screen.getAllByRole('button', { name: /Villa A.*2026-09-29/ })[0]);
    expect(screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href'))
      .toContain('/mc/properties/unit-a');
    expect(screen.getByRole('link', { name: /Open booking details/ }).getAttribute('href'))
      .toBe('/ops/stays/booking-a');
    expect(screen.getByText('Confirmed booking')).toBeTruthy();
    expect(screen.getByText('Dates locked')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Manage block/ }).getAttribute('href'))
      .toContain('tab=calendar');
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
      .toBe('/ops/stays');
    fireEvent.click(screen.getAllByRole('button', { name: /Villa A.*2026-09-29/ })[0]);
    expect(screen.getByRole('link', { name: /Open booking details/ }).getAttribute('href'))
      .toBe('/ops/stays/booking-a');
    expect(screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href'))
      .toContain('/ops/calendar/unit-a');
    expect(screen.getByText(/category_season/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Housekeeping & readiness/ }).getAttribute('href'))
      .toContain('/ops/tasks?unitId=unit-a');
  });
});
