import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import type { ReviewedWorkbookManifest } from './reviewed-workbook';
import { buildReservationsWorkbook } from '@/test/xlsx-fixture';
import {
  parseReservationsWorkbook, planWorkbookImport, applyWorkbookImport, mapChannel,
} from './workbook-import';

/**
 * Founder ruling 2026-10-06: myUNO is Layantara's booking system of record.
 * The operator's reservations workbook becomes canonical bookings through
 * the same intake as signed channel events. Unverified payment evidence and
 * existing calendar protections block the entire workbook before any writes.
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
  const parse = (r: Array<Record<string, string | number | null>> = rows) => parseReservationsWorkbook(buildReservationsWorkbook(r));

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

  const safeRows = rows.filter(row => !['RES-0001', 'RES-0005'].includes(row.ref))
    .map(row => ({ ...row, payment: 'Unpaid', paid: 0 }));
  const snapshot = async () => ({
    identities: await db.identity.findMany({ orderBy: { id: 'asc' } }),
    systems: await db.externalSystem.findMany({ orderBy: { id: 'asc' } }),
    bookings: await db.booking.findMany({ orderBy: { id: 'asc' } }),
    blocks: await db.blockedDate.findMany({ orderBy: { id: 'asc' } }),
    payments: await db.payment.findMany({ orderBy: { id: 'asc' } }),
    ledger: await db.ledgerEntry.findMany({ orderBy: { id: 'asc' } }),
    inbox: await db.externalEventInbox.findMany({ orderBy: { id: 'asc' } }),
    mappings: await db.externalMapping.findMany({ orderBy: { id: 'asc' } }),
    checkpoints: await db.externalAggregateCheckpoint.findMany(),
    audit: await db.auditLog.findMany({ orderBy: { id: 'asc' } }),
  });

  it('imports explicitly unpaid, unblocked bookings and replays without receipts', async () => {
    const plan = await planWorkbookImport(db, parse(safeRows), TODAY);
    expect(plan.applyBlockers).toEqual([]);
    const { applied, groups, completed } = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY });
    expect(applied.filter(result => result.status === 'quarantined')).toEqual([]);
    expect(groups).toBe(1);
    expect(completed).toBe(0);
    expect(await db.booking.count()).toBe(5);
    expect(await db.blockedDate.count()).toBe(2);
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
    const replay = await planWorkbookImport(db, parse(safeRows), TODAY);
    expect(replay.applyBlockers).toEqual([]);
    expect(replay.summary).toMatchObject({ create: 0, change: 0, cancel: 0, create_cancelled: 0 });
    await applyWorkbookImport(db, replay, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 60_000) });
    expect(await db.booking.count()).toBe(5);
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);

    const edited = safeRows.map(row => row.ref === 'RES-0006' ? { ...row, revenue: 160000 } : row);
    const change = await planWorkbookImport(db, parse(edited), TODAY);
    expect(change.stays.find(stay => stay.ref === 'RES-0006')?.action).toBe('change');
    await applyWorkbookImport(db, change, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 120_000) });
    expect(await db.bookingChange.count()).toBe(1);
  });

  it('keeps preview read-only and rejects the whole mixed workbook before creating an actor', async () => {
    const before = await snapshot();
    const plan = await planWorkbookImport(db, parse(), TODAY);
    expect(plan.applyBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ ref: 'RES-0002', message: 'source_payment_unverified' }),
      expect.objectContaining({ ref: 'RES-0006', message: 'source_payment_unverified' }),
      expect.objectContaining({ ref: 'RES-0001', message: 'protection_identity_unverified' }),
    ]));
    expect(await snapshot()).toEqual(before);
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY }))
      .rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    { payment: 'Paid', paid: 0 },
    { payment: 'Deposit paid', paid: 500 },
    { payment: 'Unpaid', paid: 500 },
    { payment: 'Unpaid', paid: 'invalid' },
    { payment: 'Unpaid', paid: '0.001' },
    { payment: 'Unpaid', paid: '-0.001' },
    { payment: 'Unpaid', paid: '฿' },
    { payment: 'Unpaid', paid: ' , ' },
    { payment: 'Unpaid', paid: -1 },
    { payment: 'Unpaid', paid: '' },
    { payment: '', paid: 0 },
    { payment: 'Channel collected', paid: 0 },
    { payment: 'Refunded', paid: 0 },
  ])('blocks unresolved source payment evidence: %j', async evidence => {
    const before = await snapshot();
    const plan = await planWorkbookImport(db, parse([...safeRows, {
      ...safeRows[0], ref: 'UNVERIFIED', ...evidence,
    }]), TODAY);
    expect(plan.applyBlockers).toContainEqual(expect.objectContaining({ ref: 'UNVERIFIED', message: 'source_payment_unverified' }));
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    { status: 'Pending' }, { status: 'Cancelled' }, { status: 'Unknown' },
    { rooms: 'MISSING' }, { guest: '' }, { checkIn: 'invalid' }, { revenue: -1 }, { ref: 'invalid ref' },
  ])('retains paid evidence even when a row would be skipped: %j', async override => {
    const before = await snapshot();
    const plan = await planWorkbookImport(db, parse([...safeRows, {
      ...safeRows[0], ref: 'SKIPPED', ...override, payment: 'Paid', paid: 500,
    }]), TODAY);
    expect(plan.applyBlockers.some(blocker => blocker.message === 'source_payment_unverified')).toBe(true);
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });

  it('retains payment blockers on duplicate and unchanged rows', async () => {
    await applyWorkbookImport(db, await planWorkbookImport(db, parse(safeRows), TODAY), { actorIdentityId: admin, now: TODAY });
    const before = await snapshot();
    const paidRows = safeRows.map(row => ({ ...row, payment: 'Paid', paid: 500 }));
    for (const input of [paidRows, [...paidRows, paidRows[0]]]) {
      const plan = await planWorkbookImport(db, parse(input), TODAY);
      expect(plan.applyBlockers.filter(blocker => blocker.message === 'source_payment_unverified')).toHaveLength(input.length);
      await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
      expect(await snapshot()).toEqual(before);
    }
  });

  it.each(['owner_hold', 'ota_import', 'maintenance'] as const)('preserves %s blocks and rejects the entire mixed batch', async reason => {
    await db.blockedDate.create({ data: { unitId: v7, startDate: new Date('2026-12-24'),
      endDate: new Date('2027-01-01'), reason, externalRef: 'layantara:occupancy:unverified' } });
    const before = await snapshot();
    const plan = await planWorkbookImport(db, parse(safeRows), TODAY);
    expect(plan.applyBlockers).toContainEqual(expect.objectContaining({ ref: 'RES-0006', message: 'protection_identity_unverified' }));
    expect(plan.stays.every(stay => stay.occupancyId === null)).toBe(true);
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });

  it('rechecks protections introduced after preview before any writes', async () => {
    const plan = await planWorkbookImport(db, parse(safeRows), TODAY);
    expect(plan.applyBlockers).toEqual([]);
    await db.blockedDate.create({ data: { unitId: v7, startDate: new Date('2026-12-25'),
      endDate: new Date('2026-12-27'), reason: 'owner_hold' } });
    const before = await snapshot();
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });
  it('does not complete an existing historical stay when a late block quarantines its change', async () => {
    const input = [{ ...safeRows[0] }];
    const earlier = new Date('2026-07-01T08:00:00Z');
    await applyWorkbookImport(db, await planWorkbookImport(db, parse(input), earlier), { actorIdentityId: admin, now: earlier });
    const booking = await db.booking.findFirstOrThrow();
    expect(booking.status).toBe('confirmed');
    const plan = await planWorkbookImport(db, parse([{ ...input[0], revenue: 81000, checkOut: '2026-09-03' }]), TODAY);
    expect(plan.stays[0]).toMatchObject({ action: 'change', completeAfterImport: false });
    await db.blockedDate.create({ data: { unitId: a10, startDate: new Date('2026-09-02'),
      endDate: new Date('2026-09-03'), reason: 'owner_hold' } });
    // Simulate a block arriving just after the read-only preflight; the intake lock must see it.
    // Wrap only this caller. Spying on a shared Prisma delegate can remove
    // its dynamic method during restoration and corrupt subsequent suites.
    const stalePreflightDb = new Proxy(db, {
      get(target, key) {
        if (key === 'blockedDate') return new Proxy(target.blockedDate, {
          get(model, method) {
            if (method === 'findMany') return async () => [];
            return Reflect.get(model, method);
          },
        });
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const result = await applyWorkbookImport(stalePreflightDb, plan, { actorIdentityId: admin, now: TODAY });
    expect(result.applied[0].status).toBe('quarantined');
    expect(result.completed).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('confirmed');
    expect(typeof db.blockedDate.findMany).toBe('function');
  });

  async function reviewedPlan() {
    const { evidenceDigest } = await import('./reviewed-workbook');
    const parsed = parse([{ ...rows[0], payment: 'Paid', paid: 69834.96 }]);
    const row = parsed.rows[0], source = parsed.sourcePayments[0];
    const block = await db.blockedDate.findFirstOrThrow({ where: { unitId: a10 } });
    const reviewedWorkbookImport: ReviewedWorkbookManifest = { version: 1, workbookSha256: parsed.workbookSha256!,
      provenance: 'synthetic-source-review:v1', entries: [{
        ref: row.ref, rowDigest: evidenceDigest({ row, source }), unitId: a10, unitExternalId: 'src-A10',
        startDate: row.startDate, endDate: row.endDate, totalSatang: row.revenueSatang,
        guestName: row.guestName, ...mapChannel(row.channelLabel), adults: row.adults, children: row.children,
        rawStatus: source.paymentStatus, reportedPaidSatang: source.amountPaidSatang,
        block: { id: block.id, externalRef: block.externalRef!, sourceId: 'occ-1', reason: 'ota_import' },
      }] };
    await db.externalSystem.update({ where: { id: systemId }, data: { config: {
      bookingAuthority: 'myuno', cutoverVerified: true, protectionEnabled: true, reviewedWorkbookImport,
    } } });
    return { parsed, block, manifest: reviewedWorkbookImport,
      plan: await planWorkbookImport(db, parsed, TODAY, { reviewedSource: true }) };
  }

  it('atomically converts only reviewed source protection, preserves unknown party and unverified money, then replays', async () => {
    const { parsed, block, plan } = await reviewedPlan();
    expect(plan.applyBlockers).toEqual([]);
    expect(plan.untouchedProtections).toHaveLength(1);
    expect(plan.untouchedProtections[0]).toMatchObject({ unitCode: 'V7', startDate: '2027-01-01' });
    expect(plan.stays[0]).toMatchObject({ action: 'create', partyUnknown: true, adults: 0, children: 0, completeAfterImport: false });
    const result = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY });
    expect(result.applied[0].status).toBe('processed');
    const booking = await db.booking.findUniqueOrThrow({ where: { id: result.applied[0].bookingId! } });
    expect(booking).toMatchObject({ receivableStatus: 'pending_reconciliation', adults: 0, children: 0, status: 'confirmed', totalThb: 6983496 });
    expect(booking.priceBreakdown).toMatchObject({ sourcePaymentEvidence: { rawStatus: 'Paid', reportedPaidSatang: 6983496 },
      sourcePartyEvidence: { adults: null, children: null } });
    expect(await db.blockedDate.findUnique({ where: { id: block.id } })).toBeNull();
    expect(await db.blockedDate.count()).toBe(1);
    expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
    const replay = await planWorkbookImport(db, parsed, TODAY, { reviewedSource: true });
    const repeat = await applyWorkbookImport(db, replay, { actorIdentityId: admin, now: new Date(TODAY.getTime() + 60000) });
    expect(repeat.applied[0]).toMatchObject({ status: 'duplicate', bookingId: booking.id });
    expect(await db.booking.count()).toBe(1);
    expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('rejects wrong workbook bytes and mutated source facts without writes', async () => {
    const { parsed } = await reviewedPlan();
    const before = await snapshot();
    await expect(planWorkbookImport(db, { ...parsed, workbookSha256: 'f'.repeat(64) }, TODAY, { reviewedSource: true })).rejects.toThrow();
    const edited = { ...parsed, rows: [{ ...parsed.rows[0], revenueSatang: 1 }] };
    const plan = await planWorkbookImport(db, edited, TODAY, { reviewedSource: true });
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: admin })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
    expect(await snapshot()).toEqual(before);
  });

  it.each(['block', 'manifest'] as const)('quarantines a stale reviewed %s under transaction without converting protection', async target => {
    const { plan, block, manifest } = await reviewedPlan();
    if (target === 'block') await db.blockedDate.update({ where: { id: block.id }, data: { reason: 'maintenance' } });
    else await db.externalSystem.update({ where: { id: systemId }, data: { config: {
      bookingAuthority: 'myuno', cutoverVerified: true, reviewedWorkbookImport: { ...manifest, provenance: 'new-review' },
    } } });
    const result = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY });
    expect(result.applied[0].status).toBe('quarantined');
    expect(await db.blockedDate.findUnique({ where: { id: block.id } })).not.toBeNull();
    expect(await db.booking.count()).toBe(0); expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
  });

  it.each([false, true])('checks exact reviewed null-reference note and preserves protection on mismatch=%s', async mismatch => {
    const { parsed, block, manifest } = await reviewedPlan();
    const note = 'Synthetic reviewed reservation RES-0001';
    await db.blockedDate.update({ where: { id: block.id }, data: { externalRef: null, note } });
    manifest.entries[0].block = { ...manifest.entries[0].block, externalRef: null,
      sourceId: 'RES-0001', ...{ note } };
    await db.externalSystem.update({ where: { id: systemId }, data: { config: {
      bookingAuthority: 'myuno', cutoverVerified: true, reviewedWorkbookImport: manifest,
    } } });
    const plan = await planWorkbookImport(db, parsed, TODAY, { reviewedSource: true });
    expect(plan.applyBlockers).toEqual([]);
    expect(plan.untouchedProtections).toHaveLength(1);
    expect(plan.untouchedProtections[0].unitCode).toBe('V7');
    if (mismatch) await db.blockedDate.update({ where: { id: block.id }, data: { note: 'Changed after preview' } });
    const result = await applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY });
    expect(result.applied[0].status).toBe(mismatch ? 'quarantined' : 'processed');
    expect(await db.booking.count()).toBe(mismatch ? 0 : 1);
    expect(!!await db.blockedDate.findUnique({ where: { id: block.id } })).toBe(mismatch);
    expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
    if (!mismatch) {
      const replay = await planWorkbookImport(db, parsed, TODAY, { reviewedSource: true });
      expect((await applyWorkbookImport(db, replay, { actorIdentityId: admin, now: TODAY })).applied[0].status).toBe('duplicate');
    }
  });

  it('serializes simultaneous reviewed imports into one booking and one guest identity', async () => {
    const { plan } = await reviewedPlan();
    const identitiesBefore = await db.identity.count();
    const results = await Promise.all([
      applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY }),
      applyWorkbookImport(db, plan, { actorIdentityId: admin, now: TODAY }),
    ]);
    expect(results.map(r => r.applied[0].status).sort()).toEqual(['duplicate', 'processed']);
    expect(new Set(results.map(r => r.applied[0].bookingId)).size).toBe(1);
    expect(await db.booking.count()).toBe(1);
    expect(await db.identity.count()).toBe(identitiesBefore + 1);
    expect(await db.blockedDate.count()).toBe(1);
    expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
  });

});
