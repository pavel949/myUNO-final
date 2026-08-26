import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface AdminBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  unitName: string | null;
  guestName: string;
  paid: boolean;
  receiptRef: string | null;
  guestIdentityId: string | null;
  guestInvited: boolean;
  channel: string;
  guestNote: string | null;
  internalNote: string | null;
}

export interface GetAdminBookingsResponse {
  items: AdminBooking[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !(await can({
      identity,
      action: 'bookings:list',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const bookings = await prisma.booking.findMany({
      include: {
        unit: { select: { name: true } },
        guestIdentity: { select: { id: true, firstName: true, lastName: true, status: true } },
        payments: {
          where: { status: 'succeeded', purpose: 'stay' },
          select: { id: true, method: true, receiptRef: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.booking.count();

    const items: AdminBooking[] = bookings.map((b) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      // Display boundary: totalThb is satang (THB x 100).
      totalThb: Math.round(b.totalThb / 100),
      unitName: b.unit?.name || null,
      guestName: b.guestIdentity
        ? `${b.guestIdentity.firstName} ${b.guestIdentity.lastName}`
        : '—',
      paid: b.payments.length > 0,
      receiptRef: b.payments[0]?.receiptRef || null,
      guestIdentityId: b.guestIdentity?.id || null,
      guestInvited: b.guestIdentity?.status === 'invited',
      channel: b.channel,
      guestNote: b.guestNote,
      internalNote: b.internalNote,
    }));

    return NextResponse.json({
      items,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    } as GetAdminBookingsResponse);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 400 }
    );
  }
}
