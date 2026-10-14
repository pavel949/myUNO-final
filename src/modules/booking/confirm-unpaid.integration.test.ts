import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { canConfirmUnpaidBooking } from '@/app/libs/bookingOperatorAccess';
import { checkAvailability, createManualBlock } from '@/modules/core';
import { recordCashPayment } from '@/modules/finance';
import { cancelBooking, changeBookingDates, confirmBooking, createBooking, expireHolds, type ConfirmBookingInput } from './booking.service';
import { getCancellationQuote } from './cancellation-quote';
import { outstandingStayBalanceSatang } from './outstanding-balance';
import { projectCalendarCell } from './calendar-projection';

async function fixture() {
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({ projectId: project.id, status: 'live', instantBook: true });
  const guest = await createIdentity();
  const actor = await createIdentity({ isAdmin: true });
  const creation = { unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    bookingType: 'guest_stay' as const, channel: 'manual' as const, instantBook: true,
    startDate: new Date('2027-08-01'), endDate: new Date('2027-08-04'), adults: 2, children: 0, totalThb: 1 };
  const booking = await createBooking(db, creation);
  const command: ConfirmBookingInput = { bookingId: booking.id, mode: 'operator_unpaid',
    actorIdentityId: actor.id, reason: 'Existing reservation confirmed by the operator',
    expectedUpdatedAt: booking.updatedAt, commandId: randomUUID(),
    authorizeCandidate: (tx, scope) => canConfirmUnpaidBooking(tx, actor.id, scope) };
  return { project, unit, guest, actor, booking, creation, command };
}

async function noMoney(bookingId: string) {
  expect(await db.payment.count({ where: { bookingId } })).toBe(0);
  expect(await db.ledgerEntry.count({ where: { bookingId } })).toBe(0);
  expect(await db.depositPreauth.count({ where: { bookingId } })).toBe(0);
  expect(await db.refund.count()).toBe(0);
}

