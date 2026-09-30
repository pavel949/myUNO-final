import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createProjectAmenityReservation } from '@/modules/projects';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

export async function GET(_req: NextRequest, { params }: { params: { amenityId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const reservations = await prisma.projectAmenityReservation.findMany({
    where: {
      amenityId: params.amenityId,
      identityId: user.identityId,
      status: { in: ['pending', 'confirmed'] },
      endAt: { gt: new Date() },
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true, startAt: true, endAt: true, partySize: true, status: true, note: true,
      bookingId: true, unitId: true,
    },
  });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest, { params }: { params: { amenityId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('Unauthorized', 401);
    const body = await req.json().catch(() => null);
    const startAt = new Date(String(body?.startAt || ''));
    const endAt = new Date(String(body?.endAt || ''));
    const partySize = Number(body?.partySize ?? 1);
    const reservation = await createProjectAmenityReservation(prisma, {
      amenityId: params.amenityId,
      identityId: user.identityId,
      startAt,
      endAt,
      partySize,
      note: typeof body?.note === 'string' ? body.note : null,
      bookingId: typeof body?.bookingId === 'string' ? body.bookingId : null,
      privileged: user.isAdmin,
      source: user.isAdmin ? 'admin' : 'guest',
    });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
