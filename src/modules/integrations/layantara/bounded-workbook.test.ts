import { describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/booking', () => ({ createReservationGroup: vi.fn() }));
vi.mock('./channel-service', () => ({ applyChannelEvent: vi.fn() }));
import { buildReservationsWorkbook } from '@/test/xlsx-fixture';
import { parseReservationsWorkbook, planWorkbookImport, mapChannel, applyWorkbookImport } from './workbook-import';
import { evidenceDigest, type ReviewedWorkbookManifest } from './reviewed-workbook';
const now = new Date('2026-10-20T18:30:00Z'); // 21 October in Phuket
const row = { ref: 'SYNTH-NEW', channel: 'Direct', guest: 'Synthetic Guest', checkIn: '2026-10-22', checkOut: '2026-10-25',
  rooms: 'AA', revenue: 12000, status: 'Confirmed', payment: 'Paid', paid: 3000 };
function setup(input = [row], block: unknown = null) {
  const parsed = parseReservationsWorkbook(buildReservationsWorkbook(input));
  const r = parsed.rows[0], source = parsed.sourcePayments[0];
  const manifest: ReviewedWorkbookManifest = { version: 1, workbookSha256: parsed.workbookSha256!, provenance: 'synthetic-sheet:revision-one',
    entries: [{ ref: r.ref, rowDigest: evidenceDigest({ row: r, source }), unitId: 'unit-a13', unitExternalId: 'source-a13',
      startDate: r.startDate, endDate: r.endDate, totalSatang: r.revenueSatang, guestName: r.guestName,
      ...mapChannel(r.channelLabel), adults: r.adults, children: r.children, rawStatus: source.paymentStatus,
      reportedPaidSatang: source.amountPaidSatang, block: block as null }] };
  const config = { bookingAuthority: 'myuno', cutoverVerified: true, reviewedWorkbookImport: manifest };
  const db: any = { externalSystem: { findFirst: async () => ({ id: 'source', environment: 'source-live', config }) },
    externalMapping: { findMany: async () => [{ entity_type: 'unit', external_id: 'source-a13', internal_id: 'unit-a13', metadata: { unit_code: 'A13' } }] },
    booking: { findMany: async () => [] }, blockedDate: { findMany: async () => [] },
    commercialOffering: { findMany: async () => [] }, payment: { findMany: async () => [] } };
  return { parsed, manifest, db };
}
describe('bounded reviewed workbook planning', () => {
  it('parses source contact and operational notes without promoting them to verified identity facts', () => {
    const parsed = parseReservationsWorkbook(buildReservationsWorkbook([{ ...row, contact: 'synthetic@example.test', notes: 'Synthetic late arrival' }]));
    expect(parsed.rows[0].operationalDetails).toEqual({ contact: 'synthetic@example.test', notes: 'Synthetic late arrival' });
  });
  it('creates a reviewed new placement without an old block and preserves unknown party', async () => {
    const { parsed, db } = setup();
    const plan = await planWorkbookImport(db, parsed, now, { reviewedSource: true, currentOnly: true });
    expect(plan.today).toBe('2026-10-21');
    expect(plan.applyBlockers).toEqual([]);
    expect(plan.stays[0]).toMatchObject({ action: 'create', unitId: 'unit-a13', unitCode: 'AA', adults: 0, children: 0, partyUnknown: true });
  });
  it('rejects a new protection that appeared after reviewed zero-block evidence', async () => {
    const { parsed, db } = setup();
    db.blockedDate.findMany = async () => [{ id: 'manual', unitId: 'unit-a13', startDate: new Date('2026-10-22'), endDate: new Date('2026-10-25'), reason: 'maintenance', externalRef: null }];
    const plan = await planWorkbookImport(db, parsed, now, { reviewedSource: true });
    expect(plan.applyBlockers).toContainEqual(expect.objectContaining({ message: 'source_review_block_changed' }));
    await expect(applyWorkbookImport(db, plan, { actorIdentityId: 'synthetic-admin' })).rejects.toThrow('WORKBOOK_RECONCILIATION_REQUIRED');
  });
  it('keeps group totals unallocated and blocks multi-unit apply', async () => {
    const { parsed, db } = setup([{ ...row, rooms: 'AA,A14' }]);
    const plan = await planWorkbookImport(db, parsed, now, { reviewedSource: true });
    expect(plan.stays).toHaveLength(2);
    expect(plan.stays.every(stay => stay.totalSatang === 0 && stay.action === 'skip')).toBe(true);
    expect(plan.applyBlockers).toEqual(expect.arrayContaining([expect.objectContaining({ message: 'source_group_allocation_required' })]));
  });
  it('does not fabricate adults for an unreviewed source row', async () => {
    const { parsed, db } = setup([{ ...row, rooms: 'A13', payment: 'Unpaid', paid: 0 }]);
    const plan = await planWorkbookImport(db, parsed, now);
    expect(plan.applyBlockers).toContainEqual(expect.objectContaining({ message: 'source_party_review_required' }));
    expect(plan.stays[0].action).toBe('skip');
  });
  it('excludes past records by Phuket checkout day and leaves cancelled-only history unwritten', async () => {
    const { parsed, db } = setup([{ ...row, rooms: 'A13', checkIn: '2026-10-19', checkOut: '2026-10-21' },
      { ...row, ref: 'SYNTH-CANCEL', rooms: 'A13', status: 'Cancelled', payment: 'Unpaid', paid: 0 }]);
    const plan = await planWorkbookImport(db, parsed, now, { currentOnly: true });
    expect(plan.summary.reservations).toBe(1);
    expect(plan.applyBlockers).toEqual([]);
    expect(plan.stays[0]).toMatchObject({ action: 'skip', reason: 'cancelled_source_no_booking' });
  });
  it('does not release or claim an unrelated active block for a cancelled-only source row', async () => {
    const { parsed, db } = setup([{ ...row, rooms: 'A13', status: 'Cancelled', payment: 'Unpaid', paid: 0 }]);
    db.blockedDate.findMany = async () => [{ id: 'other-stay', unitId: 'unit-a13',
      startDate: new Date('2026-10-22'), endDate: new Date('2026-10-25'), reason: 'ota_import' }];
    const plan = await planWorkbookImport(db, parsed, now, { currentOnly: true });
    expect(plan.applyBlockers).toEqual([]);
    expect(plan.stays[0]).toMatchObject({ action: 'skip', reason: 'cancelled_source_no_booking' });
  });
  it('binds operational details to source row digest and rejects parser problems before writes', async () => {
    const { parsed, db } = setup();
    parsed.rows[0].operationalDetails = { notes: 'New source facts after review' };
    const plan = await planWorkbookImport(db, parsed, now, { reviewedSource: true });
    expect(plan.applyBlockers).toContainEqual(expect.objectContaining({ message: 'source_review_facts_changed' }));
    parsed.problems.push({ rowNumber: 7, ref: 'SYNTH-BAD', message: 'dates' });
    const malformed = await planWorkbookImport(db, parsed, now, { reviewedSource: true });
    expect(malformed.applyBlockers).toContainEqual({ rowNumber: 7, ref: 'SYNTH-BAD', message: 'dates' });
  });
});
