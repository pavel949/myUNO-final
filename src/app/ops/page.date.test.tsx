import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const queryClock = vi.hoisted(() => ({
  instant: null as Date | null,
  advanceTo: null as string | null,
}));

// Exercise the real page/subtitle while keeping this date regression read-only
// and independent of authentication, database state and child workspaces.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => ({ identityId: 'operator', isAdmin: true }),
}));
vi.mock('@/lib/i18n', () => ({
  getRequestLocale: () => 'en',
  getLabels: async (fallbacks: Record<string, string>) => fallbacks,
}));
vi.mock('@/modules/ops', () => ({
  getOpsBoard: async (_db: unknown, instant: Date) => {
    queryClock.instant = instant;
    if (queryClock.advanceTo) vi.setSystemTime(new Date(queryClock.advanceTo));
    return {
      arrivals: [], departures: [], pendingRequests: [], pendingPayment: [],
      pendingServiceOrders: [], openTickets: [],
      slaMetrics: { tm30OnTimeRate7d: 100, ticketsWithOpenSLA: 0 },
    };
  },
  getOpsMobilizationQueue: async () => [],
}));
vi.mock('@/modules/booking', () => ({ getBookingDeclineReasonOptions: async () => [] }));
vi.mock('@/modules/integrations', () => ({ getProjectIcalConflictAlerts: async () => [] }));
vi.mock('@/app/libs/opsProjectContext', () => ({
  resolveOpsProjectContext: () => ({ isAdmin: true, staffProjectIds: [], activeProjectId: null }),
  loadOpsSwitcherProjects: async () => [],
  validatedActiveProjectId: () => null,
  opsBoardScope: () => undefined,
  opsHref: (path: string) => path,
}));
vi.mock('./ops-client', () => ({ default: () => null }));
vi.mock('@/components/ops/OpsProjectSwitcher', () => ({ default: () => null }));
vi.mock('@/components/units/UnitIcalConflictBanner', () => ({
  default: () => null,
  UNIT_ICAL_CALENDAR_SURFACES: { ops: 'ops' },
}));

import OpsBoardPage from './page';

afterEach(() => {
  vi.useRealTimers();
  queryClock.instant = null;
  queryClock.advanceTo = null;
});

describe('Today subtitle operating day', () => {
  it('keeps the queried day in the heading when the board query crosses midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T16:59:59.999Z'));
    queryClock.advanceTo = '2026-10-10T17:00:00.000Z';
    render(await OpsBoardPage({}));
    expect(queryClock.instant?.toISOString()).toBe('2026-10-10T16:59:59.999Z');
    expect(new Date().toISOString()).toBe('2026-10-10T17:00:00.000Z');
    expect(screen.getByText('10 Oct 2026 · 0 arrivals, 0 departures, 0 unpaid')).toBeInTheDocument();
    expect(screen.queryByText('11 Oct 2026 · 0 arrivals, 0 departures, 0 unpaid')).not.toBeInTheDocument();
  });

  it.each([
    ['2026-10-10T09:00:00.000Z', '10 Oct 2026'],
    ['2026-10-10T16:59:59.999Z', '10 Oct 2026'],
    ['2026-10-10T17:00:00.000Z', '11 Oct 2026'],
    ['2026-10-10T18:28:00.000Z', '11 Oct 2026'],
  ])('shows the Bangkok day at %s', async (instant, day) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instant));
    render(await OpsBoardPage({}));
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText(`${day} · 0 arrivals, 0 departures, 0 unpaid`)).toBeInTheDocument();
  });
});
