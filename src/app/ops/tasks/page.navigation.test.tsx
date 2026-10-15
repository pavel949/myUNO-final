import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  access: vi.fn(), legacyUnits: vi.fn(), units: vi.fn(), tasks: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'staff' }) }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findMany: mocks.units }, operationalTask: { findMany: mocks.tasks },
  operatingSpaceMember: { findUnique: async () => ({ capabilities: ['manage_tasks'] }) },
} }));
vi.mock('@/modules/ops/operating-space-access.service', () => ({
  getScopedOperationalAccess: mocks.access, getLegacyOperationalUnitIds: mocks.legacyUnits,
  operationalTaskVisibility: async () => ({ unitId: { in: ['v1'] } }),
  OperatingAccessError: class extends Error {}, TASK_DEPARTMENTS: ['housekeeping'],
}));
vi.mock('@/lib/i18n', () => ({ getLabels: async (defaults: Record<string, string>) => defaults }));
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('not-found'); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/components/ops/OperationalTaskQueueClient', () => ({ default: () => null }));
import OperationalTasksPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ space: { timezone: 'Asia/Bangkok', organizationId: 'org' }, unitIds: ['v1', 'v2'], isAdmin: false });
  mocks.legacyUnits.mockResolvedValue(['v1']);
  mocks.units.mockResolvedValue([
    { id: 'v1', name: 'V1', project: { name: 'Estate' } },
    { id: 'v2', name: 'V2', project: { name: 'Estate' } },
  ]);
  mocks.tasks.mockResolvedValue([]);
});

// Render the actual server page and create form; authorization dependencies are mocked.
describe('readiness queue calendar context', () => {
  it('selects the requested authorized unit in the real form and returns to its calendar scope', async () => {
    const { container } = render(await OperationalTasksPage({ searchParams: { spaceId: 'space', unitId: 'v1' } }));
    expect(container.querySelector('[name=unitId]')).toHaveValue('v1');
    expect(screen.getByRole('link', { name: '← Calendar' })).toHaveAttribute('href', '/ops/calendar/board?spaceId=space&unitId=v1');
    expect(mocks.access).toHaveBeenCalledWith(expect.anything(), 'staff', 'space', 'manage_tasks', ['housekeeping']);
    expect(mocks.units).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['v1', 'v2'] } } }));
    expect(mocks.tasks).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      AND: [{ unitId: { in: ['v1', 'v2'] }, OR: [{ operatingSpaceId: 'space' }, { operatingSpaceId: null }] }, { unitId: 'v1' }],
    }) }));
  });

  it('resets the form to the new unit on same-route navigation', async () => {
    const { container, rerender } = render(await OperationalTasksPage({ searchParams: { spaceId: 'space', unitId: 'v1' } }));
    rerender(await OperationalTasksPage({ searchParams: { spaceId: 'space', unitId: 'v2' } }));
    expect(container.querySelector('[name=unitId]')).toHaveValue('v2');
  });

  it.each([{}, { spaceId: 'space' }, { spaceId: 'space', mc: '1' }, { mc: '1' }])('keeps calendar and MC scope without requiring a unit (%j)', async searchParams => {
    const { container } = render(await OperationalTasksPage({ searchParams }));
    const url = new URL(screen.getByRole('link', { name: '← Calendar' }).getAttribute('href')!, 'https://myuno.test');
    expect(url.pathname).toBe('/ops/calendar/board');
    expect(Object.fromEntries(url.searchParams)).toEqual(searchParams);
    const select = container.querySelector('[name=unitId]');
    if ('spaceId' in searchParams) expect(select).toHaveValue('');
    else expect(select).toBeNull();
  });

  it.each([{ unitId: 'foreign' }, { unitId: 'v2', mc: '1' }])('rejects units outside effective workspace authority (%j)', async params => {
    await expect(OperationalTasksPage({ searchParams: { spaceId: 'space', ...params } })).rejects.toThrow('not-found');
    expect(mocks.units).not.toHaveBeenCalled();
    expect(mocks.tasks).not.toHaveBeenCalled();
  });

  it('rejects workspace access before querying options or tasks', async () => {
    const { OperatingAccessError } = await import('@/modules/ops/operating-space-access.service');
    mocks.access.mockRejectedValue(new OperatingAccessError('denied'));
    await expect(OperationalTasksPage({ searchParams: { spaceId: 'foreign', unitId: 'v1' } })).rejects.toThrow('not-found');
    expect(mocks.units).not.toHaveBeenCalled();
    expect(mocks.tasks).not.toHaveBeenCalled();
  });

  it('encodes workspace context as values rather than query syntax', async () => {
    const spaceId = 'space /?&=+#ไทย';
    render(await OperationalTasksPage({ searchParams: { spaceId, unitId: 'v1', mc: '1' } }));
    const url = new URL(screen.getByRole('link', { name: '← Calendar' }).getAttribute('href')!, 'https://myuno.test');
    expect(Object.fromEntries(url.searchParams)).toEqual({ spaceId, unitId: 'v1', mc: '1' });
    expect(url.hash).toBe('');
  });
});
