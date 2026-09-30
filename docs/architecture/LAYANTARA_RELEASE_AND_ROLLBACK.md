# Layantara → myUNO: evidence-based release and rollback runbook

**Status:** staged code only. Nothing in this document authorizes live cutover by itself.
**Scope:** existing myUNO main database and Layantara source database; no public custom domain needed. The signed HTTPS endpoint can use a stable deployment hostname that accepts service-to-service requests.

## Baseline observed on 28 September 2026 (recount at execution time)

- Source: 39 active operational_inventory records, 8 villa categories (31 operational_verified plus 8 fully verified specifications).
- Source: 100 operational_occupancies, including 83 active imported reservations, 12 cancelled imports and one active owner stay.
- Future active source occupancy: 70 records on 31 units, from 2026-10-22 through 2027-04-13; the inspected source contains zero active future overlapping pairs.
- Source: 7 legacy reservations and 6 legacy payments; operational_reservations and operational_payments have zero records. Do **not** call 7/6 the total confirmed money position until the imported workbook and source finance are reconciled.
- Target: existing seeded non-Layantara properties; external_system and external_mapping zero, canonical booking zero. Source delivery and target domain-event outbox **not yet deployed** at audit.
- All counts are snapshot evidence, not permanent assertions. Capture a new snapshot and hashes immediately before any import.

## Authority contract: never two live writers

| Phase | Source | Target | Required flags |
|---|---|---|---|
| Dark deploy | Only booking writer | Existing non-Layantara writers unchanged | Both intake flags false; source bridge false |
| Protective import | Still sole Layantara booking writer | Only verified mapped BlockedDate protection; Layantara units draft/paused | Source bridge true, target protection flag true, booking flag false, external_system config protectionEnabled true, bookingAuthority source, cutoverVerified false |
| Reconciliation | Frozen for affected inventory only after independently verified source snapshot | Compare every source occupancy, guest, rate and financial record; no public sales | Booking flag false; Layantara units still draft/paused |
| Cutover | Source channel booking endpoints demonstrably read-only; stop legacy scheduled writers | Single canonical booking, payments and ledger; enable only reconciled/sellable units | DB config bookingAuthority myuno AND cutoverVerified true, booking flag true; source bridge reconfigured or disabled |
| Rollback | Do not simply resume its stale calendar | Freeze new sales, export all post-cutover writes, reconcile both sides, resolve pending payments and OTA messages | Disable both writers during reconciliation; restore one authority only after verified delta replay |

## Stage 0 — prerequisite artifacts and backups

1. Independently export the original source and target databases; prove an isolated restore, keep immutable snapshots and snapshot UTC timestamp.
2. Preserve source operational_inventory, villa_categories, category_rates/rate plans, source_reservation_blocks, operational_occupancies, legacy reservations/payments, owner records and storage assets with manifests. Protect guest identifiers under normal access controls.
3. Record source counts, 100/100 disposition and 39/39 physical crosswalk. Each crosswalk entry must include source inventory ID, exact unit code, category code, destination project/category/unit ID, physical evidence, reviewer and verification date. Never infer a source UUID equals a target ID.
4. Confirm source inventory currently free of overlapping future active entries. If not, resolve conflicts before any sellable release.
5. Require explicit operator acceptance of the eight G-category villa specifications (the 31 operational-verified records have not all passed the full spec review). Preserve G1–G5, G6–G7 and G8 as distinct canonical categories.

## Stage 1 — dark schema and UI deployment

1. Review target PR #134 and source PR #115; migrate only after isolated migration replay and drift checks are green.
2. Deploy code with UNIFIED_BOOKING_INTAKE_ENABLED=false, LAYANTARA_PROTECTION_INTAKE_ENABLED=false and LAYANTARA_BRIDGE_ENABLED=false. Do not add a publicly sellable Layantara unit.
3. Check /api/health?strict=1, staff admin navigation, calendar read-only behavior, role isolation, and deployment SHA. No custom domain required.
4. Verify new target outbox exists, has RLS enabled and no anon/authenticated privileges, source delivery table service-role only. Verify source/target backups remain restorable.

## Stage 2 — stage verified inventory and occupancy

