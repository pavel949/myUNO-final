# Layantara live preflight — 2026-09-30 (read-only)

This is a refreshed non-PII verification against the connected, active source and target Supabase databases. It is **not a cutover authorization**. No live database write, inventory activation, migration, storage byte copy, deployment or booking-writer switch was performed.

## Verified now
- Source `villa_master_crosswalk`: 8 confirmed physical specifications, 31 pending.
- Source `villa_media`: 67 photo metadata records covering 5 physical villas. The other 34 villas have no exact-unit photo coverage in that table.
- Source `source_reservation_blocks`: 82 confirmed, 1 pending, 12 cancelled; 69 confirmed + 1 pending + 11 cancelled with future checkout at query time.
- Target `layantara-villas`: draft Project, 39 linked physical Units, only 5 with cover.
- Target protective blocks: 83 `ota_import` and 1 `owner_hold`.
- Target external authority: `layantara_os` bookingAuthority=`source`, cutoverVerified=`false`.
- Target schema: `inventory_category_media`, `project_structure_node`, `property_deal` absent from live database.
- Rowwise read-only fresh comparison of source active `operational_occupancies` versus target `blocked_date.external_ref` through target `external_mapping`: 84 source active, 84 target protective, 39 physical mapping rows; missing=0, extra=0, unit mismatch=0, date mismatch=0, reason mismatch=0. Comparison used only source occupancy IDs, physical IDs, half-open dates and reason, without guest or payment data. These are separate DB reads, not a frozen consistent cross-DB snapshot.

## Operational state
The existing 39/39 source-linked inventory, 8 categories, imported tariff definitions and protective blocks are a staged mirror. Source photos are URL/metadata links, not verified independently copied bytes. Protective blocks are not full Booking, Payment or guest ledger conversion. Tax/booking terms, missing 31 physical specifications, real gallery provenance, exact-head migrations/runtime acceptance and one-writer freeze remain incomplete.

**NO-GO for enabling myUNO booking authority today.** Do not remove 84 protections, set imported offerings live, or turn on target booking intake. Use `node scripts/layantara-cutover-gate.mjs <signed-evidence.json> <exact-deployed-sha>` as a mandatory *additional* fail-closed evidence check before the coordinated operational handover; passing a self-reported manifest alone never replaces independent evidence or the freeze.

## Transfer scope
Retain LayantaraOS independently for now. myUNO uses Project → InventoryCategory → Unit → CommercialOffering and Booking/BlockedDate, with project/category/exact-unit gallery scopes. Complete verified specifications, independent media bytes, tariff Golden Master, terms, team/compliance and ongoing booking/finance acceptance without inventing missing values. A separate historical archive may remain external if explicitly accepted, but future active occupancy must be fully protected and current accounting must be reconciled.
