import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import {
  canManageBookingGuests,
  canRecordStayTransition,
  canViewBooking,
  resolveBookingAccess,
} from './bookingAccess';

vi.mock('@/app/libs/projectScope', () => ({
  hasProjectStaffAccess: vi.fn(() => false),
  hasManagedUnitMcAccess: vi.fn(async () => false),
}));

import { hasManagedUnitMcAccess, hasProjectStaffAccess } from '@/app/libs/projectScope';

const booking = {
  guestIdentityId: 'guest-1',
  projectId: 'project-1',
  unitId: 'unit-1',
  ownerIdentityId: 'owner-1',
};

function user(identityId: string, overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    identityId,
    email: null,
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    roles: [],
    ...overrides,
  };
}

describe('bookingAccess', () => {
  it('marks the booker as guest', async () => {
    const flags = await resolveBookingAccess(user('guest-1'), booking);
    expect(flags.isGuest).toBe(true);
    expect(canViewBooking(flags)).toBe(true);
  });

  it('marks the unit owner', async () => {
    const flags = await resolveBookingAccess(user('owner-1'), booking);
    expect(flags.isOwner).toBe(true);
    expect(canViewBooking(flags)).toBe(true);
    expect(canRecordStayTransition(flags)).toBe(false);
  });

  it('allows scoped staff to view and check out', async () => {
    vi.mocked(hasProjectStaffAccess).mockReturnValueOnce(true);
    const flags = await resolveBookingAccess(user('staff-1'), booking);
    expect(flags.isStaff).toBe(true);
    expect(canViewBooking(flags)).toBe(true);
    expect(canRecordStayTransition(flags)).toBe(true);
    expect(canManageBookingGuests(flags)).toBe(true);
  });

  it('allows scoped MC to check out but not manage guest passports', async () => {
    vi.mocked(hasManagedUnitMcAccess).mockResolvedValueOnce(true);
    const flags = await resolveBookingAccess(user('mc-1'), booking);
    expect(flags.isMc).toBe(true);
    expect(canRecordStayTransition(flags)).toBe(true);
    expect(canManageBookingGuests(flags)).toBe(false);
  });

  it('denies unrelated identities', async () => {
    const flags = await resolveBookingAccess(user('stranger'), booking);
    expect(canViewBooking(flags)).toBe(false);
    expect(canRecordStayTransition(flags)).toBe(false);
  });
});
