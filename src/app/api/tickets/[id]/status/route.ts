import { NextRequest, NextResponse } from 'next/server';
import { TicketStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { updateTicketStatus } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadTicketForUser } from '@/app/libs/ticketScope';

const ALLOWED_STATUSES = new Set<TicketStatus>([
  'open',
  'acknowledged',
  'in_progress',
  'waiting_reporter',
  'resolved',
  'closed',
  'cancelled',
]);

/** POST /api/tickets/[id]/status — scoped status transition (operator + reporter self-service). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { canManage, isReporter, ticket } = await loadTicketForUser(params.id, user);

    const body = await req.json().catch(() => ({}));
    const newStatus = body?.newStatus as TicketStatus | undefined;
    const note = typeof body?.note === 'string' ? body.note.slice(0, 500).trim() : undefined;

    if (!newStatus || !ALLOWED_STATUSES.has(newStatus)) {
      throw createPublicError('invalid request: unsupported status', 400);
    }
    if (newStatus === 'resolved' && !note) {
      throw createPublicError('invalid request: resolution note required', 400);
    }
    if (!canManage) {
      // Reporter self-service: can cancel their own active ticket and can reopen
      // their own resolved ticket. All operator transitions stay protected.
      const canReporterCancel =
        isReporter &&
        newStatus === 'cancelled' &&
        ['open', 'acknowledged', 'in_progress', 'waiting_reporter'].includes(ticket.status);
      const canReporterReopen =
        isReporter &&
        newStatus === 'in_progress' &&
        ticket.status === 'resolved';
      if (!canReporterCancel && !canReporterReopen) {
        throw createPublicError('Access denied.', 403);
      }
    }

    await updateTicketStatus(prisma, {
      ticketId: params.id,
      newStatus,
      actorIdentityId: user.identityId,
      note,
    });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    return handleError(error);
  }
}