1. Create one Layantara project and the eight canonical categories plus distinct physical Unit records, all **draft or paused**. Import names/locations/canonical rates/media only from verified evidence; unresolved values stay visibly pending. Do not copy staff privileges.
2. Register source external_system in the target with environment exact (staging or production). Map all 39 physical source IDs to the right destination unit IDs; metadata.verified is true only for inspected identity matches, not guessed rows.
3. Set target protectionEnabled=true, bookingAuthority=source, cutoverVerified=false; turn on only LAYANTARA_PROTECTION_INTAKE_ENABLED. Configure the same 32+ byte HMAC secret on both server deployments. Configure source relay service-role key on server only. Keep booking flag false.
4. Replay protective events for current active source imported occupancies. For every active future source interval, verify one target protective block with the same source ID, unit ID and exact [check-in, checkout) dates. Idempotent retries may create zero new rows. Expired/cancelled/released intervals must not block future nights.
5. Verify 70/70 future source occupancies are protected and zero target unverified mappings, unmatched blocks, unexplained overlaps, accidentally live units or inconsistent G6/G7/G8 categories. Check source delta again immediately before accepting the count.
6. Quarantined events are not success. Any unverified unit mapping, changed source interval, identity mismatch or block conflict blocks activation for the affected unit. Never suppress or overwrite a conflicting source record.

## Stage 3 — reconcile bookings and finance before opening sales

1. Preserve all original imported workbook snapshots, booking terms, channel references, guest and owner identities; dedupe with stable source IDs, not name/date similarity.
2. Reconcile legacy 7 reservations/6 payments, imported source reservation blocks and relevant booking/financial evidence. Separate OTA-collected guest charges from **funds actually received by operator**; a booking confirmation never creates a payment.
3. For each financially verified booking, preserve original sold amount, THB denomination and policy snapshot. Subsequent date/price changes become append-only BookingChange and financial adjustments. Refunds can only reference a succeeded payment and cannot exceed the refundable balance.
4. Move a matching protective block into one canonical Booking **inside one serialized transaction**, never delete the protection first and later attempt booking creation. Unmatched imported occupancy remains blocked until resolved.
5. Verify source/target unit-night equality, booking count, guest references and financial ledger line by line, including owner stays, cancellations, deposits and agency attribution.

## Stage 4 — full acceptance and controlled cutover

1. In isolated staging, test each role (admin, staff, front office, owner, MC, agent, guest) for project isolation and a complete property → rate → enquiry → hold → approval → verified payment → check-in → in-house → checkout → refund/owner statement lifecycle.
2. Race direct checkout against source protective import; only one side may claim a night. Test signed webhook invalid/replay/stale/collision, currency and satang boundary, partial payment, double booking, expiry, modified date and cancellation. Run restore drill.
3. Freeze source booking writes and all old outbound channel sync; capture a last delta and compare checksums/booking counts/financial balances. Demonstrate channel manager ARI push/ack separately before any OTA sales.
4. Only after evidence and sign-off: target DB config bookingAuthority=myuno, cutoverVerified=true; target UNIFIED_BOOKING_INTAKE_ENABLED=true. Release only individually reconciled/sellable units, then let myUNO become the master calendar. Ensure source cannot still accept any reservation.
5. Monitor conflicts, 409 quarantines, post-cutover outbox, payment/refund ledger, source booking writes, OTA ack and booking funnel. Any divergence suspends sales for affected inventory.

## Fail-safe rollback

Do not restore an old snapshot directly over newer bookings, funds or guest data. Disable public booking intake, pause distribution and source relay, preserve target outbox and payment/provider events, export new bookings and settlement deltas, reconcile into the recovery writer, replay or compensate changes, and only then reauthorize exactly one booking writer. Test restoring an isolated copy of both databases and documented source/target credential rotation. Keep both original snapshots and recovery evidence.

## Verifiable release record

Record reviewer, UTC timestamp, two branch/merge SHAs, exact deployments, snapshots/checksums, 39/39 mappings, 100/100 source occupancy disposition, 70/70 future protection (or latest updated count), no double bookings, zero unresolved money mismatch, passing role matrix, webhook replay tests, successful restore, confirmed OTA ARI and single-writer evidence. No single green build substitutes for this record.
