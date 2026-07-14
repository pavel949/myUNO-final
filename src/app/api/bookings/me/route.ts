import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

/**
 * GET /api/bookings/me
 * Get current user's bookings/trips.
 * Requires authentication.
 *
 * Query params:
 * - status?: comma-separated status filter (e.g. pending_payment,confirmed,cancelled)
 * - limit?: number (default 50)
 * - offset?: number (default 0)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    const statuses = statusFilter ? statusFilter.split(',') : undefined;

    const where: any = {
      guestIdentityId: user.identityId,
    };

    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            baseNightlyThb: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            method: true,
            amountThb: true,
            succeededAt: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { startDate: 'desc' },
    });

    const total = await prisma.booking.count({ where });

    return NextResponse.json(
      {
        bookings,
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
