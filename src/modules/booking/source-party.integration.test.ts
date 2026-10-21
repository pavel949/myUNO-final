import { beforeEach, describe, expect, it } from 'vitest';
import { changeBookingDates } from './booking.service';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';

const evidence = { importedFrom: 'operator_workbook',
  sourcePartyEvidence: { adults: null, children: null, provenance: 'synthetic-reviewed-source' } };
async function fixture() {
  const project = await createProject();
  const unit = await createUnit(project.id);
  const guest = await createIdentity();
  return createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    status: 'confirmed', adults: 2, children: 0 });
}
const unknown = { adults: 0, children: 0, partyDetailsStatus: 'source_unknown' as const,
  bookingType: 'external_ota' as const, externalRef: 'synthetic:reviewed:reservation', priceBreakdown: evidence };

describe('unknown source party is explicit and separate from ordinary validation', () => {
  beforeEach(resetDb);
  it('keeps default-known ordinary reservations subject to at least one adult', async () => {
    const booking = await fixture();
    expect(booking.partyDetailsStatus).toBe('known');
    await expect(db.booking.update({ where: { id: booking.id }, data: { adults: 0 } }))
      .rejects.toThrow('booking_has_an_adult');
  });
  it('accepts zero only with typed unknown external source and evidence, independently of money review', async () => {
    const booking = await fixture();
    const imported = await db.booking.update({ where: { id: booking.id }, data: {
      ...unknown, receivableStatus: 'pending_reconciliation',
    } });
    expect(imported).toMatchObject({ adults: 0, children: 0, partyDetailsStatus: 'source_unknown' });
    const reconciled = await db.booking.update({ where: { id: booking.id }, data: { receivableStatus: 'collectible' } });
    expect(reconciled.partyDetailsStatus).toBe('source_unknown');
    await expect(db.booking.update({ where: { id: booking.id }, data: { partyDetailsStatus: 'known' } }))
      .rejects.toThrow('booking_has_an_adult');
  });
  it.each([{}, { importedFrom: 'operator_workbook' }, { importedFrom: 'operator_workbook', sourcePartyEvidence: { provenance: '' } }])
    ('rejects incomplete source evidence without SQL NULL escaping the constraint: %j', async priceBreakdown => {
      const booking = await fixture();
      await expect(db.booking.update({ where: { id: booking.id }, data: { ...unknown, priceBreakdown } }))
        .rejects.toThrow('booking_unknown_party_source_evidence');
    });
  it('rejects source_unknown on an ordinary guest stay', async () => {
    const booking = await fixture();
    await expect(db.booking.update({ where: { id: booking.id }, data: { ...unknown, bookingType: 'guest_stay' } }))
      .rejects.toThrow('booking_unknown_party_source_evidence');
  });
  it('refuses check-in while unknown even when the adult count is positive', async () => {
    const booking = await fixture();
    await db.booking.update({ where: { id: booking.id }, data: { ...unknown, adults: 2 } });
    await expect(db.booking.update({ where: { id: booking.id }, data: { status: 'checked_in' } }))
      .rejects.toThrow('booking_checkin_requires_known_party');
    const resolved = await db.booking.update({ where: { id: booking.id }, data: { adults: 2, children: 0, partyDetailsStatus: 'known' } });
    expect(resolved).toMatchObject({ partyDetailsStatus: 'known', adults: 2, children: 0 });
  });
  it('confirms both source counts without repricing sold terms or clearing money review', async () => {
    const booking = await fixture();
    await db.booking.update({ where: { id: booking.id }, data: { ...unknown,
      totalThb: 987654, balanceDueThb: 987654, receivableStatus: 'pending_reconciliation' } });
    const command = { bookingId: booking.id, startDate: booking.startDate,
      endDate: booking.endDate, adults: 2, children: 0, actorIdentityId: booking.guestIdentityId };
    await Promise.all([changeBookingDates(db, command), changeBookingDates(db, command)]);
    await changeBookingDates(db, command);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      partyDetailsStatus: 'known', adults: 2, children: 0, totalThb: 987654, balanceDueThb: 987654,
      receivableStatus: 'pending_reconciliation', priceBreakdown: evidence,
    });
    expect(await db.bookingChange.findFirstOrThrow({ where: { bookingId: booking.id } }))
      .toMatchObject({ changeType: 'party', priceDeltaThb: 0 });
    expect(await db.bookingChange.count({ where: { bookingId: booking.id, changeType: 'party' } })).toBe(1);
    // Further factual correction while financial terms remain unresolved is
    // still not permission to replace the original sold price with a tariff.
    await changeBookingDates(db, { ...command, adults: 3 });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      partyDetailsStatus: 'known', adults: 3, totalThb: 987654, balanceDueThb: 987654,
      receivableStatus: 'pending_reconciliation', priceBreakdown: evidence,
    });
    await expect(changeBookingDates(db, { ...command, adults: 3,
      endDate: new Date(booking.endDate.getTime()+86400000) })).rejects.toMatchObject({ code: 'SOURCE_STAY_REVIEW_REQUIRED' });

  });
  it('refuses combined date changes or incomplete count confirmation for source unknown', async () => {
    const booking = await fixture();
    await db.booking.update({ where: { id: booking.id }, data: unknown });
    await expect(changeBookingDates(db, { bookingId: booking.id, startDate: booking.startDate,
      endDate: booking.endDate, adults: 2 })).rejects.toMatchObject({ code: 'PARTY_DETAILS_REQUIRED' });
    await expect(changeBookingDates(db, { bookingId: booking.id, startDate: booking.startDate,
      endDate: new Date(booking.endDate.getTime()+86400000), adults: 2, children: 0 }))
      .rejects.toMatchObject({ code: 'SOURCE_STAY_REVIEW_REQUIRED' });
  });
  it('rolls back typed uncertainty and counts together', async () => {
    const booking = await fixture();
    await expect(db.$transaction(async tx => {
      await tx.booking.update({ where: { id: booking.id }, data: unknown });
      throw new Error('synthetic rollback');
    })).rejects.toThrow('synthetic rollback');
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
      .toMatchObject({ partyDetailsStatus: 'known', adults: 2, children: 0 });
  });
});
