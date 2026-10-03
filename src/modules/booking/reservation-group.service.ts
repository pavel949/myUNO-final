import type { PrismaClient } from '@prisma/client';

export async function createReservationGroup(
  db: PrismaClient,
  input: {
    guestIdentityId: string;
    createdByIdentityId?: string | null;
    operatingSpaceId?: string | null;
    title?: string | null;
    currency?: string;
    notes?: string | null;
    bookingIds?: string[];
  },
) {
  const guest = await db.identity.findUnique({
    where: { id: input.guestIdentityId },
    select: { id: true },
  });
  if (!guest) throw new Error('RESERVATION_GROUP_GUEST_NOT_FOUND');

  const bookingIds = Array.from(new Set(input.bookingIds ?? []));
  if (bookingIds.length) {
    const bookings = await db.booking.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, guestIdentityId: true, reservationGroupId: true, unitId: true },
    });
    if (bookings.length !== bookingIds.length) throw new Error('RESERVATION_GROUP_BOOKING_NOT_FOUND');
    if (bookings.some((booking) => booking.guestIdentityId !== input.guestIdentityId)) {
      throw new Error('RESERVATION_GROUP_GUEST_MISMATCH');
    }
    if (bookings.some((booking) => booking.reservationGroupId)) {
      throw new Error('RESERVATION_GROUP_BOOKING_ALREADY_GROUPED');
    }
    if (input.operatingSpaceId) {
      const unitIds = bookings.map((booking) => booking.unitId);
      const scopedCount = await db.operatingSpaceUnit.count({
        where: {
          operatingSpaceId: input.operatingSpaceId,
          unitId: { in: unitIds },
          active: true,
          OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
        },
      });
      if (scopedCount !== new Set(unitIds).size) {
        throw new Error('RESERVATION_GROUP_BOOKING_OUTSIDE_SPACE');
      }
    }
  }

  return db.$transaction(async (tx) => {
    const group = await tx.reservationGroup.create({
      data: {
        guestIdentityId: input.guestIdentityId,
        createdByIdentityId: input.createdByIdentityId ?? null,
        operatingSpaceId: input.operatingSpaceId ?? null,
        title: input.title?.trim() || null,
        currency: input.currency ?? 'THB',
        notes: input.notes ?? null,
      },
    });

    if (bookingIds.length) {
      const linked = await tx.booking.updateMany({
        where: { id: { in: bookingIds }, reservationGroupId: null },
        data: { reservationGroupId: group.id },
      });
      if (linked.count !== bookingIds.length) {
        throw new Error('RESERVATION_GROUP_CONCURRENT_LINK_CONFLICT');
      }
    }

    return tx.reservationGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        bookings: {
          include: {
            unit: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
          },
          orderBy: [{ startDate: 'asc' }, { unit: { name: 'asc' } }],
        },
      },
    });
  });
}

export async function attachBookingToReservationGroup(
  db: PrismaClient,
  input: { groupId: string; bookingId: string },
) {
  return db.$transaction(async (tx) => {
    const [group, booking] = await Promise.all([
      tx.reservationGroup.findUnique({
        where: { id: input.groupId },
        select: { id: true, guestIdentityId: true, operatingSpaceId: true, status: true },
      }),
      tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, guestIdentityId: true, unitId: true, reservationGroupId: true },
      }),
    ]);
    if (!group || group.status !== 'active') throw new Error('RESERVATION_GROUP_NOT_ACTIVE');
    if (!booking) throw new Error('RESERVATION_GROUP_BOOKING_NOT_FOUND');
    if (booking.reservationGroupId && booking.reservationGroupId !== group.id) {
      throw new Error('RESERVATION_GROUP_BOOKING_ALREADY_GROUPED');
    }
    if (booking.guestIdentityId !== group.guestIdentityId) {
      throw new Error('RESERVATION_GROUP_GUEST_MISMATCH');
    }
    if (group.operatingSpaceId) {
      const scoped = await tx.operatingSpaceUnit.findFirst({
        where: {
          operatingSpaceId: group.operatingSpaceId,
          unitId: booking.unitId,
          active: true,
          OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (!scoped) throw new Error('RESERVATION_GROUP_BOOKING_OUTSIDE_SPACE');
    }
    return tx.booking.update({
      where: { id: booking.id },
      data: { reservationGroupId: group.id },
    });
  });
}

export async function removeBookingFromReservationGroup(
  db: PrismaClient,
  input: { groupId: string; bookingId: string },
) {
  const booking = await db.booking.findFirst({
    where: { id: input.bookingId, reservationGroupId: input.groupId },
    select: { id: true },
  });
  if (!booking) throw new Error('RESERVATION_GROUP_BOOKING_NOT_FOUND');
  return db.booking.update({
    where: { id: booking.id },
    data: { reservationGroupId: null },
  });
}
