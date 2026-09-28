# Layantara → myUNO consolidation: executable baseline and release gates

## Scope of this change

This change supplies a role-scoped operational calendar board on top of **existing myUNO Booking + BlockedDate + canonical Unit**. It also introduces a pure, non-destructive source occupancy classifier with tests. It does **not** copy financial records, run migrations against live databases, flip any write routing, or claim OTA push integration. Existing source and target keep their current behavior until cutover is signed off.

## Verified live inventory baseline (2026-09-28)

| Inventory | Layantara | myUNO |
|---|---:|---:|
| Physical units | 39 operational units | 5 units |
| Current canonical reservations | 0 operational reservations | 0 bookings |
| Historical reservations | 7 | — |
| Occupancy records | 100 | — |
| Source blocks | 95 | — |

Source occupancy breakdown: 83 active imported reservations, 12 cancelled imports, 1 active owner stay, 2 released reservations, 2 expired/released provisional holds. 70 active imported reservations have a future checkout at the time of audit. No two active occupancy records overlap on the same physical inventory interval in the verified snapshot. Of 39 physical units, 8 have confirmed physical, category and specification verification; 31 have **pending specification verification**. Source blocks are 82 confirmed, 1 pending, 12 cancelled.

**Never derive active inventory solely from operational_reservations**, which is empty in the observed source environment. The operational_occupancies ledger is necessary.

## Non-destructive mapping contract

1. Register Layantara in existing myUNO external_system with environment namespace. Preserve external_mapping of project/category/unit and occupancy IDs. Never use raw source UUID as canonical identity without explicit verification.
2. Map exact operational_inventory unit codes to existing or new Unit records. Project and InventoryCategory must be consistent. A missing mapping is **quarantined**, not assigned to a random unit.
3. Extract active operational_occupancies as a source snapshot, including source id, unit id, half-open check-in/check-out, kind, state, full source financial evidence, and source version. Use the pure adapter in src/modules/integrations/layantara/adapter.ts to classify records.
4. Import active imported reservations as **protective BlockedDate** with reason ota_import and stable externalRef layantara:occupancy:<uuid> as a temporary migration protection only. Owner stays use owner_hold. Do not create fabricated Booking or Payment records from occupancy metadata. Cancelled/released rows are archived, not availability blockers.
5. Reconcile individual source reservations, guest identity, currency and financial balances separately. After verified canonical Booking and Payment/ledger import, replace the corresponding protective block in one serialized transaction with a stable crosswalk; never leave a period unprotected between operations.
6. Preserve original currency and amount evidence. Target money is satang integers for THB; no currency conversion or approximate rounding allowed without a documented financial snapshot.
7. Reconcile task/housekeeping/maintenance references to canonical booking and unit IDs; roles must be explicitly mapped before provisioning access.
8. The source and target are different Next.js / React major versions; do not copy Layantara frontend into myUNO. Migrate domain behavior through compatibility adapters and reuse the myUNO UI tokens.

### Write authority

- **Before cutover:** LayantaraOS remains the sole authoritative source for its 39 villas. myUNO reads staged data but must not open those villas for sale.
- **During cutover:** freeze source writes; replay and reconcile delta; reject conflicting occupancy or financial data; preserve source backups.
- **After cutover:** myUNO is the single booking writer and the connected OTA/channel manager becomes distribution only. Layantara remains read-only.
- **Rollback:** retain all post-cutover events and transactions before restoring any source write authority. A snapshot rollback alone is not safe.

## Calendar acceptance

- Authenticated admin/staff can see only authorized projects; unauthorized access redirects away.
- Full property, category and physical-unit filters preserve URL date/range.
- One grid projects live booking statuses, valid holds and blocked dates. It does not create another availability table.
- Non-binding requested bookings display without reducing sellable inventory.
- Expired holds do not display as live.
- Half-open checkout allows a new guest on the same checkout date.
- Imported protective blocks appear and prevent new direct bookings through the canonical availability service.
- A manual block/booking is reflected after a fresh query; board polls at 15 seconds as a fallback and responds to in-tab refresh events. **This is not yet sub-second push / Supabase Realtime.**
- Conflicting active blockers are surfaced as errors rather than hidden by the top-most reservation color.

## Gate before any live writes

- Resolve/approve all 31 pending physical-specification records, or explicitly quarantine those units from sale while still protecting their dates.
- Demonstrate 39/39 unit identity mapping and 100/100 occupancy disposition with no unexplained exclusions.
- Reconcile all 82 confirmed source blocks and the pending source block against occupancy data without double counting.
- Reconcile 7 legacy bookings, 6 legacy payments, currency, guest identity, deposits and financial ledger. Never infer that the empty operational tables mean those records do not exist.
- Verify all 70 observed future active imported reservations remain unavailable to competing requests, including concurrent direct and agent booking attempts.
- Run RLS/role matrix, calendar/booking/payment/stay lifecycle, owner/agent isolation and backup restore tests in isolated staging.
- Record source snapshot checksum, target counts, crosswalk, CI SHA and post-cutover recovery procedure.
- Do not merge this branch or deploy it against production if any gate fails.
