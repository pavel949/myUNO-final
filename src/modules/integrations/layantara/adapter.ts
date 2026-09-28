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
  expires_at?: string | null;
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
    imported_reservation: 'ota_import', owner_stay: 'owner_hold', 
  };
  const blockReason = reasons[source.occupancy_kind];
  // A hold must have a valid, live expiry before it can reduce available inventory.
  if (source.occupancy_kind === 'provisional_hold') {
    if (!source.expires_at || !Number.isFinite(Date.parse(source.expires_at))) {
      return { action: 'quarantine', id: source.id, reason: 'hold_expiry_unverified' };
    }
    if (Date.parse(source.expires_at) <= Date.now()) {
      return { action: 'archive', id: source.id, reason: 'expired_source_hold' };
    }
  }
  if (source.occupancy_kind === 'provisional_hold') {
    return { action: 'quarantine', id: source.id, reason: 'expiring_hold_requires_canonical_hold' };
  }
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
  const conflicts = new Set<string>();
  const protectedRows = decisions.filter((row): row is Extract<ReconciliationDecision, {action:'protect'}> => row.action === 'protect');
  const byUnit = new Map<string, typeof protectedRows>();
  for (const row of protectedRows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }
  for (const [unitId, list] of byUnit) {
    list.sort((a,b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
    for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
      if (list[j].startDate >= list[i].endDate) break;
      if (list[i].startDate < list[j].endDate) {
        const a=list[i], b=list[j];
        if (a.startDate===b.startDate && a.endDate===b.endDate) conflicts.add(unitId+':'+a.startDate+':'+a.endDate);
        else conflicts.add(unitId+':'+a.id+'<>'+b.id);
      }
    }
  }
  return {
    decisions, conflicts: [...conflicts],
    protected: protectedRows.length,
    archived: decisions.filter((row) => row.action === 'archive').length,
    quarantined: decisions.filter((row) => row.action === 'quarantine').length,
  };
}
