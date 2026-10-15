import type { Prisma, PrismaClient } from '@prisma/client';
import { getScopedOperationalAccess, OperatingAccessError } from './operating-space-access.service';

type Db = PrismaClient | Prisma.TransactionClient;
export const RESERVATION_DEPARTMENTS = ['reservations', 'front_desk', 'guest_care', 'finance'] as const;
export const RESERVATION_GUEST_SELECT = { id: true, firstName: true, lastName: true, email: true, phone: true } as const;

export async function registeredReservationGuestIds(db: Db, spaceId: string, unitIds: string[]) {
  if (!unitIds.length) return [];
  const rows = await db.auditLog.findMany({
    where: { action: 'reservation_guest:registered', entityType: 'Identity',
      AND: [{ data: { path: ['operatingSpaceId'], equals: spaceId } },
        { OR: unitIds.map(id => ({ data: { path: ['unitId'], equals: id } })) }] },
    select: { entityId: true }, orderBy: { createdAt: 'desc' }, take: 200,
  });
  return [...new Set(rows.map(row => row.entityId))];
}

export async function canUseReservationGuest(db: Db, guestId: string, spaceId: string, unitIds: string[], isAdmin: boolean) {
  if (isAdmin) return true;
  if (!unitIds.length) return false;
  if (await db.booking.findFirst({ where: { guestIdentityId: guestId, unitId: { in: unitIds } }, select: { id: true } })) return true;
  return Boolean(await db.auditLog.findFirst({ where: {
    action: 'reservation_guest:registered', entityType: 'Identity', entityId: guestId,
    AND: [{ data: { path: ['operatingSpaceId'], equals: spaceId } },
      { OR: unitIds.map(id => ({ data: { path: ['unitId'], equals: id } })) }],
  }, select: { id: true } }));
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
}

export async function registerReservationGuest(db: PrismaClient, actorId: string, input: {
  operatingSpaceId?: unknown; unitId?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown;
}) {
  const spaceId = text(input.operatingSpaceId, 100);
  const unitId = text(input.unitId, 100);
  const firstName = text(input.firstName, 100);
  const lastName = text(input.lastName, 100);
  const email = text(input.email, 254).toLowerCase();
  const phone = text(input.phone, 40).replace(/[\s()-]/g, '');
  if (!spaceId || !unitId || !firstName || !lastName || (!email && !phone) || (input.email && !email) || (input.phone && !phone) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (phone && !/^\+[1-9]\d{7,14}$/.test(phone))) {
    throw new OperatingAccessError('Enter first name, last name and a valid email or international phone number', 400);
  }
  return db.$transaction(async tx => {
    const access = await getScopedOperationalAccess(tx, actorId, spaceId, 'manage_reservations', RESERVATION_DEPARTMENTS);
    if (!access.unitIds.includes(unitId)) throw new OperatingAccessError('No authorized homes in this workspace');
    // Match contacts only, never names. Different contacts belonging to different
    // people must be reviewed, not silently merged or overwritten.
    for (const key of [email && 'email:' + email, phone && 'phone:' + phone].filter(Boolean).sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'reservation-guest:' + key}))`;
    }
    const matches = await tx.identity.findMany({ where: {
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    }, select: { ...RESERVATION_GUEST_SELECT, status: true } });
    if (matches.length > 1) throw new OperatingAccessError('These contact details match different people. Review them before saving.', 409);
    let guest = matches[0];
    if (guest && (guest.status !== 'active' ||
      !await canUseReservationGuest(tx, guest.id, spaceId, access.unitIds, access.isAdmin))) {
      throw new OperatingAccessError('This contact cannot be selected here. Ask the administrator to review it.', 409);
    }
    const created = !guest;
    if (!guest) {
      // A contact record only: no password, token, invitation, role or verified contact.
      guest = await tx.identity.create({ data: {
        firstName, lastName, email: email || null, phone: phone || null, status: 'active',
      }, select: { ...RESERVATION_GUEST_SELECT, status: true } });
    }
    const registered = await tx.auditLog.findFirst({ where: {
      action: 'reservation_guest:registered', entityType: 'Identity', entityId: guest.id,
      AND: [{ data: { path: ['operatingSpaceId'], equals: spaceId } }, { data: { path: ['unitId'], equals: unitId } }],
    }, select: { id: true } });
    if (!registered) await tx.auditLog.create({ data: {
      actorIdentityId: actorId, action: 'reservation_guest:registered', entityType: 'Identity', entityId: guest.id,
      data: { operatingSpaceId: spaceId, unitId, created, invitationSent: false, accessGranted: false },
    } });
    return { guest: { id: guest.id, firstName: guest.firstName, lastName: guest.lastName, email: guest.email, phone: guest.phone }, created };
  });
}
