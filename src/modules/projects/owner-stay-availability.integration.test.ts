import { beforeEach, describe, expect, it } from 'vitest';
import { bookOwnerStay } from '@/modules/projects';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';

async function fixture() {
  const owner = await createIdentity();
  const guest = await createIdentity();
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, instantBook: false });
  const startDate = new Date(Date.now() + 7 * 86_400_000);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + 3 * 86_400_000);
  return { owner, guest, project, unit, startDate, endDate,
    input: { ownerIdentityId: owner.id, unitId: unit.id, startDate, endDate } };
}

describe('owner stays share guest inventory capacity (CO21)', () => {
  beforeEach(resetDb);

  it.each(['maintenance', 'owner_hold', 'ota_import'] as const)('refuses a %s block without creating booking or turnover work', async reason => {
    const f = await fixture();
    await db.blockedDate.create({ data: {
      unitId: f.unit.id, startDate: f.startDate, endDate: f.endDate,
      reason, createdByIdentityId: f.owner.id,
    } });
    await expect(bookOwnerStay(db, f.input)).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(await db.booking.count()).toBe(0);
    expect(await db.serviceOrder.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });

  it.each(['cash', 'bank_transfer', 'card_provider'] as const)('returns an explicit conflict for an active %s reservation', async paymentMethod => {
    const f = await fixture();
    const hold = await createBooking({
      unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id,
      startDate: f.startDate, endDate: f.endDate, status: 'pending_payment',
      holdExpiresAt: paymentMethod === 'card_provider' ? new Date(Date.now() + 600_000) : null,
    });
    await db.booking.update({ where: { id: hold.id }, data: { paymentMethod } });
    await expect(bookOwnerStay(db, f.input)).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(await db.booking.count()).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe('pending_payment');
  });

  it('retires an elapsed checkout hold in the same transaction before claiming the dates', async () => {
    const f = await fixture();
    const old = await createBooking({
      unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id,
      startDate: f.startDate, endDate: f.endDate, status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() - 60_000),
    });
    await db.booking.update({ where: { id: old.id }, data: { paymentMethod: 'card_provider' } });
    const booking = await bookOwnerStay(db, f.input);
    expect(booking).toMatchObject({ status: 'confirmed', bookingType: 'owner_stay', totalThb: 0 });
    expect(await db.booking.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: 'expired', holdExpiresAt: null });
  });

  it.each(['requested', 'checked_out'] as const)('does not treat a %s stay as occupied inventory', async status => {
    const f = await fixture();
    await createBooking({
      unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id,
      startDate: f.startDate, endDate: f.endDate, status,
    });
    const booking = await bookOwnerStay(db, f.input);
    expect(booking.status).toBe('confirmed');
  });

  it('allows checkout-day adjacency to a confirmed booking and maintenance block', async () => {
    const f = await fixture();
    await createBooking({
      unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id,
      startDate: new Date(f.startDate.getTime() - 2 * 86_400_000), endDate: f.startDate,
    });
    await db.blockedDate.create({ data: {
      unitId: f.unit.id, startDate: f.endDate, endDate: new Date(f.endDate.getTime() + 86_400_000),
      reason: 'maintenance', createdByIdentityId: f.owner.id,
    } });
    expect((await bookOwnerStay(db, f.input)).status).toBe('confirmed');
  });

  it('retains ownership enforcement before creating a reservation', async () => {
    const f = await fixture();
    await expect(bookOwnerStay(db, { ...f.input, ownerIdentityId: f.guest.id })).rejects.toThrow('does not own');
    expect(await db.booking.count()).toBe(0);
  });

  it('waits for an in-flight calendar block and refuses the newly occupied dates', async () => {
    const f = await fixture();
    let unlock!: () => void;
    let ready!: () => void;
    const released = new Promise<void>(resolve => { unlock = resolve; });
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const blockWrite = db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${f.unit.id}))`;
      ready();
      await released;
      return tx.blockedDate.create({ data: {
        unitId: f.unit.id, startDate: f.startDate, endDate: f.endDate,
        reason: 'maintenance', createdByIdentityId: f.owner.id,
      } });
    }, { timeout: 10_000 });
    await locked;
    let settled = false;
    const ownerWrite = bookOwnerStay(db, f.input).then(
      value => { settled = true; return { status: 'fulfilled', value } as const; },
      reason => { settled = true; return { status: 'rejected', reason } as const; },
    );
    try {
      // Wait for the actual database lock waiter, or for the unsafe writer to
      // finish. This exercises the interleaving without racing a fixed sleep.
      const deadline = Date.now() + 4_000;
      while (!settled) {
        const [row] = await db.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND objid = ((hashtext(${f.unit.id})::bigint & 4294967295)::oid)
          ) AS waiting
        `;
        if (row.waiting) break;
        if (Date.now() > deadline) throw new Error('Owner attempt neither completed nor waited on the inventory lock');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      unlock();
      await blockWrite;
    }
    const result = await ownerWrite;
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(await db.booking.count({ where: { unitId: f.unit.id } })).toBe(0);
    expect(await db.blockedDate.count({ where: { unitId: f.unit.id } })).toBe(1);
  });
});
