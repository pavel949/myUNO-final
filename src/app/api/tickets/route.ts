import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { raiseTicket, getReporterTickets } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import type { RoleType } from '@prisma/client';

/** GET /api/tickets — tickets the caller raised, newest first. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    const tickets = await getReporterTickets(prisma, user.identityId);
    return NextResponse.json({ tickets });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/tickets — raise a ticket (F-COM-3).
 * Body: { projectId, unitId?, bookingId?, categoryKey, title, description?, priority? }
 * The caller must have a stake: a role in the project, own the unit, or be
 * the guest of the referenced booking.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const { projectId, unitId, bookingId, categoryKey, title, description, priority } = body;

    if (!projectId || !categoryKey || !title) {
      throw createPublicError(
        'invalid request: projectId, categoryKey, and title are required',
        400
      );
    }

    // Stake check: role in project / own unit / guest of the booking
    let raisedByRole = user.roles.find(
      (r) => r.projectId === projectId || r.projectId === null
    )?.role;

    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { guestIdentityId: true, projectId: true },
      });
      if (booking?.guestIdentityId === user.identityId && booking.projectId === projectId) {
        raisedByRole = raisedByRole || 'guest';
      }
    }
    if (unitId && !raisedByRole) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { ownerIdentityId: true },
      });
      if (unit?.ownerIdentityId === user.identityId) {
        raisedByRole = 'owner';
      }
    }
    if (!raisedByRole && user.isAdmin) {
      raisedByRole = 'staff_ops';
    }
    if (!raisedByRole) {
      throw createPublicError('Access denied.', 403);
    }

    const ticket = await raiseTicket(prisma, {
      projectId,
      unitId,
      raisedByIdentityId: user.identityId,
      raisedByRole: raisedByRole as RoleType,
      categoryKey: String(categoryKey),
      title: String(title).slice(0, 200),
      description: description ? String(description) : undefined,
      priority,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
