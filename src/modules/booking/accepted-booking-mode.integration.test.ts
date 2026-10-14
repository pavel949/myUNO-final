import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { createBooking, type CreateBookingInput } from './booking.service';

async function fixture(mode: boolean) {
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({ projectId: project.id, status: 'live', instantBook: mode });
  const guest = await createIdentity();
  const input: CreateBookingInput = {
    unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    bookingType: 'guest_stay', channel: 'direct', instantBook: mode,
    acceptedInstantBook: mode, paymentMethod: 'cash', totalThb: 100_000,
    startDate: new Date('2027-07-01'), endDate: new Date('2027-07-04'), adults: 2, children: 0,
  };
  return { unit, input };
}

describe('accepted booking mode is a locked creation condition', () => {
  beforeEach(() => resetDb());

  it.each([true, false])('refuses a stale accepted mode %s without any booking or payment', async (accepted) => {
    const { input } = await fixture(!accepted);
    await expect(createBooking(db, { ...input, instantBook: accepted, acceptedInstantBook: accepted }))
      .rejects.toMatchObject({ code: 'REQUOTE_REQUIRED' });
    expect(await db.booking.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it.each([true, false])('creates only the mode the guest accepted (%s)', async (accepted) => {
    const { input } = await fixture(accepted);
    const booking = await createBooking(db, input);
    expect(booking.status).toBe(accepted ? 'pending_payment' : 'requested');
    expect(await db.payment.count()).toBe(0);
  });

  it('refuses contradictory accepted and requested creation modes', async () => {
    const { input } = await fixture(true);
    await expect(createBooking(db, { ...input, instantBook: false, acceptedInstantBook: true }))
      .rejects.toMatchObject({ code: 'REQUOTE_REQUIRED' });
    expect(await db.booking.count()).toBe(0);
  });

  it('retains optional-mode behavior for established internal callers', async () => {
    const { input } = await fixture(false);
    const booking = await createBooking(db, { ...input, instantBook: true, acceptedInstantBook: undefined });
    expect(booking.status).toBe('requested');
  });

  it('makes an ordinary unit mode UPDATE wait between the current-mode read and booking commit', async () => {
    const { unit, input } = await fixture(true);
    let read!: () => void;
    let release!: () => void;
    const modeRead = new Promise<void>(resolve => { read = resolve; });
    const continueCreation = new Promise<void>(resolve => { release = resolve; });
    // Pause only the writer's current-mode read; all reads/writes and locks
    // still run in a real PostgreSQL transaction on the dedicated test DB.
    const writerDb = new Proxy(db, {
      get(target, property) {
        if (property !== '$transaction') return Reflect.get(target, property);
        return (work: (tx: unknown) => Promise<unknown>) => db.$transaction(async tx => {
          const transaction = new Proxy(tx, {
            get(transactionTarget, transactionProperty) {
              if (transactionProperty !== 'unit') return Reflect.get(transactionTarget, transactionProperty);
              return new Proxy(tx.unit, {
                get(delegate, method) {
                  if (method !== 'findUnique') return Reflect.get(delegate, method);
                  return async (args: Parameters<typeof tx.unit.findUnique>[0]) => {
                    const result = await tx.unit.findUnique(args);
                    if (args.select?.instantBook && args.select?.assetStatus) {
                      read();
                      await continueCreation;
                    }
                    return result;
                  };
                },
              });
            },
          });
          return work(transaction);
        });
      },
    }) as PrismaClient;
    const creating = createBooking(writerDb, input);
    await modeRead;
    let updateCompleted = false;
    const updating = db.unit.update({ where: { id: unit.id }, data: { instantBook: false } })
      .then(result => { updateCompleted = true; return result; });
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(updateCompleted).toBe(false);
    } finally {
      release();
    }
    const booking = await creating;
    await updating;
    expect(booking.status).toBe('pending_payment');
    expect((await db.unit.findUniqueOrThrow({ where: { id: unit.id } })).instantBook).toBe(false);
    expect(await db.booking.count()).toBe(1);
  });
});
