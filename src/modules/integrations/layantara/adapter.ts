/**
 * A strict, pure, non-destructive Layantara occupancy classifier.
 * This is an input contract for the staged import, NOT a direct database writer.
 * Imported financial amounts remain source evidence; do not manufacture a payment
 * or ledger entry from occupancy metadata.
 */
export interface LegacyOccupancy {
  id: string;
  inventory_id: string;
  occupancy_kind: string;
  state: string;
  check_in: string;
  check_out: string;
  currency: string | null;
  booking_total_amount: number | string | null;
}
export type ReconciliationDecision =
  | { action: 'quarantine'; id: string; reason: string }
  | { action: 'archive'; id: string; reason: string }
  | { action: 'protect'; id: string; unitId: string; startDate: string; endDate: string;
      blockReason: 'ota_import' | 'owner_hold' | 'other'; externalRef: string };
import { validCalendarDay } from '@/modules/booking/calendar-projection';

export function classifyLegacyOccupancy(
  source: LegacyOccupancy,
  mapping: ReadonlyMap<string, string>,
): ReconciliationDecision {
  if (!source.id || !source.inventory_id) return { action: 'quarantine', id: source.id, reason: 'missing_source_identity' };
  if (!validCalendarDay(source.check_in) || !validCalendarDay(source.check_out) || source.check_out <= source.check_in) {
    return { action: 'quarantine', id: source.id, reason: 'invalid_date_range' };
  }
  if (source.state !== 'active') return { action: 'archive', id: source.id, reason: 'non_active_source_state' };
  const unitId = mapping.get(source.inventory_id);
  if (!unitId) return { action: 'quarantine', id: source.id, reason: 'unmapped_physical_unit' };
  const reasons: Record<string, 'ota_import' | 'owner_hold' | 'other'> = {
    imported_reservation: 'ota_import', owner_stay: 'owner_hold', provisional_hold: 'other',
  };
  const blockReason = reasons[source.occupancy_kind];
  // A canonical active reservation is not converted to a block: reconcile its
  // guest/booking identity first, then import via a dedicated booking transition.
  if (!blockReason) return { action: 'quarantine', id: source.id, reason: 'requires_booking_identity_reconciliation' };
  return {
    action: 'protect', id: source.id, unitId,
    startDate: source.check_in, endDate: source.check_out, blockReason,
    externalRef: 'layantara:occupancy:' + source.id,
  };
}

export function auditLegacyOccupancies(
  sources: LegacyOccupancy[], mapping: ReadonlyMap<string, string>,
) {
  const decisions = sources.map((row) => classifyLegacyOccupancy(row, mapping));
  const unique = new Set<string>();
  const conflicts = new Set<string>();
  const protectedRows = decisions.filter((row): row is Extract<ReconciliationDecision, {action:'protect'}> => row.action === 'protect');
  for (const row of protectedRows) {
    const key = row.unitId + ':' + row.startDate + ':' + row.endDate;
    if (unique.has(key)) conflicts.add(key);
    unique.add(key);
  }
  return {
    decisions, conflicts: [...conflicts],
    protected: protectedRows.length,
    archived: decisions.filter((row) => row.action === 'archive').length,
    quarantined: decisions.filter((row) => row.action === 'quarantine').length,
  };
}
