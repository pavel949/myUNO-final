import { describe, expect, it, vi } from 'vitest';
import { applyChannelEvent } from './channel-service';
import { evidenceDigest, reviewedGuestKey, type ReviewedWorkbookManifest } from './reviewed-workbook';
function fixture(lateBlock = false) {
  const entry = { ref: 'SYNTH-NEW', rowDigest: 'b'.repeat(64), unitId: 'unit-a', unitExternalId: 'external-a',
    startDate: '2026-11-01', endDate: '2026-11-04', totalSatang: 1200000, guestName: 'Synthetic Guest',
    channel: 'direct' as const, adults: null, children: null, rawStatus: 'Partially paid', reportedPaidSatang: 300000,
    block: null, operationalDetails: { contact: 'synthetic@example.test', notes: 'Synthetic late arrival', servicesIncluded: 'Breakfast' } };
  const manifest: ReviewedWorkbookManifest = { version: 1, workbookSha256: 'a'.repeat(64), provenance: 'synthetic-source:revision-one', entries: [entry] };
  const system = { id: 'system-a', environment: 'source-live', status: 'staging',
    config: { bookingAuthority: 'myuno', cutoverVerified: true, reviewedWorkbookImport: manifest } };
  const mappings: any[] = [{ entity_type: 'unit', external_id: 'external-a', internal_id: 'unit-a', metadata: { verified: true } }];
  let prior: any = null;
  const tx: any = { $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValue([]),
    externalSystem: { findUnique: async () => system },
    externalMapping: { findFirst: async ({ where }: any) => mappings.find(m => m.entity_type === where.entity_type && m.external_id === where.external_id) ?? null,
      create: vi.fn(async ({ data }: any) => { mappings.push(data); return data; }) },
    externalEventInbox: { findFirst: async () => prior, create: async ({ data }: any) => (prior = { ...data, id: 'inbox-a' }),
      update: vi.fn(async ({ data }: any) => { prior = { ...prior, ...data }; return prior; }) },
    externalAggregateCheckpoint: { findFirst: async () => null, create: vi.fn() },
    unit: { findUnique: async () => ({ id: 'unit-a', projectId: 'project-a', inventoryCategoryId: 'category-a', status: 'live' }) },
    booking: { findFirst: async () => null, create: vi.fn(async ({ data }: any) => ({ ...data, id: 'booking-a' })) },
    blockedDate: { findMany: async () => lateBlock ? [{ id: 'late-maintenance', reason: 'maintenance', externalRef: null,
      startDate: new Date('2026-11-01'), endDate: new Date('2026-11-04') }] : [], delete: vi.fn() },
    identity: { create: vi.fn(async () => ({ id: 'guest-a' })) }, auditLog: { create: vi.fn() },
    payment: { create: vi.fn() }, ledgerEntry: { create: vi.fn() } };
  const db: any = { externalSystem: { findFirst: async () => system }, $transaction: async (fn: any) => fn(tx) };
  const event = { contractVersion: 1 as const, eventId: 'synthetic-event', eventVersion: 1, eventType: 'booking.confirmed' as const,
    externalBookingId: entry.ref, externalUnitId: entry.unitExternalId, occurredAt: '2026-10-21T00:00:00Z',
    startDate: entry.startDate, endDate: entry.endDate, totalSatang: entry.totalSatang, currency: 'THB' as const,
    channel: entry.channel, guestName: entry.guestName, guestExternalId: reviewedGuestKey(entry.ref), adults: 0, children: 0 };
  const input = { event, rawBody: 'synthetic-reviewed-event', environment: system.environment, operatingRecord: true,
    workbookReview: { workbookSha256: manifest.workbookSha256, manifestDigest: evidenceDigest(manifest), ref: entry.ref, rowDigest: entry.rowDigest } };
  return { db, tx, input };
}
describe('canonical intake for reviewed new placement', () => {
  it('preserves unknown party, operational notes and reported payment without receipts, and replays once', async () => {
    const { db, tx, input } = fixture();
    expect(await applyChannelEvent(db, input)).toEqual({ status: 'processed', bookingId: 'booking-a' });
    expect(tx.booking.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adults: 0, children: 0,
      partyDetailsStatus: 'source_unknown', receivableStatus: 'pending_reconciliation', totalThb: 1200000,
      balanceDueThb: 1200000, internalNote: 'Synthetic late arrival', priceBreakdown: expect.objectContaining({
        sourcePaymentEvidence: expect.objectContaining({ rawStatus: 'Partially paid', reportedPaidSatang: 300000 }),
        sourcePartyEvidence: expect.objectContaining({ adults: null, children: null }),
        sourceOperationalEvidence: expect.objectContaining({ contact: 'synthetic@example.test', servicesIncluded: 'Breakfast' }) }) }) });
    expect(await applyChannelEvent(db, input)).toEqual({ status: 'duplicate', bookingId: 'booking-a' });
    expect(tx.booking.create).toHaveBeenCalledTimes(1);
    expect(tx.identity.create).toHaveBeenCalledTimes(1);
    expect(tx.blockedDate.delete).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled(); expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });
  it('quarantines a late maintenance block under the canonical transaction before identity or booking creation', async () => {
    const { db, tx, input } = fixture(true);
    expect(await applyChannelEvent(db, input)).toMatchObject({ status: 'quarantined', code: 'workbook_review_block_changed' });
    expect(tx.booking.create).not.toHaveBeenCalled(); expect(tx.identity.create).not.toHaveBeenCalled();
    expect(tx.blockedDate.delete).not.toHaveBeenCalled();
  });
});
