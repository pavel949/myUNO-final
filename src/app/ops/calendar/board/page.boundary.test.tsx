import { describe, expect, it, vi } from 'vitest';

type BookingQuery = { where: { startDate: { lt: Date }; endDate: { gt?: Date; gte?: Date } } };
const { bookingQuery, blocksQuery } = vi.hoisted(() => ({
  bookingQuery: vi.fn(async ({ where }: BookingQuery) => {
    const bookings = [
      { id: 'first-day', start: '2026-10-20', end: '2026-10-21' },
      { id: 'last-day', start: '2026-10-26', end: '2026-10-27' },
      { id: 'outside', start: '2026-10-27', end: '2026-10-28' },
    ].map(({ id, start, end }) => ({
      id, unitId: 'unit', startDate: new Date(start + 'T00:00:00Z'), endDate: new Date(end + 'T00:00:00Z'),
      status: 'confirmed', channel: 'direct', holdExpiresAt: null,
      guestIdentity: { firstName: 'Synthetic', lastName: 'Guest' },
    }));
    return bookings.filter(booking => booking.startDate < where.startDate.lt &&
      (where.endDate.gte ? booking.endDate >= where.endDate.gte : booking.endDate > where.endDate.gt!));
  }),
  blocksQuery: vi.fn(async () => []),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'admin', isAdmin: true, roles: [] }) }));
vi.mock('@/app/libs/projectScope', () => ({ getDepartmentProjectIds: async () => ['project'], getMCProjectScopes: () => [] }));
vi.mock('@/modules/projects', () => ({ getMCManagedUnits: async () => [] }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  project: { findMany: async () => [{ id: 'project', name: 'Project' }] },
  unit: { findMany: async () => [{ id: 'unit', name: 'Unit', projectId: 'project', status: 'draft',
    inventoryCategoryId: null, inventoryCategory: null, project: { name: 'Project', status: 'draft' }, commercialOfferings: [] }] },
  booking: { findMany: bookingQuery }, blockedDate: { findMany: blocksQuery },
} }));
vi.mock('@/modules/booking', async () => await import('@/modules/booking/calendar-projection'));
vi.mock('@/components/ops/UnifiedStayCalendar', () => ({ default: () => null }));
vi.mock('@/modules/booking/source-authority', () => ({ allExcludedSourceControlledUnitIds: async () => [] }));
vi.mock('@/modules/core', () => ({ computeCanonicalCalendarRates: vi.fn() }));
vi.mock('@/modules/ops', () => ({ hasOperatingSpaceCapability: async () => true,
  getOperatingSpaceUnitIds: async () => ['unit'], getUnitReadinessMap: async () => ({}) }));
vi.mock('@/modules/integrations', () => ({ getChannelHealthForUnits: async () => ({}) }));
import Page from './page';

describe('calendar departure boundaries', () => {
  it('counts first and last visible day departures while retaining exclusive checkout occupancy', async () => {
    const page = await Page({ searchParams: Promise.resolve({ start: '2026-10-21', days: '7' }) });
    expect(page.props.departures).toBe(2);
    // A checkout on the first day is counted, but does not block that night.
    expect(page.props.cells.unit[0]).toMatchObject({ state: 'free', blocking: false });
    expect(page.props.cells.unit[6]).toMatchObject({ state: 'confirmed', bookingIds: ['outside'] });
    expect(blocksQuery).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ endDate: { gt: new Date('2026-10-21T00:00:00Z') } }),
    }));
  });
});
