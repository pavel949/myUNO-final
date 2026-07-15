import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { bookOwnerStay } from '@/modules/projects';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/owner-stays — an owner books a stay in their own unit
 * (F-OWN-6: zero-rent booking type; notice window from config; the module
 * notifies ops and applies the cleaning-charge config).
 * Body: { unitId, startDate, endDate }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { unitId, startDate, endDate } = await req.json();
    if (!unitId || !startDate || !endDate) {
      throw createPublicError(
        'invalid request: unitId, startDate, and endDate are required',
        400
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    const booking = await bookOwnerStay(prisma, {
      unitId,
      ownerIdentityId: user.identityId,
      startDate: start,
      endDate: end,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    // Domain errors carry owner-actionable messages (notice window, ownership, overlap)
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (
        msg.includes('notice') ||
        msg.includes('own') ||
        msg.includes('unavailable') ||
        msg.includes('not found') ||
        msg.includes('overlap')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
