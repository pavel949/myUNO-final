import { describe, it, expect } from 'vitest';
import { readReviewedWorkbook, reviewedEntryForEvent, reviewedGuestKey, evidenceDigest, type ReviewedWorkbookManifest } from './reviewed-workbook';
import { parseChannelEvent } from './channel-contract';

const manifest: ReviewedWorkbookManifest = {
  version: 1, workbookSha256: 'a'.repeat(64), provenance: 'synthetic-review:v1', entries: [{
    ref: 'RES-TEST', rowDigest: 'b'.repeat(64), unitId: 'unit-test', unitExternalId: 'source-unit',
    startDate: '2026-10-01', endDate: '2026-10-04', totalSatang: 900000,
    guestName: 'Synthetic Guest', channel: 'direct', adults: null, children: null,
    rawStatus: 'Paid', reportedPaidSatang: 900000,
    block: { id: 'block-test', externalRef: 'layantara:occupancy:source-test', sourceId: 'source-test', reason: 'ota_import' },
  }],
};
const entry = manifest.entries[0];
const event = { contractVersion: 1 as const, eventId: 'event-test', eventVersion: 1, eventType: 'booking.confirmed' as const,
  externalBookingId: entry.ref, externalUnitId: entry.unitExternalId, occurredAt: '2026-10-15T00:00:00Z',
  startDate: entry.startDate, endDate: entry.endDate, totalSatang: entry.totalSatang, currency: 'THB' as const,
  guestName: entry.guestName, guestExternalId: reviewedGuestKey(entry.ref), channel: entry.channel,
  adults: 0, children: 0 };
const review = { workbookSha256: manifest.workbookSha256, manifestDigest: evidenceDigest(manifest), ref: entry.ref, rowDigest: entry.rowDigest };

describe('server-reviewed source manifest', () => {
  it('accepts exact review without treating source payment as a receipt', () => {
    expect(reviewedEntryForEvent({ reviewedWorkbookImport: manifest }, review, event).entry.reportedPaidSatang).toBe(900000);
  });
  it('rejects absent and mismatched file hashes', () => {
    expect(() => readReviewedWorkbook({}, manifest.workbookSha256)).toThrow('WORKBOOK_REVIEW_MANIFEST_REQUIRED');
    expect(() => readReviewedWorkbook({ reviewedWorkbookImport: manifest }, 'c'.repeat(64))).toThrow();
  });
  it('rejects a mutated server manifest after preview', () => {
    const changed = { ...manifest, provenance: 'different-review' };
    expect(() => reviewedEntryForEvent({ reviewedWorkbookImport: changed }, review, event)).toThrow('WORKBOOK_REVIEW_FACTS_CHANGED');
  });
  it.each(['guestName','totalSatang','adults','externalUnitId','externalBookingId'] as const)('rejects changed event %s', field => {
    const changed = { ...event, [field]: typeof event[field] === 'number' ? 12 : 'changed' };
    expect(() => reviewedEntryForEvent({ reviewedWorkbookImport: manifest }, review, changed)).toThrow();
  });
  it('rejects unrelated and duplicate protection identities', () => {
    const bad = { ...manifest, entries: [{ ...entry, block: { ...entry.block, externalRef: 'maintenance:test' } }] };
    expect(() => readReviewedWorkbook({ reviewedWorkbookImport: bad }, manifest.workbookSha256)).toThrow();
    expect(() => readReviewedWorkbook({ reviewedWorkbookImport: { ...manifest, entries: [entry, entry] } }, manifest.workbookSha256)).toThrow();
  });
  it('keeps ordinary channel contracts at >=1 adult', () => {
    expect(() => parseChannelEvent(event)).toThrow('invalid_booking_contract');
    expect(parseChannelEvent(event, { reviewedUnknownParty: true }).adults).toBe(0);
  });
  it('does not merge identical guest names across reservation references', () => {
    expect(reviewedGuestKey('reservation-a')).not.toBe(reviewedGuestKey('reservation-b'));
  });
  it('accepts an explicitly reviewed null-reference protection snapshot and rejects unrelated note identity', () => {
    const manual = { ...manifest, entries: [{ ...entry, block: { ...entry.block, externalRef: null, sourceId: entry.ref, note: 'Reviewed source reservation RES-TEST' } }] };
    expect(readReviewedWorkbook({ reviewedWorkbookImport: manual }, manifest.workbookSha256)).toEqual(manual);
    const unrelated = { ...manual, entries: [{ ...manual.entries[0], block: { ...manual.entries[0].block, sourceId: 'OTHER-REF' } }] };
    expect(() => readReviewedWorkbook({ reviewedWorkbookImport: unrelated }, manifest.workbookSha256)).toThrow();
    const missingNote = { ...manual, entries: [{ ...manual.entries[0], block: { ...manual.entries[0].block, note: null } }] };
    expect(() => readReviewedWorkbook({ reviewedWorkbookImport: missingNote }, manifest.workbookSha256)).toThrow();
  });

});
