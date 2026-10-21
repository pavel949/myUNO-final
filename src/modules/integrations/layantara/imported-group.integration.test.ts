import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { buildReservationsWorkbook } from '@/test/xlsx-fixture';
import { parseReservationsWorkbook, planWorkbookImport, applyWorkbookImport, mapChannel } from './workbook-import';
import { evidenceDigest, type ReviewedWorkbookManifest } from './reviewed-workbook';
import { removeBlockedDate } from '@/modules/core/availability.service';
import { listImportedGroupsForUnits } from './imported-group.service';

const now = new Date('2026-10-21T00:00:00Z');
describe('reviewed historical group source and canonical protected placements', () => {
  beforeEach(resetDb);
  async function fixture(empty = false) {
    const actor = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const units: Awaited<ReturnType<typeof createUnit>>[] = [];
    for (const code of ['AA','V7']) units.push(await createUnit({ projectId: project.id, name: 'Synthetic ' + code, status: 'live' }));
    const parsed = parseReservationsWorkbook(buildReservationsWorkbook([{ ref: 'SYNTH-GROUP', channel: 'Direct', guest: 'Synthetic Group Guest',
      checkIn: '2026-12-17', checkOut: '2026-12-21', rooms: 'AA,V7', revenue: 1234.56, status: 'Confirmed', payment: 'Partially paid', paid: 100,
      notes: 'Synthetic arrival note' }]));
    const row = parsed.rows[0], source = parsed.sourcePayments[0];
    const blocks = empty ? [] : await Promise.all(units.map((unit,i) => db.blockedDate.create({ data: { unitId: unit.id,
      startDate: new Date(row.startDate), endDate: new Date(row.endDate), reason: 'ota_import',
      externalRef: 'layantara:occupancy:synthetic-' + i, note: 'Synthetic original protection' } })));
    const manifest: ReviewedWorkbookManifest = { version: 3, workbookSha256: parsed.workbookSha256!, provenance: 'synthetic-source:revision-one',
      sourceSnapshot: { spreadsheetId: 'synthetic-sheet', modifiedAt: '2026-10-21T00:00:00Z', capturedAt: '2026-10-21T00:01:00Z', timezone: 'Asia/Bangkok' },
      entries: [], groups: [{ ref: row.ref, rowDigest: evidenceDigest({ row, source }), startDate: row.startDate, endDate: row.endDate,
        totalSatang: row.revenueSatang, guestName: row.guestName, ...mapChannel(row.channelLabel), adults: row.adults, children: row.children,
        rawStatus: source.paymentStatus, reportedPaidSatang: source.amountPaidSatang, operationalDetails: row.operationalDetails,
        placements: units.map((unit,i) => ({ unitCode: row.unitCodes[i], unitId: unit.id, unitExternalId: 'external-' + i,
          block: empty ? null : { id: blocks[i].id, externalRef: blocks[i].externalRef, sourceId: 'synthetic-' + i,
            note: blocks[i].note, reason: 'ota_import', updatedAt: blocks[i].updatedAt.toISOString() } })) }] };
    const system = await db.externalSystem.create({ data: { system_key: 'layantara_os', environment: 'source-live', display_name: 'Synthetic source',
      status: 'staging', config: { bookingAuthority: 'myuno', cutoverVerified: true, reviewedWorkbookImport: manifest } as unknown as Prisma.InputJsonValue } });
    for (const [i,unit] of units.entries()) await db.externalMapping.create({ data: { external_system_id: system.id, entity_type: 'unit',
      internal_id: unit.id, external_id: 'external-' + i, metadata: { verified: true, unit_code: row.unitCodes[i] } } });
    const plan = await planWorkbookImport(db, parsed, now, { reviewedSource: true, currentOnly: true });
    return { actor, project, units, blocks, parsed, manifest, system, plan };
  }
  const counts = async () => ({ source: await db.importedReservationSource.count(), placement: await db.importedReservationPlacement.count(),
    booking: await db.booking.count(), payment: await db.payment.count(), ledger: await db.ledgerEntry.count(), block: await db.blockedDate.count(), group: await db.reservationGroup.count() });

  it('keeps one exact group quote, two unknown amounts, original protection IDs and no invented receipts', async () => {
    const f = await fixture(); expect(f.plan.applyBlockers).toEqual([]); expect(f.plan.sourceGroups?.[0].action).toBe('create');
    const result = await applyWorkbookImport(db, f.plan, { actorIdentityId: f.actor.id, now });
    expect(result.sourceGroupResults[0].status).toBe('processed');
    expect(await counts()).toEqual({ source:1, placement:2, booking:0, payment:0, ledger:0, block:2, group:1 });
    const source = await db.importedReservationSource.findFirstOrThrow({ include: { placements: true, reservationGroup: true } });
    expect(source).toMatchObject({ quotedTotalThb:123456, reportedPaidThb:10000, sourcePaymentStatus:'Partially paid', adults:null, children:null });
    expect(source.placements.every(p => p.allocatedTotalThb === null)).toBe(true);
    expect(source.placements.map(p => p.blockedDateId).sort()).toEqual(f.blocks.map(b => b.id).sort());
    expect(source.reservationGroup.notes).toBe('Synthetic arrival note');
    expect(await listImportedGroupsForUnits(db,[f.units[0].id])).toEqual([]);
    expect(await listImportedGroupsForUnits(db,f.units.map(u=>u.id))).toHaveLength(1);
  });
  it('retries exactly once at group identity without duplicated protections, money or guests', async () => {
    const f = await fixture();
    await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now});
    const before = await counts(), identities = await db.identity.count();
    const again = await planWorkbookImport(db,f.parsed,now,{reviewedSource:true,currentOnly:true});
    expect((await applyWorkbookImport(db,again,{actorIdentityId:f.actor.id,now})).sourceGroupResults[0].status).toBe('duplicate');
    expect(await counts()).toEqual(before); expect(await db.identity.count()).toBe(identities);
  });
  it('serializes simultaneous group imports to one source and one set of placements', async () => {
    const f = await fixture();
    const results = await Promise.all([1,2].map(()=>applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now})));
    expect(results.map(r=>r.sourceGroupResults[0].status).sort()).toEqual(['duplicate','processed']);
    expect((await counts()).placement).toBe(2); expect((await counts()).group).toBe(1);
  });
  it('creates missing canonical protection only inside successful group transaction', async () => {
    const f=await fixture(true); expect(await db.blockedDate.count()).toBe(0);
    expect((await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now})).sourceGroupResults[0].status).toBe('processed');
    expect((await counts()).block).toBe(2); expect(await db.booking.count()).toBe(0);
  });
  it('holds a changed/manual protection without erasing either old source or operator edits', async () => {
    const f=await fixture(); await db.blockedDate.update({where:{id:f.blocks[1].id},data:{note:'Synthetic concurrent staff edit'}});
    const before=await counts();
    expect((await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now})).sourceGroupResults[0]).toMatchObject({status:'quarantined',code:'IMPORTED_GROUP_PROTECTION_CHANGED'});
    expect(await counts()).toEqual(before); expect((await db.blockedDate.findUniqueOrThrow({where:{id:f.blocks[1].id}})).note).toBe('Synthetic concurrent staff edit');
  });
  it('rolls back source, guest, group and first placement if a later placement fails', async () => {
    const f=await fixture(), before=await counts(), identities=await db.identity.count();
    await db.$executeRawUnsafe(`CREATE FUNCTION synthetic_group_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT count(*) FROM imported_reservation_placement)=1 THEN RAISE EXCEPTION 'synthetic placement failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER synthetic_group_failure BEFORE INSERT ON imported_reservation_placement FOR EACH ROW EXECUTE FUNCTION synthetic_group_failure()');
    try {
      expect((await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now})).sourceGroupResults[0].status).toBe('quarantined');
      expect(await counts()).toEqual(before); expect(await db.identity.count()).toBe(identities);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER synthetic_group_failure ON imported_reservation_placement'); await db.$executeRawUnsafe('DROP FUNCTION synthetic_group_failure()'); }
  });
  it('database guards reject zero allocation, protection deletion and owner statement recognition', async () => {
    const f=await fixture(); await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now});
    const placement=await db.importedReservationPlacement.findFirstOrThrow();
    await expect(db.importedReservationPlacement.update({where:{id:placement.id},data:{allocatedTotalThb:0}})).rejects.toThrow('IMPORTED_GROUP_RECONCILIATION_REQUIRED');
    await expect(removeBlockedDate(db,placement.blockedDateId)).rejects.toThrow('review the imported source group');
    await expect(db.blockedDate.delete({where:{id:placement.blockedDateId}})).rejects.toThrow('IMPORTED_GROUP_PROTECTION_REQUIRES_RECONCILIATION');
    await expect(db.$queryRaw`SELECT assert_period_receivables_resolved(${placement.unitId},${new Date('2026-12-01')}::timestamp,${new Date('2026-12-31')}::timestamp)`).rejects.toThrow('STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED');
    expect(await db.payment.count()).toBe(0); expect(await db.ledgerEntry.count()).toBe(0);
  });
  it('does not accept ordinary booking money on an unresolved imported group', async () => {
    const f=await fixture(); await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now});
    const source=await db.importedReservationSource.findFirstOrThrow();
    await expect(db.booking.create({data:{unitId:f.units[0].id,projectId:f.project.id,guestIdentityId:f.actor.id,
      reservationGroupId:source.reservationGroupId,bookingType:'guest_stay',channel:'direct',status:'confirmed',
      startDate:new Date('2027-02-01'),endDate:new Date('2027-02-03'),adults:1,children:0,totalThb:10000}})).rejects.toThrow('IMPORTED_GROUP_ALLOCATION_REQUIRED');
    expect(await db.booking.count()).toBe(0);
  });
  it('blocks ordinary overlapping bookings and actual owner statement creation', async () => {
    const f=await fixture(); await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now});
    await expect(db.booking.create({data:{unitId:f.units[0].id,projectId:f.project.id,guestIdentityId:f.actor.id,
      bookingType:'guest_stay',channel:'direct',status:'confirmed',startDate:new Date('2026-12-18'),
      endDate:new Date('2026-12-20'),adults:1,children:0,totalThb:10000}})).rejects.toThrow('IMPORTED_GROUP_DATES_PROTECTED');
    const engagement=await db.unitEngagement.create({data:{unitId:f.units[0].id,ownerIdentityId:f.actor.id,engagementType:'owner_direct'}});
    await expect(db.ownerStatement.create({data:{unitId:f.units[0].id,ownerIdentityId:f.actor.id,engagementId:engagement.id,
      periodStart:new Date('2026-12-01'),periodEnd:new Date('2026-12-31'),grossRevenueTh:0,totalCostsTh:0,noiTh:0,
      ownerShareTh:0,estateShareTh:0}})).rejects.toThrow('STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED');
    expect(await db.ownerStatement.count()).toBe(0); expect(await db.booking.count()).toBe(0);
  });

  it('holds a group rather than inserting unresolved evidence beneath an existing statement', async () => {
    const f=await fixture();
    const engagement=await db.unitEngagement.create({data:{unitId:f.units[0].id,ownerIdentityId:f.actor.id,engagementType:'owner_direct'}});
    await db.ownerStatement.create({data:{unitId:f.units[0].id,ownerIdentityId:f.actor.id,engagementId:engagement.id,
      periodStart:new Date('2026-12-01'),periodEnd:new Date('2026-12-31'),grossRevenueTh:0,totalCostsTh:0,noiTh:0,ownerShareTh:0,estateShareTh:0}});
    const before=await counts();
    expect((await applyWorkbookImport(db,f.plan,{actorIdentityId:f.actor.id,now})).sourceGroupResults[0])
      .toMatchObject({status:'quarantined',code:'IMPORTED_GROUP_EXISTING_STATEMENT_REQUIRES_REVIEW'});
    expect(await counts()).toEqual(before); expect(await db.ownerStatement.count()).toBe(1);
  });

});