describe('explicit operator confirmation keeps a real unpaid reservation', () => {
  beforeEach(resetDb);

  it('reserves beyond the old hold, records full satang balance and creates no money or preauth', async () => {
    const { unit, guest, booking, creation, command } = await fixture();
    await db.configOverride.createMany({ data: [
      { parameterKey: 'booking.deposit.mode', scopeType: 'unit', scopeId: unit.id, value: 'preauth', updatedByIdentityId: guest.id },
      { parameterKey: 'booking.deposit.amount_thb', scopeType: 'unit', scopeId: unit.id, value: 5000, updatedByIdentityId: guest.id },
    ] });
    const result = await confirmBooking(db, command);
    expect(result).toMatchObject({ status: 'confirmed', holdExpiresAt: null, requestExpiresAt: null,
      balanceDueThb: booking.totalThb, totalThb: booking.totalThb });
    expect(await expireHolds(db, new Date(Date.now() + 48 * 3600_000))).toBe(0);
    expect(await checkAvailability(db, unit.id, booking.startDate, booking.endDate)).toBe(false);
    expect(projectCalendarCell([{ id: booking.id, unitId: unit.id, kind: 'booking', status: result.status,
      startDate: '2027-08-01', endDate: '2027-08-04', holdExpiresAt: null }], unit.id, '2027-08-02').blocking).toBe(true);
    await expect(createBooking(db, creation)).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    await expect(createManualBlock(db, { unitId: unit.id, startDate: booking.startDate,
      endDate: booking.endDate, reason: 'maintenance', createdByIdentityId: guest.id })).rejects.toMatchObject({ code: 'BOOKING_CONFLICT' });
    await noMoney(booking.id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'bookings:confirm_unpaid', entityId: booking.id } });
    expect(audit.actorIdentityId).toBe(command.mode === 'operator_unpaid' ? command.actorIdentityId : '');
    expect(audit.data).toMatchObject({ commandId: command.mode === 'operator_unpaid' ? command.commandId : '',
      after: { status: 'confirmed', balanceDueSatang: booking.totalThb } });
  });

  it('replays the same concurrent command once and rejects changed command details', async () => {
    const { booking, command } = await fixture();
    const results = await Promise.all([confirmBooking(db, command), confirmBooking(db, command)]);
    expect(results.map(b => b.status)).toEqual(['confirmed', 'confirmed']);
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid', entityId: booking.id } })).toBe(1);
    await expect(confirmBooking(db, { ...command, reason: 'Different reason' } as ConfirmBookingInput)).rejects.toMatchObject({ code: 'BOOKING_STATE_CHANGED' });
    await noMoney(booking.id);
  });

  it('rejects a stale revision without changing state', async () => {
    const { booking, command } = await fixture();
    await db.booking.update({ where: { id: booking.id }, data: { internalNote: 'Changed', updatedAt: new Date(booking.updatedAt.getTime() + 1000) } });
    await expect(confirmBooking(db, command)).rejects.toMatchObject({ code: 'BOOKING_STATE_CHANGED' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid' } })).toBe(0);
  });

  it.each(['requested', 'cancelled', 'expired'] as const)('does not resurrect %s', async status => {
    const { booking, command } = await fixture();
    const current = await db.booking.update({ where: { id: booking.id }, data: { status } });
    await expect(confirmBooking(db, { ...command, expectedUpdatedAt: current.updatedAt } as ConfirmBookingInput))
      .rejects.toMatchObject({ code: 'BOOKING_NOT_PENDING' });
    await noMoney(booking.id);
  });

  it('rejects an expired hold and a source-authority change', async () => {
    const { unit, booking, command } = await fixture();
    const current = await db.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await expect(confirmBooking(db, { ...command, expectedUpdatedAt: current.updatedAt } as ConfirmBookingInput)).rejects.toMatchObject({ code: 'BOOKING_HOLD_EXPIRED' });
    const source = await db.externalSystem.create({ data: { system_key: 'layantara_os', environment: 'test', display_name: 'Synthetic source' } });
    await db.externalMapping.create({ data: { external_system_id: source.id, entity_type: 'unit', internal_id: unit.id, external_id: 'synthetic-unit' } });
    await expect(confirmBooking(db, { ...command, expectedUpdatedAt: current.updatedAt } as ConfirmBookingInput)).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    await noMoney(booking.id);
  });

  it.each(['created', 'pending', 'succeeded'] as const)('refuses existing %s payment activity', async status => {
    const { booking, guest, command } = await fixture();
    await db.payment.create({ data: { bookingId: booking.id, payerIdentityId: guest.id, purpose: 'stay',
      method: 'card_provider', provider: 'mock', amountThb: booking.totalThb, status } });
    await expect(confirmBooking(db, command)).rejects.toMatchObject({ code: 'BOOKING_NOT_UNPAID' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('rolls back confirmation when its audit write fails', async () => {
    const { booking, command } = await fixture();
    const failing = new Proxy(db, { get(target, property) {
      if (property !== '$transaction') return Reflect.get(target, property);
      return (work: (tx: unknown) => Promise<unknown>) => db.$transaction(tx => work(new Proxy(tx, {
        get(transaction, key) {
          if (key !== 'auditLog') return Reflect.get(transaction, key);
          return new Proxy(tx.auditLog, { get(delegate, method) {
            if (method === 'create') return async () => { throw new Error('Synthetic audit failure'); };
            return Reflect.get(delegate, method);
          } });
        },
      })));
    } }) as PrismaClient;
    await expect(confirmBooking(failing, command)).rejects.toThrow('Synthetic audit failure');
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'pending_payment', balanceDueThb: 0 });
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid' } })).toBe(0);
    await noMoney(booking.id);
  });

  it('takes a later genuine cash balance receipt once through the finance writer', async () => {
    const { booking, guest, actor, command } = await fixture();
    await confirmBooking(db, command);
    await noMoney(booking.id);
    const receipt = { purpose: 'stay_balance' as const, bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: booking.totalThb, receivedByIdentityId: actor.id, receiptRef: 'SYNTHETIC-ACTUAL-CASH' };
    await recordCashPayment(db, receipt);
    await expect(recordCashPayment(db, receipt)).rejects.toThrow('Balance payment amount does not match');
    expect(await db.payment.count({ where: { bookingId: booking.id, status: 'succeeded' } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id, entryType: 'rental_revenue' } })).toBe(1);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed', balanceDueThb: 0 });
    expect(await db.depositPreauth.count()).toBe(0);
  });

  it('cancels an unpaid confirmed reservation without refund, fee or collectible debt', async () => {
    const { unit, booking, guest, command } = await fixture();
    const confirmed = await confirmBooking(db, command);
    const quote = await getCancellationQuote(db, confirmed);
    expect(quote.refundAmountSatang).toBe(0);
    const cancelled = await cancelBooking(db, { bookingId: booking.id, cancelledByIdentityId: guest.id,
      reason: 'Synthetic cancellation', refundAmountThb: 0, cancellationQuote: quote });
    expect(cancelled).toMatchObject({ status: 'cancelled', refundAccruedThb: 0 });
    expect(outstandingStayBalanceSatang(cancelled)).toBe(0);
    expect(await checkAvailability(db, unit.id, booking.startDate, booking.endDate)).toBe(true);
    await noMoney(booking.id);
  });

  it('serializes confirmation against a genuine initial payment', async () => {
    const { booking, guest, actor, command } = await fixture();
    const outcomes = await Promise.allSettled([confirmBooking(db, command), recordCashPayment(db, {
      purpose: 'stay', bookingId: booking.id, payerIdentityId: guest.id, amountThb: booking.totalThb,
      receivedByIdentityId: actor.id, receiptRef: 'SYNTHETIC-RACE-CASH',
    })]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const paid = await db.payment.count({ where: { bookingId: booking.id } });
    expect(await db.auditLog.count({ where: { action: 'bookings:confirm_unpaid', entityId: booking.id } })).toBe(1 - paid);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(paid);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'confirmed', balanceDueThb: paid ? 0 : booking.totalThb,
    });
  });

  it('keeps one remaining amount through unpaid reprice, real receipt and later extension', async () => {
    const { booking, guest, actor, command } = await fixture();
    await confirmBooking(db, command);
    const changed = await changeBookingDates(db, { bookingId: booking.id, startDate: booking.startDate,
      endDate: new Date('2027-08-05'), actorIdentityId: actor.id });
    expect(changed.balanceDueThb).toBe(changed.totalThb);
    expect(changed.refundAccruedThb).toBe(0);
    await recordCashPayment(db, { purpose: 'stay_balance', bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: changed.balanceDueThb, receivedByIdentityId: actor.id, receiptRef: 'SYNTHETIC-FULL-BALANCE' });
    expect(outstandingStayBalanceSatang(await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))).toBe(0);
    const extended = await changeBookingDates(db, { bookingId: booking.id, startDate: booking.startDate,
      endDate: new Date('2027-08-06'), actorIdentityId: actor.id });
    expect(extended.balanceDueThb).toBe(extended.totalThb - changed.totalThb);
    expect(outstandingStayBalanceSatang(await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))).toBe(extended.balanceDueThb);
    await recordCashPayment(db, { purpose: 'stay_balance', bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: extended.balanceDueThb, receivedByIdentityId: actor.id, receiptRef: 'SYNTHETIC-EXTENSION-BALANCE' });
    const received = await db.payment.aggregate({ where: { bookingId: booking.id, status: 'succeeded' }, _sum: { amountThb: true } });
    expect(received._sum.amountThb).toBe(extended.totalThb);
    expect(outstandingStayBalanceSatang(await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))).toBe(0);
  });
});
