import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { createPublicError } from '@/app/libs/errorHandler';
import { hasManagedUnitMcAccess, hasProjectStaffAccess } from '@/app/libs/projectScope';

export async function loadTicketForUser(ticketId: string, user: CurrentUser) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      projectId: true,
      unitId: true,
      raisedByIdentityId: true,
      assigneeIdentityId: true,
    },
  });

  if (!ticket) {
    throw createPublicError('not found', 404);
  }

  const isReporter = ticket.raisedByIdentityId === user.identityId;
  const isAssignee = ticket.assigneeIdentityId === user.identityId;
  const isStaff = hasProjectStaffAccess(user, ticket.projectId);
  const isManagedMc =
    ticket.unitId !== null
      ? await hasManagedUnitMcAccess(user, {
          projectId: ticket.projectId,
          unitId: ticket.unitId,
        })
      : false;
  const isUnitOwner =
    ticket.unitId !== null
      ? Boolean(
          await prisma.unit.findFirst({
            where: { id: ticket.unitId, ownerIdentityId: user.identityId },
            select: { id: true },
          })
        )
      : false;
  const isAdmin = user.isAdmin;

  const canView = isReporter || isAssignee || isStaff || isManagedMc || isUnitOwner || isAdmin;
  const canManage = isStaff || isManagedMc || isAdmin;

  if (!canView) {
    throw createPublicError('not found', 404);
  }

  return { ticket, canManage, isAssignee, isReporter, isStaff, isManagedMc, isUnitOwner, isAdmin };
}
