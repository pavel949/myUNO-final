import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getOpenDisputes } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** GET /api/admin/disputes — the open-dispute queue, newest first. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      throw createPublicError('unauthorized', 401);
    }

    const disputes = await getOpenDisputes(prisma);
    return NextResponse.json({
      disputes: disputes.map((d) => ({
        id: d.id,
        subjectType: d.subjectType,
        subjectId: d.subjectId,
        createdAt: d.createdAt.toISOString(),
        ticket: {
          id: d.ticket.id,
          title: d.ticket.title,
          description: d.ticket.description,
          unitName: d.ticket.unit?.name ?? null,
          raisedBy: `${d.ticket.raisedBy.firstName} ${d.ticket.raisedBy.lastName}`.trim(),
        },
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
