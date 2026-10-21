import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { canAccessBookingGuestData } from './bookingAccess';

const booking = { guestIdentityId: 'guest', projectId: 'project', unitId: 'unit' };
const staff = { identityId: 'staff', isAdmin: false, roles: [{ role: 'staff_ops', projectId: 'project', unitId: null }] } as CurrentUser;
const db = (departments: string[] | null) => ({ projectStaffPermission: { findUnique: vi.fn().mockResolvedValue(departments === null ? null : { departments }) } }) as unknown as PrismaClient;

describe('sensitive booking party department access', () => {
  it.each([[], ['housekeeping'], ['finance']].map(departments => ({ departments })))('rejects staff outside reservation/front desk: $departments', async ({ departments }) => {
    expect(await canAccessBookingGuestData(staff, booking, db(departments))).toBe(false);
  });
  it.each([['reservations'], ['front_desk'], null].map(departments => ({ departments })))('keeps authorized and legacy staff access: $departments', async ({ departments }) => {
    expect(await canAccessBookingGuestData(staff, booking, db(departments))).toBe(true);
  });
  it('keeps guest self-service and administrator access', async () => {
    expect(await canAccessBookingGuestData({ ...staff, identityId: 'guest', roles: [] }, booking, db([]))).toBe(true);
    expect(await canAccessBookingGuestData({ ...staff, isAdmin: true, roles: [] }, booking, db([]))).toBe(true);
  });
  it('rejects another project, owner-only, and MC-only access', async () => {
    expect(await canAccessBookingGuestData(staff, { ...booking, projectId: 'foreign' }, db(['reservations']))).toBe(false);
    expect(await canAccessBookingGuestData({ ...staff, roles: [] }, booking, db(['reservations']))).toBe(false);
    expect(await canAccessBookingGuestData({ ...staff, roles: [{ role: 'mc_member', projectId: 'project', unitId: null }] } as CurrentUser, booking, db(['reservations']))).toBe(false);
  });
});
