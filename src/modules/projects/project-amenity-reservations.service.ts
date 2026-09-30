import { Prisma, type PrismaClient } from '@prisma/client';

export type AmenityReservationPolicy = {
  slotMinutes?: number;
  minLeadMinutes?: number;
  maxAdvanceDays?: number;
  exclusive?: boolean;
  maxPartySize?: number;
  maxConcurrentGuests?: number;
  autoConfirm?: boolean;
};

function policy(value: Prisma.JsonValue | null): AmenityReservationPolicy {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const positiveInt = (key: string) => {
    const n = Number(raw[key]);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  return {
    slotMinutes: positiveInt('slotMinutes'),
    minLeadMinutes: positiveInt('minLeadMinutes'),
    maxAdvanceDays: positiveInt('maxAdvanceDays'),
    maxPartySize: positiveInt('maxPartySize'),
    maxConcurrentGuests: positiveInt('maxConcurrentGuests'),
    exclusive: typeof raw.exclusive === 'boolean' ? raw.exclusive : undefined,
    autoConfirm: typeof raw.autoConfirm === 'boolean' ? raw.autoConfirm : undefined,
  };
}

async function accessContext(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    projectId: string;
    identityId: string;
    startAt: Date;
    endAt: Date;
    bookingId?: string | null;
    privileged?: boolean;
  }
) {
  if (input.privileged) return { bookingId: input.bookingId ?? null, unitId: null as string | null };

  const bookingWhere: Prisma.BookingWhereInput = {
    guestIdentityId: input.identityId,
    projectId: input.projectId,
    status: { in: ['confirmed', 'checked_in'] },
    startDate: { lte: input.startAt },
    endDate: { gte: input.endAt },
    ...(input.bookingId ? { id: input.bookingId } : {}),
  };
  const booking = await db.booking.findFirst({
    where: bookingWhere,
    select: { id: true, unitId: true },
    orderBy: { startDate: 'desc' },
  });
  if (booking) return { bookingId: booking.id, unitId: booking.unitId };

  const role = await db.roleAssignment.findFirst({
    where: {
      identityId: input.identityId,
      status: 'active',
      OR: [
        { projectId: input.projectId },
        { unit: { projectId: input.projectId } },
      ],
    },
    select: { unitId: true },
  });
  if (role) return { bookingId: null, unitId: role.unitId };

  throw new Error('Amenity access requires an eligible stay or project role');
}

export async function createProjectAmenityReservation(
  db: PrismaClient,
  input: {
    amenityId: string;
    identityId: string;
    startAt: Date;
    endAt: Date;
    partySize: number;
    note?: string | null;
    bookingId?: string | null;
    privileged?: boolean;
    source?: string;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  if (!(input.startAt instanceof Date) || Number.isNaN(input.startAt.getTime()) ||
      !(input.endAt instanceof Date) || Number.isNaN(input.endAt.getTime()) ||
      input.endAt <= input.startAt) {
    throw new Error('Invalid amenity reservation time');
  }
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 1000) {
    throw new Error('Invalid amenity reservation party size');
  }
  if (input.startAt <= now) throw new Error('Amenity reservation must start in the future');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const amenity = await tx.projectAmenity.findUnique({
          where: { id: input.amenityId },
          select: {
            id: true, projectId: true, name: true, published: true,
            bookingRequired: true, bookingMode: true, reservationConfig: true,
            capacity: true,
          },
        });
        if (!amenity || !amenity.published) throw new Error('Amenity not available');
        if (!amenity.bookingRequired || !['time_slot', 'request', 'reception'].includes(amenity.bookingMode)) {
          throw new Error('This amenity does not use native reservations');
        }

        const cfg = policy(amenity.reservationConfig);
        const leadMs = (cfg.minLeadMinutes ?? 0) * 60_000;
        if (input.startAt.getTime() < now.getTime() + leadMs) {
          throw new Error('Amenity reservation does not meet the minimum lead time');
        }
        const maxAdvanceDays = cfg.maxAdvanceDays ?? 90;
        if (input.startAt.getTime() > now.getTime() + maxAdvanceDays * 86_400_000) {
          throw new Error('Amenity reservation is too far in advance');
        }
        const durationMinutes = Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60_000);
        if (cfg.slotMinutes && (durationMinutes < cfg.slotMinutes || durationMinutes % cfg.slotMinutes !== 0)) {
          throw new Error('Amenity reservation duration does not match the configured slot size');
        }
        const maxParty = cfg.maxPartySize ?? amenity.capacity ?? 1000;
        if (input.partySize > maxParty) throw new Error('Amenity reservation exceeds party-size limit');

        const context = await accessContext(tx, {
          projectId: amenity.projectId,
          identityId: input.identityId,
          startAt: input.startAt,
          endAt: input.endAt,
          bookingId: input.bookingId,
          privileged: input.privileged,
        });

        const overlaps = await tx.projectAmenityReservation.findMany({
          where: {
            amenityId: amenity.id,
            status: { in: ['pending', 'confirmed'] },
            startAt: { lt: input.endAt },
            endAt: { gt: input.startAt },
          },
          select: { partySize: true },
        });

        const exclusive = cfg.exclusive ?? true;
        if (exclusive && overlaps.length) throw new Error('Amenity time slot is no longer available');
        if (!exclusive) {
          const capacity = cfg.maxConcurrentGuests ?? amenity.capacity;
          const occupied = overlaps.reduce((sum, row) => sum + row.partySize, 0);
          if (capacity && occupied + input.partySize > capacity) {
            throw new Error('Amenity time slot has insufficient remaining capacity');
          }
        }

        const autoConfirm = amenity.bookingMode === 'time_slot' && cfg.autoConfirm !== false;
        return tx.projectAmenityReservation.create({
          data: {
            amenityId: amenity.id,
            identityId: input.identityId,
            bookingId: context.bookingId,
            unitId: context.unitId,
            startAt: input.startAt,
            endAt: input.endAt,
            partySize: input.partySize,
            status: autoConfirm ? 'confirmed' : 'pending',
            note: input.note?.trim().slice(0, 2000) || null,
            source: input.source ?? 'guest',
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Amenity reservation could not be created');
}

export async function cancelOwnProjectAmenityReservation(
  db: PrismaClient,
  input: { reservationId: string; identityId: string; privileged?: boolean; now?: Date }
) {
  const row = await db.projectAmenityReservation.findUnique({
    where: { id: input.reservationId },
    select: { id: true, identityId: true, startAt: true, status: true },
  });
  if (!row) throw new Error('Amenity reservation not found');
  if (!input.privileged && row.identityId !== input.identityId) throw new Error('Forbidden');
  if (!['pending', 'confirmed'].includes(row.status)) throw new Error('Amenity reservation is not active');
  if (row.startAt <= (input.now ?? new Date()) && !input.privileged) {
    throw new Error('Started amenity reservations cannot be cancelled online');
  }
  return db.projectAmenityReservation.update({
    where: { id: row.id },
    data: { status: 'cancelled' },
  });
}
