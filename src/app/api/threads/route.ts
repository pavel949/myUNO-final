import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { findOrCreateThread, sendMessage, getThreadsForIdentity, getUnreadCounts } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** GET /api/threads — the caller's inbox. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const threads = await getThreadsForIdentity(prisma, user.identityId);
    const unread = await getUnreadCounts(prisma, user.identityId);

    // Resolve participant names in one query
    const otherIds = Array.from(
      new Set(
        threads.flatMap((t) =>
          t.participants.map((p) => p.identityId).filter((id) => id !== user.identityId)
        )
      )
    );
    const identities = await prisma.identity.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(identities.map((i) => [i.id, `${i.firstName} ${i.lastName}`]));

    return NextResponse.json({
      threads: threads.map((t) => ({
        id: t.id,
        contextType: t.contextType,
        contextId: t.contextId,
        lastMessageAt: t.lastMessageAt,
        lastMessage: t.messages[0]?.body || null,
        unreadCount: unread[t.id] || 0,
        others: t.participants
          .filter((p) => p.identityId !== user.identityId)
          .map((p) => ({
            id: p.identityId,
            name: nameById.get(p.identityId) || 'myUNO',
            role: p.participantRole,
          })),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/threads — start (or reuse) a conversation and send the first
 * message. booking context → guest + ops staff + unit owner ("message
 * host"); general context → caller + admins (e.g. sell interest).
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

    const participantIds = new Set<string>([user.identityId]);
    const participantRoles: Record<string, string> = {
      [user.identityId]: user.roles[0]?.role || 'guest',
    };
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
        participantIds.add(member.identityId);
        participantRoles[member.identityId] = 'staff_ops';
      }
      if (booking.unit?.ownerIdentityId) {
        participantIds.add(booking.unit.ownerIdentityId);
        participantRoles[booking.unit.ownerIdentityId] = 'owner';
      }
    } else {
      const admins = await prisma.identity.findMany({
        where: { isAdmin: true, status: 'active' },
        select: { id: true },
      });
      for (const admin of admins) {
        participantIds.add(admin.id);
        participantRoles[admin.id] = 'admin';
      }
    }

    const { id: threadId } = await findOrCreateThread(prisma, {
      contextType: contextType === 'booking' ? 'booking' : 'general',
      contextId,
      projectId,
      participantIdentityIds: Array.from(participantIds),
      participantRoles,
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
