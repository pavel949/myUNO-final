import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { buildReservationsWorkbook } from '@/test/xlsx-fixture';
import {
  parseReservationsWorkbook, planWorkbookImport, applyWorkbookImport, mapChannel,
} from './workbook-import';

/**
 * Founder ruling 2026-10-06: myUNO is Layantara's booking system of record.
 * The operator's reservations workbook becomes canonical bookings through
 * the same intake as signed channel events — protection blocks converted
 * exactly, history kept, money only where the operator received it.
 */
const TODAY = new Date('2026-10-06T08:00:00Z');
const grid = (amountSatang: number) => ({
  quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true, sourceSystem: 'layantara_os',
  tariffGrid: [{ sourceRateId: 'all', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }],
    rateMode: 'daily', pricingUnit: 'night', amountSatang, currency: 'THB', minimumNights: 1,
    includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true }],
});

describe('Layantara reservations workbook import', () => {
  let a10: string; let v7: string; let admin: string; let systemId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    a10 = (await createUnit({ projectId: project.id, name: 'Villa A10', status: 'draft', categoryKey: 'SUPERIOR_2BR' })).id;
    v7 = (await createUnit({ projectId: project.id, name: 'Villa V7', status: 'draft', categoryKey: 'GARDEN_2BR' })).id;
    // Prod villas are draft with a source tariff; the split weights come from it.
    await db.commercialOffering.create({ data: { unitId: a10, offeringType: 'short_term_stay', status: 'active', pricingTerms: grid(830_000) } });
    await db.commercialOffering.create({ data: { unitId: v7, offeringType: 'short_term_stay', status: 'active', pricingTerms: grid(720_000) } });
    admin = (await db.identity.create({ data: { firstName: 'Founder', lastName: 'Admin' } })).id;
    const system = await db.externalSystem.create({ data: {
      system_key: 'layantara_os', environment: 'source-live', display_name: 'Layantara', status: 'staging',
      config: { bookingAuthority: 'myuno', cutoverVerified: true, protectionEnabled: true },
    } });
    systemId = system.id;
    for (const [code, unitId] of [['A10', a10], ['V7', v7]] as const) {
      await db.externalMapping.create({ data: {
        external_system_id: system.id, entity_type: 'unit', external_id: 'src-' + code, internal_id: unitId,
        metadata: { unit_code: code, cutover_verified: true, operational_verification: 'confirmed' },
      } });
    }
    await db.blockedDate.create({ data: {
      unitId: a10, startDate: new Date('2026-11-06'), endDate: new Date('2026-11-14'), reason: 'ota_import',
      externalRef: 'layantara:occupancy:occ-1', note: 'Layantara source occupancy',
    } });
    await db.blockedDate.create({ data: {
      unitId: v7, startDate: new Date('2027-01-01'), endDate: new Date('2027-01-04'), reason: 'ota_import',
      externalRef: 'layantara:occupancy:occ-pending', note: 'Layantara source occupancy',
    } });
  });

  const rows = [
    { ref: 'RES-0001', channel: 'Booking.com', guest: 'Guest One', checkIn: '2026-11-06', checkOut: '2026-11-14', rooms: 'A10', revenue: 69834.96, status: 'Confirmed' },
    { ref: 'RES-0002', channel: 'Khunya', guest: 'Guest Two', checkIn: '2026-08-03', checkOut: '2026-09-02', rooms: 'A10', revenue: 80000, status: 'Confirmed', payment: 'Paid', paid: 80000, adults: 2, children: 0 },
    { ref: 'RES-0003', channel: 'Booking.com', guest: 'Guest Three', checkIn: '2026-12-17', checkOut: '2026-12-22', rooms: 'V7, a10', revenue: 98204.4, status: 'Confirmed' },
    { ref: 'RES-0004', channel: 'Expedia', guest: 'Guest Four', checkIn: '2026-11-27', checkOut: '2026-11-30', rooms: 'A10', revenue: 14953.02, status: 'Cancelled' },
    { ref: 'RES-0005', channel: 'Direct Booking', guest: 'Guest Five', checkIn: '2027-01-01', checkOut: '2027-01-04', rooms: 'V7', revenue: 30000, status: 'Pending' },
    { ref: 'RES-0006', channel: 'Amedeo', guest: 'Guest Six', checkIn: '2026-12-24', checkOut: '2027-01-01', rooms: 'V7', revenue: 150000, status: 'Confirmed', payment: 'Deposit paid', paid: 50000 },
  ];
  const parse = (r = rows) => parseReservationsWorkbook(buildReservationsWorkbook(r));

  it('reads the Reservations sheet by its headers, with Excel dates and comma-listed villas', () => {
    const { rows: parsed, problems } = parse();
    expect(problems).toEqual([]);
    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toMatchObject({ ref: 'RES-0001', startDate: '2026-11-06', endDate: '2026-11-14', unitCodes: ['A10'], revenueSatang: 6_983_496 });
    expect(parsed[2].unitCodes).toEqual(['V7', 'A10']);
    expect(mapChannel('Trip.com (New)')).toEqual({ channel: 'trip_com' });
    expect(mapChannel('Walk in')).toEqual({ channel: 'direct', sourceChannelName: 'Walk in' });
    expect(mapChannel('Khunya')).toEqual({ channel: 'agent', sourceChannelName: 'Khunya' });
  });

  it('refuses to plan before the booking cutover is verified', async () => {
    await db.externalSystem.update({ where: { id: systemId }, data: { config: { bookingAuthority: 'source' } } });
    await expect(planWorkbookImport(db, parse(), TODAY)).rejects.toThrow('LAYANTARA_CUTOVER_NOT_VERIFIED');
  });

  it('turns the workbook into bookings, converting protection blocks exactly', async () => {
    const plan = await planWorkbookImport(db, parse(), TODAY);
    expect(plan.summary).toMatchObject({ create: 5, create_cancelled: 1, skip: 1 });
    expect(plan.stays.find(s => s.ref === 'RES-0005')).toMatchObject({ action: 'skip', reason: 'pending_kept_protected' });
    const { applied, groups, completed } = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY });
    expect(applied.filter(a => a.status === 'quarantined')).toEqual([]);
    expect(groups).toBe(1);
    expect(completed).toBe(1);

    // The A10 protection became the booking; the pending stay stays protected.
    expect(await db.blockedDate.findMany({ select: { externalRef: true } }))
      .toEqual([{ externalRef: 'layantara:occupancy:occ-pending' }]);
    const bookings = await db.booking.findMany({ orderBy: { startDate: 'asc' } });
    expect(bookings).toHaveLength(6);
    const byRef = (ref: string) => bookings.filter(b => (b.priceBreakdown as { externalBookingId: string }).externalBookingId.startsWith(ref));

    expect(byRef('RES-0001')[0]).toMatchObject({ channel: 'booking_com', status: 'confirmed', totalThb: 6_983_496, bookingType: 'external_ota' });
    expect(byRef('RES-0002')[0]).toMatchObject({ channel: 'agent', status: 'completed', balanceDueThb: 0 });
    expect(byRef('RES-0002')[0].priceBreakdown).toMatchObject({ sourceChannelName: 'Khunya', importedFrom: 'operator_workbook' });
    expect(byRef('RES-0004')[0]).toMatchObject({ channel: 'expedia', status: 'cancelled' });
    expect(byRef('RES-0006')[0]).toMatchObject({ totalThb: 15_000_000, balanceDueThb: 10_000_000 });

    // One reservation, two villas: split by each villa's season rate, one group, one guest.
    const pair = byRef('RES-0003');
    expect(pair).toHaveLength(2);
    expect(pair.reduce((s, b) => s + b.totalThb, 0)).toBe(9_820_440);
    expect(pair.find(b => b.unitId === a10)!.totalThb).toBeGreaterThan(pair.find(b => b.unitId === v7)!.totalThb);
    expect(new Set(pair.map(b => b.reservationGroupId)).size).toBe(1);
    expect(pair[0].reservationGroupId).not.toBeNull();
    expect(pair[0].guestIdentityId).toBe(pair[1].guestIdentityId);

    // Money: ledger only for what the operator received (agent payments).
    const ledger = await db.ledgerEntry.findMany({ where: { entryType: 'rental_revenue' } });
    expect(ledger.map(l => l.amountThb).sort()).toEqual([5_000_000, 8_000_000]);
    // Name-only guests: no email, so nobody is messaged.
    expect(await db.notification.count()).toBe(0);
  });

  it('re-uploading the same workbook changes nothing; an edited row becomes a recorded change', async () => {
    await applyWorkbookImport(db, await planWorkbookImport(db, parse(), TODAY), { actorIdentityId: admin, now: TODAY });
    const before = await db.booking.count();
    const again = await planWorkbookImport(db, parse(), TODAY);
    expect(again.summary).toMatchObject({ create: 0, create_cancelled: 0, change: 0, cancel: 0 });
    await applyWorkbookImport(db, again, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 60_000) });
    expect(await db.booking.count()).toBe(before);
    expect(await db.ledgerEntry.count()).toBe(2);

    const edited = rows.map(r => r.ref === 'RES-0001' ? { ...r, checkOut: '2026-11-15', revenue: 75000 }
      : r.ref === 'RES-0006' ? { ...r, payment: 'Paid', paid: 150000 } : r);
    const plan = await planWorkbookImport(db, parse(edited), TODAY);
    expect(plan.stays.find(s => s.ref === 'RES-0001')!.action).toBe('change');
    expect(plan.stays.find(s => s.ref === 'RES-0006')!.action).toBe('change');
    const { applied } = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 120_000) });
    expect(applied.filter(a => a.status === 'quarantined')).toEqual([]);
    const changed = await db.booking.findFirstOrThrow({ where: { totalThb: 7_500_000 } });
    expect(changed.endDate.toISOString().slice(0, 10)).toBe('2026-11-15');
    expect(await db.bookingChange.count({ where: { bookingId: changed.id } })).toBe(1);
    const six = await db.booking.findFirstOrThrow({ where: { totalThb: 15_000_000 } });
    expect(six.balanceDueThb).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(3);

    const cancelled = rows.map(r => r.ref === 'RES-0001' ? { ...r, checkOut: '2026-11-15', revenue: 75000, status: 'Cancelled' } : r);
    const cancelPlan = await planWorkbookImport(db, parse(cancelled), TODAY);
    expect(cancelPlan.stays.find(s => s.ref === 'RES-0001')!.action).toBe('cancel');
    await applyWorkbookImport(db, cancelPlan, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 180_000) });
    expect((await db.booking.findUniqueOrThrow({ where: { id: changed.id } })).status).toBe('cancelled');
  });
});
