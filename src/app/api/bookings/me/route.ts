import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const statuses = statusFilter ? statusFilter.split(',') : undefined;

    const where: any = { guestIdentityId: user.identityId };
    if (statuses?.length) where.status = { in: statuses };

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            inventoryCategory: {
              select: { id: true, categoryKey: true, name: true },
            },
          },
        },
        project: { select: { id: true, name: true } },
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
    const bookingsForClient = bookings.map((booking) => ({
      ...booking,
      totalThb: Math.round(booking.totalThb / 100),
    }));

    return NextResponse.json(
      { bookings: bookingsForClient, total, limit, offset },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
