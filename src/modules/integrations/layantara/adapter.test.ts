import { describe, expect, it } from 'vitest';
import { auditLegacyOccupancies, classifyLegacyOccupancy } from './adapter';
import type { LegacyOccupancy } from './adapter';
const row: LegacyOccupancy = { id: 'occ-1', inventory_id: 'legacy-1', occupancy_kind: 'imported_reservation',
 state: 'active', check_in: '2026-10-01', check_out: '2026-10-04', currency: 'THB', booking_total_amount: 120000 };
const map = new Map([['legacy-1', 'canonical-1']]);
describe('non-destructive Layantara occupancy classification', () => {
  it('preserves active imported reservation occupancy as an externally keyed block', () => {
    expect(classifyLegacyOccupancy(row, map)).toEqual({
      action:'protect', id:'occ-1', unitId:'canonical-1', startDate:'2026-10-01',
      endDate:'2026-10-04', blockReason:'ota_import', externalRef:'layantara:occupancy:occ-1',
    });
  });
  it('does not convert unverified identities into bookings', () => {
    expect(classifyLegacyOccupancy({ ...row, occupancy_kind:'reservation' }, map)).toMatchObject({
      action:'quarantine', reason:'requires_booking_identity_reconciliation',
    });
  });
  it('archives cancelled source rows and quarantines unknown unit mappings', () => {
    expect(classifyLegacyOccupancy({ ...row, state:'cancelled' }, map).action).toBe('archive');
    expect(classifyLegacyOccupancy(row, new Map()).action).toBe('quarantine');
  });
  it('quarantines unverified provisional holds and archives expired ones', () => {
    expect(classifyLegacyOccupancy({ ...row, occupancy_kind:'provisional_hold' }, map)).toMatchObject({
      action:'quarantine', reason:'hold_expiry_unverified',
    });
    expect(classifyLegacyOccupancy({ ...row, occupancy_kind:'provisional_hold', expires_at:'2020-01-01T00:00:00Z' }, map)).toMatchObject({
      action:'archive', reason:'expired_source_hold',
    });
  });
  it('detects intersecting ranges, not only duplicate date ranges', () => {
    expect(auditLegacyOccupancies([row,{ ...row,id:'occ-3',check_in:'2026-10-03',check_out:'2026-10-05' }],map).conflicts)
      .toEqual(['canonical-1:occ-1<>occ-3']);
  });
  it('detects duplicate protection intervals prior to import', () => {
    expect(auditLegacyOccupancies([row, { ...row, id:'occ-2' }], map)).toMatchObject({
      protected:2, quarantined:0, conflicts:['canonical-1:2026-10-01:2026-10-04'],
    });
  });
});
