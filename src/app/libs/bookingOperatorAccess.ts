import type { PrismaClient } from '@prisma/client';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { resolveBookingOperationsAccess } from './bookingOperationsAccess';

async function authorize(
  db: PrismaClient,
  identityId: string,
  scope: { projectId: string; unitId: string },
  action: 'stays:approve_decline_booking_requests' | 'money:record_costs_on_units',
) {
  const identity = await db.identity.findUnique({
    where: { id: identityId },
    include: { roleAssignments: { where: { status: 'active' } } },
  });
  if (!identity || identity.status !== 'active') return false;
  if (!(await can({ identity, action, requiredAccess: 'allow', resource: scope }, db))) return false;
  const user: CurrentUser = {
    identityId: identity.id, email: identity.email, firstName: identity.firstName,
    lastName: identity.lastName, isAdmin: identity.isAdmin, roles: identity.roleAssignments,
  };
  const access = await resolveBookingOperationsAccess(user, scope, db);
  return action === 'stays:approve_decline_booking_requests'
    ? access.canManageReservations : access.canRecordMoney;
}

/** Reservation acceptance and receipt recording remain separate permissions. */
export const canConfirmUnpaidBooking = (db: PrismaClient, identityId: string, scope: { projectId: string; unitId: string }) =>
  authorize(db, identityId, scope, 'stays:approve_decline_booking_requests');

export const canRecordBookingReceipt = (db: PrismaClient, identityId: string, scope: { projectId: string; unitId: string }) =>
  authorize(db, identityId, scope, 'money:record_costs_on_units');
