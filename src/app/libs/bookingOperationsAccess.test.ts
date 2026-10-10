import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { canApproveBookingCandidate, resolveBookingOperationsAccess } from './bookingOperationsAccess';
const mocks = vi.hoisted(() => ({ mc: vi.fn(), department: vi.fn() }));
vi.mock('./projectScope', () => ({ hasManagedUnitMcAccess: mocks.mc, hasProjectDepartmentAccess: mocks.department }));
const user = { identityId: 'operator', isAdmin: false, roles: [] } as unknown as CurrentUser;
const booking = { projectId: 'resort', unitId: 'villa-a' };
beforeEach(() => { vi.clearAllMocks(); mocks.mc.mockResolvedValue(false); mocks.department.mockResolvedValue(false); });
describe('canonical stay-operation permissions', () => {
  it('denies an unrelated owner, guest or manager without operating authority', async () => {
    expect(Object.values(await resolveBookingOperationsAccess(user, booking))).toEqual([false, false, false, false, false, false]);
  });
  it('checks MC authority against the exact project and physical unit', async () => {
    mocks.mc.mockResolvedValue(true);
    const access = await resolveBookingOperationsAccess(user, booking);
    expect(mocks.mc).toHaveBeenCalledWith(user, booking);
    expect(Object.values(access)).toEqual([false, true, true, true, true, true]);
  });
  it.each([
    ['housekeeping', false, false, false], ['guest_care', false, false, false],
    ['reservations', true, false, false], ['front_desk', false, true, false], ['finance', false, false, true],
  ])('keeps %s within its own department', async (department, reservations, frontDesk, money) => {
    mocks.department.mockImplementation(async (_u, project, grant) => project === 'resort' && grant === department);
    expect(await resolveBookingOperationsAccess(user, booking)).toEqual({ canViewStaffQueue: true, canView: true, canManageReservations: reservations, canManageFrontDesk: frontDesk, canSeeFinance: money, canRecordMoney: money });
  });
  it('does not widen another resort or condo portfolio', async () => {
    mocks.mc.mockImplementation(async (_u, scope) => scope.unitId === 'villa-a' && scope.projectId === 'resort');
    expect((await resolveBookingOperationsAccess(user, { projectId: 'condo', unitId: 'villa-a' })).canView).toBe(false);
    expect((await resolveBookingOperationsAccess(user, { projectId: 'resort', unitId: 'villa-b' })).canView).toBe(false);
  });
  it('rechecks revoked or expired MC authority on the next request', async () => {
    mocks.mc.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await resolveBookingOperationsAccess(user, booking)).canManageFrontDesk).toBe(true);
    expect((await resolveBookingOperationsAccess(user, booking)).canManageFrontDesk).toBe(false);
  });
  it('preserves independent roles on the same identity without granting a whole project', async () => {
    mocks.department.mockImplementation(async (_u, _p, grant) => grant === 'housekeeping');
    mocks.mc.mockResolvedValue(true);
    expect((await resolveBookingOperationsAccess(user, booking)).canRecordMoney).toBe(true);
    mocks.mc.mockResolvedValue(false);
    expect((await resolveBookingOperationsAccess(user, booking)).canRecordMoney).toBe(false);
  });
});

it('rehydrates current active identity and role grants from the candidate transaction', async () => {
  const identity = { findUnique: vi.fn().mockResolvedValue({ id: 'operator', status: 'active', isAdmin: false, firstName: 'Operator', lastName: '', email: null, roleAssignments: [] }) };
  const db = { identity } as unknown as import('@prisma/client').PrismaClient;
  mocks.mc.mockResolvedValue(true);
  expect(await canApproveBookingCandidate(db, 'operator', booking)).toBe(true);
  expect(identity.findUnique).toHaveBeenCalledWith({ where: { id: 'operator' }, include: { roleAssignments: { where: { status: 'active' } } } });
  expect(mocks.mc).toHaveBeenCalledWith(expect.objectContaining({ roles: [] }), booking, db);
  identity.findUnique.mockResolvedValue({ id: 'operator', status: 'blocked', isAdmin: true, roleAssignments: [] });
  expect(await canApproveBookingCandidate(db, 'operator', booking)).toBe(false);
});
