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
  arrivals: 1, departures: 0,
};

describe('one calendar surface with mode-specific safe actions', () => {
  it('keeps MC occupancy in their authorized project/org scope and hides staff-only stay navigation', () => {
    render(<UnifiedStayCalendar {...props} mode="mc" organizationId="org-a"/>);
    expect(screen.queryByRole('link', { name: /Stay operations/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/mc/calendar');
    fireEvent.click(screen.getByRole('button', { name: /Villa A.*2026-09-29/ }));
    expect(screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href'))
      .toContain('/mc/units/unit-a');
    expect(screen.queryByRole('link', { name: /Open canonical stay/ })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /Next/ }));
    // Navigation stays on the same canonical board and retains organization.
    expect(screen.getByRole('link', { name: /Next/ }).getAttribute('href'))
      .toContain('organizationId=org-a');
  });

  it('retains staff canonical stay actions and unit editor', () => {
    render(<UnifiedStayCalendar {...props} mode="staff"/>);
    expect(screen.getByRole('link', { name: /Stay operations/ }).getAttribute('href'))
      .toBe('/ops/stays');
    fireEvent.click(screen.getByRole('button', { name: /Villa A.*2026-09-29/ }));
    expect(screen.getByRole('link', { name: /Open canonical stay/ }).getAttribute('href'))
      .toBe('/ops/stays/booking-a');
    expect(screen.getByRole('link', { name: /Open home calendar/ }).getAttribute('href'))
      .toContain('/ops/calendar/unit-a');
  });
});
