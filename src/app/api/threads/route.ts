import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { findOrCreateThread, sendMessage, listThreadsFor } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** GET /api/threads — the caller's inbox. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    const threads = await listThreadsFor(prisma, user.identityId);
    return NextResponse.json({ threads });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/threads — start (or reuse) a conversation.
 * Body: { contextType: 'booking'|'general', contextId?, body }
 * - booking context: the caller must be the booking's guest; the thread
 *   connects them with ops staff and the unit owner ("message host").
 * - general context: connects the caller with admins (e.g. sell interest).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { contextType, contextId, body } = await req.json();
    if (!body || typeof body !== 'string' || !body.trim()) {
      throw createPublicError('invalid request: message body is required', 400);
    }

    const participants = [
      {
        identityId: user.identityId,
        participantRole: user.roles[0]?.role || 'guest',
      },
    ];
    let projectId: string | undefined;

    if (contextType === 'booking') {
      if (!contextId) {
        throw createPublicError('invalid request: contextId is required', 400);
      }
      const booking = await prisma.booking.findUnique({
        where: { id: contextId },
        select: {
          projectId: true,
          guestIdentityId: true,
          unit: { select: { ownerIdentityId: true } },
        },
      });
      if (!booking || booking.guestIdentityId !== user.identityId) {
        throw createPublicError('not found', 404);
      }
      projectId = booking.projectId;

      const staff = await prisma.roleAssignment.findMany({
        where: { role: 'staff_ops', status: 'active' },
        select: { identityId: true },
        distinct: ['identityId'],
      });
      for (const member of staff) {
        if (member.identityId !== user.identityId) {
          participants.push({ identityId: member.identityId, participantRole: 'staff_ops' });
        }
      }
      if (
        booking.unit?.ownerIdentityId &&
        booking.unit.ownerIdentityId !== user.identityId
      ) {
        participants.push({
          identityId: booking.unit.ownerIdentityId,
          participantRole: 'owner',
        });
      }
    } else {
      // general → route to admins
      const admins = await prisma.identity.findMany({
        where: { isAdmin: true, status: 'active' },
        select: { id: true },
      });
      for (const admin of admins) {
        if (admin.id !== user.identityId) {
          participants.push({ identityId: admin.id, participantRole: 'admin' });
        }
      }
    }

    const threadId = await findOrCreateThread(prisma, {
      contextType: contextType === 'booking' ? 'booking' : 'general',
      contextId,
      projectId,
      participants,
    });

    await sendMessage(prisma, {
      threadId,
      senderIdentityId: user.identityId,
      body: body.trim(),
    });

    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
