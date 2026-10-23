import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { identityId: 'operator', isAdmin: false, roles: [] },
  mc: vi.fn(), department: vi.fn(), workspace: vi.fn(), readiness: vi.fn(),
  booking: { id: 'stay', projectId: 'resort', unitId: 'villa-a', adults: 1, children: 0,
    infants: 0, verificationStatus: 'verified', project: { name: 'Resort' },
    unit: { name: 'Villa A' }, _count: { guests: 1 } },
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/lib/prisma', () => ({ prisma: { booking: { findUnique: async () => state.booking } } }));
vi.mock('@/app/libs/projectScope', () => ({
  hasManagedUnitMcAccess: state.mc, hasProjectDepartmentAccess: state.department,
}));
vi.mock('@/modules/ops/workspace-unit-authority', () => ({ hasWorkspaceAdministratorUnitAccess: state.workspace }));
vi.mock('@/modules/ops', () => ({ getUnitReadinessMap: state.readiness }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND'); },
  redirect: (url: string) => { throw new Error('REDIRECT:' + url); },
}));
import Page from './page';

beforeEach(() => {
  vi.clearAllMocks();
  state.mc.mockResolvedValue(false);
  state.department.mockResolvedValue(false);
  state.workspace.mockResolvedValue(false);
  state.readiness.mockResolvedValue({ 'villa-a': { state: 'ready' } });
});
const open = () => Page({ params: Promise.resolve({ bookingId: 'stay' }) });

// Exercise the real shared resolver at the page boundary. Dependency mocks
// isolate the navigation regression; database mandate tests cover grant validity.
describe('guided check-in uses the Stay 360 front-desk authority', () => {
  it('admits an MC manager only for the booking’s exact managed unit', async () => {
    state.mc.mockImplementation(async (_user, scope) => scope.projectId === 'resort' && scope.unitId === 'villa-a');
    expect(await open()).toBeTruthy();
    expect(state.mc).toHaveBeenCalledWith(state.user, expect.objectContaining({ projectId: 'resort', unitId: 'villa-a' }));
  });

  it('admits an authorized isolated workspace administrator', async () => {
    state.workspace.mockResolvedValue(true);
    expect(await open()).toBeTruthy();
    expect(state.workspace).toHaveBeenCalledWith(expect.anything(), 'operator', expect.objectContaining({ unitId: 'villa-a' }));
  });

  it.each(['front_desk', 'reservations', 'housekeeping', 'finance'])('preserves the %s department boundary', async department => {
    state.department.mockImplementation(async (_user, projectId, requested) => projectId === 'resort' && requested === department);
    if (department === 'front_desk') expect(await open()).toBeTruthy();
    else {
      await expect(open()).rejects.toThrow('NOT_FOUND');
      expect(state.readiness).not.toHaveBeenCalled();
    }
  });

  it('rechecks a revoked unit mandate before exposing check-in', async () => {
    state.mc.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await open()).toBeTruthy();
    await expect(open()).rejects.toThrow('NOT_FOUND');
    expect(state.readiness).toHaveBeenCalledTimes(1);
  });
});
