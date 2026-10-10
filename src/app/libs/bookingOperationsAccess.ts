import { mayHoldSession } from '@/lib/session-policy';
import type { PrismaClient } from '@prisma/client';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess, hasProjectDepartmentAccess } from './projectScope';

/** Operational booking permissions, never owner economics or passport access.
 * MC authority requires a current engagement on this exact physical unit.
 * Staff department restrictions apply at both screen and command boundaries.
 * Guest self-service remains a separate policy.
 */
export async function resolveBookingOperationsAccess(
  user: CurrentUser,
  booking: { projectId: string; unitId: string },
  db?: PrismaClient,
) {
  const [isMc, reservations, frontDesk, housekeeping, guestCare, finance] = await Promise.all([
    db ? hasManagedUnitMcAccess(user, booking, db) : hasManagedUnitMcAccess(user, booking),
    ...['reservations', 'front_desk', 'housekeeping', 'guest_care', 'finance'].map(
      department => db ? hasProjectDepartmentAccess(user, booking.projectId, department, db) : hasProjectDepartmentAccess(user, booking.projectId, department),
    ),
  ]);
  return {
    canViewStaffQueue: reservations || frontDesk || housekeeping || guestCare || finance,
    canView: isMc || reservations || frontDesk || housekeeping || guestCare || finance,
    canManageReservations: isMc || reservations,
    canManageFrontDesk: isMc || frontDesk,
    // Scoped MC cash authority concerns this stay's folio, not owner statements.
    canSeeFinance: isMc || finance,
    canRecordMoney: isMc || finance,
  };
}

/** Re-read identity, roles and current unit mandate inside a claim transaction. */
export async function canApproveBookingCandidate(
  db: PrismaClient,
  identityId: string,
  booking: { projectId: string; unitId: string },
): Promise<boolean> {
  const identity = await db.identity.findUnique({
    where: { id: identityId },
    include: { roleAssignments: { where: { status: 'active' } } },
  });
  if (!identity || !mayHoldSession(identity.status)) return false;
  const user: CurrentUser = {
    identityId: identity.id, email: identity.email, firstName: identity.firstName,
    lastName: identity.lastName, isAdmin: identity.isAdmin, roles: identity.roleAssignments,
  };
  return (await resolveBookingOperationsAccess(user, booking, db)).canManageReservations;
}
