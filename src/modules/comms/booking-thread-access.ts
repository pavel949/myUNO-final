import type { Prisma, PrismaClient } from '@prisma/client';
import { can } from '@/modules/core/permissions';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { currentEngagementWhere } from '@/modules/projects/engagement-scope';

const GUEST_CARE_DEPARTMENTS = ['reservations', 'front_desk', 'guest_care'];

/** Resolve the stay's current audience from canonical roles and operating authority.
 * A persisted participant is not a permanent grant after staff/mandate revocation.
 * Managed-unit owners have their own unit/statement conversations; only an
 * owner-direct host joins the guest's booking conversation (docs 03 and 09).
 */
export async function getBookingThreadParticipants(db: PrismaClient, bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      projectId: true, unitId: true, guestIdentityId: true,
      unit: { select: { ownerIdentityId: true } },
    },
  });
  if (!booking) throw new Error('Booking not found');

  const scope: Prisma.RoleAssignmentWhereInput = {
    status: 'active',
    role: { in: ['staff_ops', 'onsite_host', 'mc_member'] },
    OR: [
      { scopeType: 'project', projectId: booking.projectId, unitId: null },
      { scopeType: 'unit', projectId: booking.projectId, unitId: booking.unitId },
    ],
  };
  const [candidates, ownerDirect] = await Promise.all([
    db.identity.findMany({
      where: {
        status: 'active',
        OR: [
          { id: booking.guestIdentityId },
          ...(booking.unit?.ownerIdentityId ? [{ id: booking.unit.ownerIdentityId }] : []),
          { isAdmin: true },
          { roleAssignments: { some: scope } },
        ],
      },
      include: { roleAssignments: { where: scope } },
    }),
    db.unitEngagement.findFirst({
      where: {
        unitId: booking.unitId,
        ownerIdentityId: booking.unit?.ownerIdentityId ?? '',
        engagementType: 'owner_direct',
        ...currentEngagementWhere(),
      },
      select: { id: true },
    }),
  ]);

  const participantRoles: Record<string, string> = {};
  for (const identity of candidates) {
    if (identity.id === booking.guestIdentityId) {
      participantRoles[identity.id] = 'guest';
      continue;
    }
    if (identity.isAdmin) {
      participantRoles[identity.id] = 'admin';
      continue;
    }
    if (ownerDirect && identity.id === booking.unit?.ownerIdentityId) {
      participantRoles[identity.id] = 'owner';
      continue;
    }
    if (!identity.roleAssignments.length || !(await can({
      identity, action: 'comms:message_in_own_threads', requiredAccess: 'allow',
      resource: { projectId: booking.projectId, unitId: booking.unitId },
    }))) continue;

    const staff = identity.roleAssignments.find(role =>
      role.role === 'staff_ops' || role.role === 'onsite_host'
    );
    if (staff) {
      const departmentGrant = await db.projectStaffPermission.findUnique({
        where: { projectId_identityId: { projectId: booking.projectId, identityId: identity.id } },
        select: { departments: true },
      });
      // Match the canonical legacy-department fallback in projectScope: no
      // configured policy preserves scoped roles; an explicit policy limits them.
      if (!departmentGrant || departmentGrant.departments.some(dept => GUEST_CARE_DEPARTMENTS.includes(dept))) {
        participantRoles[identity.id] = staff.role;
        continue;
      }
    }
    if (await hasManagedUnitMcAccess({
      identityId: identity.id, email: identity.email,
      firstName: identity.firstName, lastName: identity.lastName,
      isAdmin: false, roles: identity.roleAssignments,
    }, booking, db)) {
      participantRoles[identity.id] = 'mc_member';
    }
  }
  return {
    projectId: booking.projectId,
    participantIdentityIds: Object.keys(participantRoles),
    participantRoles,
  };
}
