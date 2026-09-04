import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess, hasProjectStaffAccess } from '@/app/libs/projectScope';

/** Minimal booking fields needed for role-scoped access checks (doc 03). */
export interface BookingScope {
  guestIdentityId: string;
  projectId: string;
  unitId: string;
  ownerIdentityId?: string | null;
}

export interface BookingAccessFlags {
  isGuest: boolean;
  isOwner: boolean;
  /** Staff ops / onsite host for this project, or platform admin. */
  isStaff: boolean;
  /** MC member with an active via-MC engagement on this unit. */
  isMc: boolean;
}

/**
 * Resolve how the signed-in identity relates to a booking.
 * Admin bypass is folded into `isStaff` via `hasProjectStaffAccess`.
 */
export async function resolveBookingAccess(
  user: CurrentUser,
  booking: BookingScope
): Promise<BookingAccessFlags> {
  const isGuest = booking.guestIdentityId === user.identityId;
  const isOwner = Boolean(
    booking.ownerIdentityId && booking.ownerIdentityId === user.identityId
  );
  const isStaff = hasProjectStaffAccess(user, booking.projectId);
  const isMc =
    !isStaff &&
    (await hasManagedUnitMcAccess(user, {
      projectId: booking.projectId,
      unitId: booking.unitId,
    }));

  return { isGuest, isOwner, isStaff, isMc };
}

/** Guest, owner, scoped staff, or scoped MC may read booking detail. */
export function canViewBooking(flags: BookingAccessFlags): boolean {
  return flags.isGuest || flags.isOwner || flags.isStaff || flags.isMc;
}

/** Guest, scoped staff, or scoped MC may record check-in / check-out (F-OPS-1). */
export function canRecordStayTransition(flags: BookingAccessFlags): boolean {
  return flags.isGuest || flags.isStaff || flags.isMc;
}

/** Guest or scoped staff may read/write the party passport form (F-GUEST-5). */
export function canManageBookingGuests(flags: BookingAccessFlags): boolean {
  return flags.isGuest || flags.isStaff;
}

/** Scoped staff or MC may run ops-side payment actions (F-OPS-6). */
export function canOperateBookingAsStaff(flags: BookingAccessFlags): boolean {
  return flags.isStaff || flags.isMc;
}

/** Payer, scoped staff, or scoped MC may read bank transfer instructions. */
export function canViewTransferInstructions(flags: BookingAccessFlags): boolean {
  return flags.isGuest || flags.isStaff || flags.isMc;
}

/** Payer or platform admin may confirm a checkout session. */
export function canAccessPaymentSession(user: CurrentUser, payerIdentityId: string): boolean {
  return user.identityId === payerIdentityId || user.isAdmin;
}
