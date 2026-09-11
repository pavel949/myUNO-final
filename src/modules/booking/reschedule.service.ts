import { PrismaClient } from '@prisma/client';
import { computePriceBreakdown } from '@/modules/core';
import { track } from '@/modules/analytics';

const HOLD_MINUTES = 30;
const holdRef = (id: string) => `reschedule:${id}`;

export interface CreateRescheduleInput {
  bookingId: string;
  requestedByIdentityId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * AT09 phase 1: reserve the replacement interval without touching the original
 * booking. The hold is also a BlockedDate, so every existing availability
 * reader sees it without learning a second calendar model.
 */
export async function createBookingReschedule(db: PrismaClient, input: CreateRescheduleInput) {
  if (input.endDate <= input.startDate) throw new Error('The new end date must be after the new start date');
  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: { unit: true },
    });
    if (!booking || booking.guestIdentityId !== input.requestedByIdentityId) throw new Error('Booking not found');
    if (booking.status !== 'confirmed') throw new Error(`Cannot reschedule booking with status ${booking.status}`);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.unitId}))`;

    await tx.bookingReschedule.updateMany({
      where: { bookingId: booking.id, status: { in: ['pending_funding', 'ready'] }, holdExpiresAt: { lte: now } },
      data: { status: 'expired', releasedAt: now },
    });
    const expired = await tx.blockedDate.findMany({
      where: { unitId: booking.unitId, externalRef: { startsWith: 'reschedule:' }, endDate: { lte: now } },
      select: { id: true },
    });
    if (expired.length) await tx.blockedDate.deleteMany({ where: { id: { in: expired.map((row) => row.id) } } });

    const existingOpen = await tx.bookingReschedule.findFirst({
      where: { bookingId: booking.id, status: { in: ['pending_funding', 'ready'] }, holdExpiresAt: { gt: now } },
    });
    if (existingOpen) throw new Error('This booking already has an active reschedule request');

    const conflicting = await tx.booking.findFirst({
      where: {
        unitId: booking.unitId,
        id: { not: booking.id },
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
        OR: [
          { status: { in: ['confirmed', 'checked_in'] } },
          { status: 'pending_payment', holdExpiresAt: { gt: now } },
        ],
      },
      select: { id: true },
    });
    if (conflicting) {
      const error = new Error('The unit is already booked for those dates');
      (error as any).code = 'DOUBLE_BOOK';
      throw error;
    }

    const blocked = await tx.blockedDate.findFirst({
      where: { unitId: booking.unitId, startDate: { lt: input.endDate }, endDate: { gt: input.startDate } },
      select: { id: true },
    });
    if (blocked) {
      const error = new Error('The unit is unavailable for those dates');
      (error as any).code = 'DOUBLE_BOOK';
      throw error;
    }

    const breakdown = await computePriceBreakdown(
      tx as unknown as PrismaClient,
      booking.unitId,
      input.startDate,
      input.endDate,
      booking.adults + booking.children
    );
    const newTotalThb = breakdown.total_thb;
    const priceDeltaThb = newTotalThb - booking.totalThb;
    const row = await tx.bookingReschedule.create({
      data: {
        bookingId: booking.id,
        requestedByIdentityId: input.requestedByIdentityId,
        oldStartDate: booking.startDate,
        oldEndDate: booking.endDate,
        newStartDate: input.startDate,
        newEndDate: input.endDate,
        previousTotalThb: booking.totalThb,
        newTotalThb,
        priceDeltaThb,
        pricingSnapshot: breakdown as any,
        status: priceDeltaThb > 0 ? 'pending_funding' : 'ready',
        holdExpiresAt,
      },
    });

    await tx.blockedDate.create({
      data: {
        unitId: booking.unitId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: 'other',
        note: `Replacement hold for booking ${booking.id}`,
        createdByIdentityId: input.requestedByIdentityId,
        externalRef: holdRef(row.id),
      },
    });

    return { reschedule: row, projectId: booking.projectId, unitId: booking.unitId };
  });

  return result;
}

export async function attachReschedulePayment(db: PrismaClient, rescheduleId: string, paymentId: string) {
  return db.bookingReschedule.update({
    where: { id: rescheduleId },
    data: { paymentId },
  });
}

/**
 * AT09 phase 2: commit only after the replacement is held and any positive
 * delta payment has succeeded. The old dates are never released beforehand.
 */
export async function commitBookingReschedule(db: PrismaClient, rescheduleId: string) {
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const request = await tx.bookingReschedule.findUnique({
      where: { id: rescheduleId },
      include: { booking: true, payment: true },
    });
    if (!request) throw new Error('Reschedule request not found');
    if (request.status === 'committed') return { request, booking: request.booking, alreadyCommitted: true };
    if (!['pending_funding', 'ready'].includes(request.status)) throw new Error(`Cannot commit reschedule in ${request.status} status`);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.booking.unitId}))`;

    if (request.holdExpiresAt <= now) {
      await tx.bookingReschedule.update({ where: { id: request.id }, data: { status: 'expired', releasedAt: now } });
      await tx.blockedDate.deleteMany({ where: { unitId: request.booking.unitId, externalRef: holdRef(request.id) } });
      throw new Error('Reschedule hold has expired');
    }
    if (request.priceDeltaThb > 0) {
      if (!request.payment || request.payment.status !== 'succeeded' || request.payment.amountThb < request.priceDeltaThb) {
        throw new Error('Reschedule balance has not been paid');
      }
    }

    const conflict = await tx.booking.findFirst({
      where: {
        unitId: request.booking.unitId,
        id: { not: request.bookingId },
        startDate: { lt: request.newEndDate },
        endDate: { gt: request.newStartDate },
        OR: [
          { status: { in: ['confirmed', 'checked_in'] } },
          { status: 'pending_payment', holdExpiresAt: { gt: now } },
        ],
      },
      select: { id: true },
    });
    if (conflict) throw new Error('Replacement dates are no longer available');

    const foreignBlock = await tx.blockedDate.findFirst({
      where: {
        unitId: request.booking.unitId,
        startDate: { lt: request.newEndDate },
        endDate: { gt: request.newStartDate },
        NOT: { externalRef: holdRef(request.id) },
      },
      select: { id: true },
    });
    if (foreignBlock) throw new Error('Replacement dates are no longer available');

    await tx.blockedDate.deleteMany({ where: { unitId: request.booking.unitId, externalRef: holdRef(request.id) } });
    const updated = await tx.booking.update({
      where: { id: request.bookingId },
      data: {
        startDate: request.newStartDate,
        endDate: request.newEndDate,
        totalThb: request.newTotalThb,
        refundAccruedThb:
          request.priceDeltaThb < 0
            ? request.booking.refundAccruedThb + Math.abs(request.priceDeltaThb)
            : request.booking.refundAccruedThb,
      },
    });
    await tx.bookingChange.create({
      data: {
        bookingId: request.bookingId,
        changeType: 'dates',
        oldValue: {
          startDate: request.oldStartDate.toISOString(),
          endDate: request.oldEndDate.toISOString(),
          totalThb: request.previousTotalThb,
        },
        newValue: {
          startDate: request.newStartDate.toISOString(),
          endDate: request.newEndDate.toISOString(),
          totalThb: request.newTotalThb,
          priceBreakdown: request.pricingSnapshot,
        } as any,
        priceDeltaThb: request.priceDeltaThb,
        actorIdentityId: request.requestedByIdentityId,
      },
    });
    const committed = await tx.bookingReschedule.update({
      where: { id: request.id },
      data: { status: 'committed', committedAt: now },
    });
    return { request: committed, booking: updated, alreadyCommitted: false };
  });

  await track(db, 'stay_modified', {
    bookingId: result.booking.id,
    unitId: result.booking.unitId,
    projectId: result.booking.projectId,
    identityId: result.booking.guestIdentityId,
    priceDeltaThb: result.request.priceDeltaThb,
    rescheduleId,
  }).catch(() => null);
  return result;
}

