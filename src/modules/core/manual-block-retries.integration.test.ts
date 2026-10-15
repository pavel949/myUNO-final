import { beforeEach, describe, expect, it } from 'vitest';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { createManualBlock, type CreateManualBlockInput } from './availability.service';

// Uses the real isolated PostgreSQL database, including the per-unit advisory
// lock. Do not replace this with a transaction mock for concurrency evidence.
describe('manual block retry persistence', () => {
  let input: CreateManualBlockInput;
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject();
    projectId = project.id;
    const unit = await createUnit({ projectId });
    const staff = await createIdentity();
    input = {
      unitId: unit.id,
      startDate: new Date('2026-12-10'),
      endDate: new Date('2026-12-15'),
      reason: 'maintenance',
      note: 'Repair pool pump',
      createdByIdentityId: staff.id,
    };
  });

  it('returns one persisted row for serial retries without changing its timestamps', async () => {
    const first = await createManualBlock(db, input);
    const retry = await createManualBlock(db, { ...input });
    expect(retry).toEqual(first);
    expect(await db.blockedDate.findMany({ where: { unitId: input.unitId } })).toEqual([first]);
  });

  it('serializes simultaneous exact retries into one persisted block', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => createManualBlock(db, { ...input })));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await db.blockedDate.count({ where: { unitId: input.unitId } })).toBe(1);
    await db.blockedDate.delete({ where: { id: results[0].id } });
    expect(await db.blockedDate.count({ where: { unitId: input.unitId } })).toBe(0);
  });

  it('matches the exact stored calendar days and normalizes absent notes', async () => {
    const first = await createManualBlock(db, {
      ...input,
      startDate: new Date('2026-12-10T16:45:00Z'),
      endDate: new Date('2026-12-15T09:30:00Z'),
      note: undefined,
    });
    const retry = await createManualBlock(db, { ...input, note: '' });
    expect(retry).toEqual(first);
    expect(first.startDate).toEqual(input.startDate);
    expect(first.endDate).toEqual(input.endDate);
    expect(first.note).toBeNull();
    expect(await db.blockedDate.count()).toBe(1);
  });

  it('preserves independently created blocks for different actors and units', async () => {
    const otherStaff = await createIdentity();
    const otherUnit = await createUnit({ projectId });
    const first = await createManualBlock(db, input);
    const actorBlock = await createManualBlock(db, { ...input, createdByIdentityId: otherStaff.id });
    const unitBlock = await createManualBlock(db, { ...input, unitId: otherUnit.id });
    expect(new Set([first.id, actorBlock.id, unitBlock.id]).size).toBe(3);
    expect((await createManualBlock(db, input)).id).toBe(first.id);
    expect(await db.blockedDate.count()).toBe(3);
  });

  it.each([
    { reason: 'owner_hold' as const },
    { note: 'Different repair' },
    { startDate: new Date('2026-12-09') },
    { endDate: new Date('2026-12-16') },
  ])('preserves a legitimate different block: %j', async (difference) => {
    const first = await createManualBlock(db, input);
    const different = await createManualBlock(db, { ...input, ...difference });
    expect(different.id).not.toBe(first.id);
    expect(await db.blockedDate.count({ where: { unitId: input.unitId } })).toBe(2);
  });

  it.each([
    { externalRef: 'reschedule:fixture-a' },
    { reason: 'ota_import' as const },
  ])('does not adopt an external/imported block: %j', async (source) => {
    const imported = await db.blockedDate.create({ data: { ...input, ...source } });
    const manual = await createManualBlock(db, input);
    expect(manual.id).not.toBe(imported.id);
    expect(manual.externalRef).toBeNull();
    expect(await db.blockedDate.findUnique({ where: { id: imported.id } })).toEqual(imported);
    expect(await db.blockedDate.count()).toBe(2);
  });

  it('does not adopt or alter a property-deal block with an otherwise identical payload', async () => {
    const offer = await db.commercialOffering.create({ data: {
      unitId: input.unitId, projectId, offeringType: 'long_term_rental', status: 'draft',
    } });
    const opportunity = await db.crmOpportunity.create({ data: {
      unitId: input.unitId, projectId, identityId: input.createdByIdentityId,
      type: 'rental', title: 'Lease block source fixture', source: 'test',
    } });
    const deal = await db.propertyDeal.create({ data: {
      unitId: input.unitId, offeringId: offer.id, opportunityId: opportunity.id,
      kind: 'long_term_rental', amountThb: 100000n,
      startsOn: input.startDate, endsOn: input.endDate,
    } });
    const linked = await db.blockedDate.create({ data: { ...input, propertyDealId: deal.id } });
    const manual = await createManualBlock(db, input);
    expect(manual.id).not.toBe(linked.id);
    expect(manual.propertyDealId).toBeNull();
    expect(await db.blockedDate.findUnique({ where: { id: linked.id } })).toEqual(linked);
    expect(await db.blockedDate.count()).toBe(2);
  });

  it.each(['confirmed', 'checked_in', 'pending_payment'] as const)(
    'still rejects an overlapping %s booking without adding a block', async (status) => {
      const guest = await createIdentity();
      const booking = await createBooking({
        projectId, unitId: input.unitId, guestIdentityId: guest.id,
        startDate: input.startDate, endDate: input.endDate,
        status, holdExpiresAt: new Date(Date.now() + 60_000),
      });
      await expect(createManualBlock(db, input)).rejects.toMatchObject({
        code: 'BOOKING_CONFLICT', bookingId: booking.id,
      });
      expect(await db.blockedDate.count()).toBe(0);
      expect(await db.booking.findUnique({ where: { id: booking.id } })).toEqual(booking);
    }
  );

  it('reuses the oldest exact historical duplicate without deleting either row', async () => {
    const first = await db.blockedDate.create({ data: {
      ...input, createdAt: new Date('2026-10-01'),
    } });
    const second = await db.blockedDate.create({ data: {
      ...input, createdAt: new Date('2026-10-02'),
    } });
    expect(await createManualBlock(db, input)).toEqual(first);
    expect(await db.blockedDate.findUnique({ where: { id: second.id } })).toEqual(second);
    expect(await db.blockedDate.count()).toBe(2);
  });
});
