# Layantara across the two myUNO applications — 2026-10-21

## Explicit application identity

The owner confirmed on 2026-10-21 that these are two independent applications.
Both must represent the same 39 physical villas and the same published accommodation tariffs.
This decision supersedes older wording that treats Final only as a disposable donor.

| Application | Repository | Data project |
| --- | --- | --- |
| myUNO App (React/Vite) | pavel949/myuno | erfwtoavipwjqmylpizt; Lovable dcc2b024-7627-4ad9-a915-a3df3dd839f0 |
| myUNO Final (Next.js/Prisma) | pavel949/myUNO-final | burcnghheyzbzffzgmjz |
| Resort source | Layantara OS | omwoglpcwaiflaprgrne |

A repo name, route or database status never establishes which commit/domain is deployed.
Always state repository, target data project, application SHA, source snapshot and publication status.
Never deploy a change to the other application by assuming the shared product name identifies it.
Catalogue parity does not grant two independent writers authority to sell the same nights.

## Verified source and target

Final's live database contains project
`layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de`,
slug `layantara-villas`, 39 live units, eight live InventoryCategories,
39 active short_term_stay offerings and 39 active long_term_rental offerings.
Each category has five daily and four long-term tariff rows (72 rows total).
Active offering terms use canonical_tariff_grid_v1 with tax/policy verification.
The old five-category `layantara.seed.ts` is historical demo data, not this catalogue.

App initially contained only project
`e15e9df0-b6b3-4f7f-a44d-f8683d1f9933`, no linked villas, no room categories,
and no plans/seasons. The 2026-10-21 calendar-editor release did not import Lantara.

The authorized catalogue correction now stores:
- The same project name, slug, 39-villa count, address and coordinates; physical project status completed.
- One inactive resort parent in properties and 39 inactive child villas, linked to the existing project.
- Eight inactive property_room_categories.
- Exact daily/monthly/annual source rows in each villa's private notes as import evidence;
  human-readable tariff schedules in category/villa descriptions.
- Source identity crosswalk with deterministic UUIDs: md5('myuno:' + source id)::uuid.
  Parent: md5('myuno:layantara:resort')::uuid.

Post-write readback compared every villa identity, category mapping, base amount,
all source tariff amounts, date windows, units and inclusions. All 39 matched.
Bath count zero in source is treated as unknown (NULL), not zero facilities.
No owner or company assignment is inferred from a project creator.

## Explicit remaining work: NOT production tariff activation

The imported raw rows are evidence, not a newly introduced pricing authority.
App's hotelQuote currently handles nightly seasons/date overrides, not Final's
30-night blocks or annual lease-request semantics. No property_rate_seasons or
rate plans were activated. Descriptions/notes are not the quote engine.

Before publication:
1. Extend the existing canonical App quote seam and server checkout together:
   nightly vs 30_nights vs monthly rent under a 12-month lease; source booking
   policy, deposits, taxes/service/breakfast, min stay and crossover seasons.
2. Prove parity for all eight categories, both stay modes, season boundaries,
   leap February, minimum stays and annual lease requests in isolated tests.
3. Reconcile occupancy/blocks and explicitly govern which app accepts bookings.
   Empty target availability is not proof of vacancy.
4. Set verified operating authority/ownership as required; never infer it.
5. Verify actual public projections, interfaces and deployed SHA, then activate
   approved rows/public_listing_enabled/landing_enabled as a separate controlled release.

The catalogue is therefore present in App administration as pending/inactive.
Public listing and landing remain disabled. Do not describe this as guest quote
or booking parity, published inventory or a completed public rollout.

## Rollback

No schema, RLS, reservation, payment, ledger or operating authority was changed.
Keep the inactive catalogue as evidence unless a reviewed cleanup is needed.
Any cleanup must first verify matching import marker, all rows still inactive,
no bookings/blocks/activity/new dependencies and no intervening edits; remove
only exact imported IDs, children before categories/parent. Restore only the
specific project metadata before-images, not an entire production backup.
Do not replay the import to reset later operator edits.
