import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { assignTicket } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadTicketForUser } from '@/app/libs/ticketScope';

/** POST /api/tickets/[id]/assign — scoped operator assignment (defaults to self). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { ticket, canManage } = await loadTicketForUser(params.id, user);
    if (!canManage) {
      throw createPublicError('Access denied.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const assigneeIdentityId =
      typeof body?.assigneeIdentityId === 'string' && body.assigneeIdentityId.trim()
        ? body.assigneeIdentityId.trim()
        : user.identityId;

    if (assigneeIdentityId !== user.identityId) {
      const assignee = await prisma.identity.findUnique({
        where: { id: assigneeIdentityId },
        select: {
          id: true,
          isAdmin: true,
          roleAssignments: {
            where: { status: 'active' },
            select: { role: true, projectId: true },
          },
        },
      });

      const hasProjectOpsRole =
        assignee?.isAdmin ||
        assignee?.roleAssignments.some(
          (role) =>
            (role.role === 'staff_ops' || role.role === 'onsite_host') &&
            role.projectId === ticket.projectId
        );

      if (!hasProjectOpsRole) {
        throw createPublicError('invalid request: assignee is not an operator for this project', 400);
      }
    }

    await assignTicket(prisma, ticket.id, assigneeIdentityId, user.identityId);

    return NextResponse.json({ ok: true, assigneeIdentityId });
  } catch (error) {
    return handleError(error);
  }
}
