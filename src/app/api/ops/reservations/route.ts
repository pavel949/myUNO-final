import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import {
  attachBookingToReservationGroup,
  createBooking,
  resolveCancellationPolicy,
} from '@/modules/booking';

async function authorizedUnitIds(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  operatingSpaceId: string,
) {
  const spaceUnitIds = await getOperatingSpaceUnitIds(prisma, operatingSpaceId);
  if (user.isAdmin) return spaceUnitIds;
  if (!(await hasOperatingSpaceCapability(
    prisma,
    operatingSpaceId,
    user.identityId,
    'manage_reservations',
  ))) return [];
  return getAuthorizedOperationalUnitIds(
    user,
    spaceUnitIds,
    ['reservations','front_desk','guest_care','finance'],
    operatingSpaceId,
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as {
      operatingSpaceId?: string;
      unitId?: string;
      guestIdentityId?: string;
      startDate?: string;
      endDate?: string;
      adults?: number;
      children?: number;
      infants?: number;
      pets?: number;
      guestNote?: string;
      reservationGroupId?: string;
    };

    if (
      !body.operatingSpaceId ||
      !body.unitId ||
      !body.guestIdentityId ||
      !body.startDate ||
      !body.endDate
    ) {
      return NextResponse.json({ error: 'Missing reservation fields' }, { status: 400 });
    }

    const allowedUnitIds = await authorizedUnitIds(user, body.operatingSpaceId);
    if (!allowedUnitIds.includes(body.unitId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [unit, guest] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: body.unitId },
        select: {
          id: true,
          projectId: true,
          status: true,
          instantBook: true,
          cancellationPolicyKey: true,
          inventoryCategory: { select: { status: true } },
        },
      }),
      prisma.identity.findUnique({
        where: { id: body.guestIdentityId },
        select: { id: true, status: true },
      }),
    ]);

    if (!unit || unit.status !== 'live' || unit.inventoryCategory?.status !== 'live') {
      return NextResponse.json({ error: 'Unit is not bookable' }, { status: 409 });
    }
    if (!guest || guest.status !== 'active') {
      return NextResponse.json({ error: 'Guest is not active' }, { status: 400 });
    }

    if (body.reservationGroupId) {
      const group = await prisma.reservationGroup.findFirst({
        where: {
          id: body.reservationGroupId,
          guestIdentityId: body.guestIdentityId,
          operatingSpaceId: body.operatingSpaceId,
          status: 'active',
        },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: 'Reservation group does not match guest or space' }, { status: 409 });
      }
    }

    const startDate = new Date(body.startDate + 'T00:00:00.000Z');
    const endDate = new Date(body.endDate + 'T00:00:00.000Z');
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
    }

    const policy = await resolveCancellationPolicy(
      prisma,
      unit.cancellationPolicyKey,
      { projectId: unit.projectId, unitId: unit.id },
    );

    const booking = await createBooking(prisma, {
      unitId: unit.id,
      projectId: unit.projectId,
      guestIdentityId: guest.id,
      bookingType: 'guest_stay',
      channel: 'manual',
      startDate,
      endDate,
      adults: Math.max(1, Number(body.adults ?? 1)),
      children: Math.max(0, Number(body.children ?? 0)),
      infants: Math.max(0, Number(body.infants ?? 0)),
      pets: Math.max(0, Number(body.pets ?? 0)),
      totalThb: 0,
      instantBook: unit.instantBook,
      guestNote: body.guestNote,
      cancellationPolicySnapshot: { ...policy },
    });

    if (body.reservationGroupId) {
      await attachBookingToReservationGroup(prisma, {
        groupId: body.reservationGroupId,
        bookingId: booking.id,
      });
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : 'Reservation creation failed';
    return NextResponse.json(
      { error: message, ...(code ? { code } : {}) },
      { status: code === 'DOUBLE_BOOK' ? 409 : 400 },
    );
  }
}
