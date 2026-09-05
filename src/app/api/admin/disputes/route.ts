import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getOpenDisputes } from '@/modules/comms';
import { handleError } from '@/app/libs/errorHandler';

/** GET /api/admin/disputes — the open-dispute queue, newest first. */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

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
