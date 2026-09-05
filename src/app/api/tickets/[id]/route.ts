import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadTicketForUser } from '@/app/libs/ticketScope';

/** GET /api/tickets/[id] — scoped ticket detail for reporter/assignee/staff/MC/admin. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    await loadTicketForUser(params.id, user);
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        events: {
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw createPublicError('not found', 404);
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    return handleError(error);
  }
}