export async function releaseBookingReschedule(db: PrismaClient, rescheduleId: string, actorIdentityId: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.bookingReschedule.findUnique({ where: { id: rescheduleId }, include: { booking: true } });
    if (!request || request.requestedByIdentityId !== actorIdentityId) throw new Error('Reschedule request not found');
    if (!['pending_funding', 'ready'].includes(request.status)) return request;
    await tx.blockedDate.deleteMany({ where: { unitId: request.booking.unitId, externalRef: holdRef(request.id) } });
    return tx.bookingReschedule.update({ where: { id: request.id }, data: { status: 'released', releasedAt: new Date() } });
  });
}

export async function expireBookingReschedules(db: PrismaClient, now = new Date()) {
  const rows = await db.bookingReschedule.findMany({
    where: { status: { in: ['pending_funding', 'ready'] }, holdExpiresAt: { lte: now } },
    include: { booking: { select: { unitId: true } } },
  });
  for (const row of rows) {
    await db.$transaction(async (tx) => {
      await tx.blockedDate.deleteMany({ where: { unitId: row.booking.unitId, externalRef: holdRef(row.id) } });
      await tx.bookingReschedule.updateMany({
        where: { id: row.id, status: { in: ['pending_funding', 'ready'] } },
        data: { status: 'expired', releasedAt: now },
      });
    });
  }
  return rows.length;
}

/** Payment confirmation recovery seam used by success-return and webhook. */
export async function commitRescheduleForPayment(db: PrismaClient, paymentId: string) {
  const request = await db.bookingReschedule.findFirst({
    where: { paymentId, status: { in: ['pending_funding', 'ready'] } },
    select: { id: true },
  });
  if (!request) return null;
  return commitBookingReschedule(db, request.id);
}
