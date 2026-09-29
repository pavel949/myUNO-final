# Layantara cutover: independently refreshed live preflight

**Date:** 2026-09-29, read-only queries against the connected live Layan Tara OS and MyUno-final PostgreSQL databases. No source or target writes, schema application, import, status change, booking creation, or deploy occurred. This file is a *point-in-time* supplement to `LAYANTARA_LIVE_RECONCILIATION_2026-09-29.md`, not permission to activate the project.

## Verified inventory and source occupancy

| Invariant | Read-only evidence | Disposition |
|---|---|---|
| Source physical units | 39 `villa_master_crosswalk` | Staged physical identity; not proof of complete specifications |
| Source categories and category rate rows | 8 `villa_categories`, 72 `category_rates` | Distinct identity coverage, not independently approved payable tariff |
| Source media | 67 `villa_media` rows for **5** physical units; `category_media` = 0 | 34 units lack exact-unit source photos; neither byte transfer nor source independence verified |
| Source physical specs | 8 confirmed, **31 pending** in `villa_master_crosswalk.specification_verification_status` | Fail closed |
| Source reservation-block feed | 95 total: **82 confirmed, 1 pending, 12 cancelled** | 83 non-cancelled source rows, not 95 active restrictions |
| Source future feed (checkout after 2026-09-29) | 69 confirmed, 1 pending, **11 cancelled** | Do not create restrictions from the 11 cancellations |
| Target resort | `layantara-villas` draft; 39 draft Unit / 8 draft InventoryCategory | None is publicly sellable |
| Target media | 67 media links, exact-unit covers on 5 units | The linked source URLs are not independently verified target-owned bytes |
| Target protective occupancy | 83 `ota_import` blocks, all 83 `external_ref` non-null and distinct, plus 1 `owner_hold` | 84 blocks in total; 70 future target blocks; point-in-time rowwise comparison **84/84 exact** across source ID, unit, dates and reason; **not** 95 imported bookings |
| Target commercial offers | 39 draft `short_term_stay` + 39 draft `long_term_rental`; zero `taxPolicyVerified=true` | Do not activate rates/offerings |
| Target Booking | 0 canonical bookings | Protective blocks are not booking/payment/guest records |
| Current writer | `external_system(system_key='layantara_os', environment='source-live')` has `bookingAuthority='source'`, `cutoverVerified=false`, `mode='read_only'` | The source remains booking authority; leave protective blocks intact |
| Target schema | None of `inventory_category_media`, `project_structure_node`, `property_deal` currently exists | #144 migrations have not been applied to live target |

### What the apparent “95 vs 84” discrepancy means

`source_reservation_blocks` has **95** entries but includes **12 cancelled** rows. Its **83** non-cancelled entries correspond to the **83** target imported protective blocks in aggregate; the 84th target record is a separate owner hold. The source feed is not the only occupancy source. A subsequent **read-only, rowwise** comparison used the source `operational_occupancies` active rows, target `blocked_date.external_ref='layantara:occupancy:<source id>'`, and the authoritative source-inventory-ID → target Unit mapping in `external_mapping`. The result was **84/84 exact matches** for source ID, physical unit, check-in, exclusive checkout and reason (`imported_reservation` → `ota_import`, `owner_stay` → `owner_hold`); zero unmatched, date, unit or reason mismatches. This is a point-in-time, independently refreshed comparison, not an atomic cross-database snapshot. Re-run it and reconcile all new source deltas immediately before handover. Do not assume that the latest source feed, old workbook and other operational tables remain unchanged.

## Reproducible SQL — counts only; no PII

For the independent rowwise check, query `operational_occupancies` with `state='active'` and return only `id`, `inventory_id`, `occupancy_kind`, `check_in`, `check_out`; query target `blocked_date` with `external_ref LIKE 'layantara:occupancy:%'` and target `external_mapping` with `system_key='layantara_os'` and `entity_type='unit'`. Compare the source UUID encoded in each target `external_ref`, mapped physical unit, check-in, exclusive checkout, and owner/import reason. Do not export guest names, source payloads or payment details. This comparison was performed read-only and returned all 84 exact matches.

Source:
```sql
select status, count(*) as rows,
       count(*) filter (where check_out > date '2026-09-29') as future_rows
from public.source_reservation_blocks
group by status order by status;

select specification_verification_status, count(*)
from public.villa_master_crosswalk group by 1 order by 1;
select count(*) photo_rows, count(distinct inventory_id) units_with_photos
from public.villa_media;
```

Target:
```sql
select u.status, count(*) physical_units,
       count(*) filter(where u.base_nightly_thb > 0) priced_units,
       count(*) filter(where u.cover_media_id is not null) units_with_covers
from public.unit u join public.project p on p.id=u.project_id
where p.slug='layantara-villas' group by u.status;

select reason, count(*),
       count(*) filter(where end_date > date '2026-09-29') as future
from public.blocked_date group by reason;
select count(*) total, count(*) filter(where external_ref is not null) with_external_ref,
       count(distinct external_ref) distinct_external_refs
from public.blocked_date where reason='ota_import';
select offering_type,status,count(*),
       count(*) filter(where pricing_terms->>'taxPolicyVerified'='true') verified
from public.commercial_offering o join public.project p on p.id=o.project_id
where p.slug='layantara-villas' group by 1,2;
select system_key, environment, config->>'bookingAuthority' writer,
       config->>'cutoverVerified' verified
from public.external_system where system_key='layantara_os';
```

## Release gates and cutover decision

**NO-GO for live activation as observed.** Merge/code integration is separate from deployment, migration application, data acceptance and source-writer cutover. Require exact-HEAD green CI, clean migration replay/drift and role/browser smoke for #144; isolated restore/rollback proof; authorized confirmation of 31 missing physical specifications, verified location and gallery policy; source-independent bytes or an explicit source-media service dependency; tariff Golden Master plus tax/booking-policy approval; fresh *rowwise* source ID/unit/half-open date reconciliation and final source delta; Booking/Payment/owner/agent operational acceptance; actual OTA ARI acknowledgement if OTA is activated. Source writer must be frozen only during a coordinated, signed one-writer switch. Releasing code or applying additive schema migrations alone must not set bookingAuthority to myUNO.

No usernames, guest identity, payment records, passport data, secrets, or full media URLs are included here.
