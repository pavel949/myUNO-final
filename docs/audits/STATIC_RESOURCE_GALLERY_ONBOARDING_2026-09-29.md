# Static resource migration and gallery/onboarding audit — 2026-09-29

## Delivery and safety boundary
Branch `feat/resource-profile-gallery-editor-20260929` / PR #141 targets the consolidated Layantara release branch #139, NOT production. This package is `definitions_only`: no booking, guest/staff roster, occupancy, hold, payment, historical finance, ledger, operational task or price-change events can enter the export. It does NOT delete such records from either live system. The existing source snapshots remain untouched as separate private audit evidence.

### Resource exporter
`scripts/layantara-resource-profile.ts` reads only an explicit list of private, checksum-audited source tables and explicit columns. It rejects novel pricing fields (so an unrecognized rule cannot silently disappear) and nested operational/PII keys. Output file is created exclusively, mode 0600. Its manifest declares draft status and `tariffParity=requires_source_engine_golden_master`. The script performs zero writes to either DB. It does not claim same-price parity merely from identical tariff row counts.

Source facts: 39 operational inventory units, 8 categories, 24 EN/RU/TH category-content rows, 72 category rates, 67 villa-media rows, 84 active protective occupancies. Only **five** actual source units have those 67 photos. No photographic coverage is fabricated for the other 34 units. Unit-type gallery assets are optional and require actual representative images rather than silently copying an unrelated villa's photos.

## Unified presentation model

| Scope | What guest sees | Admin edit target | Data storage |
| --- | --- | --- | --- |
| Project (resort/hotel/condo building) | Property facade, grounds, lobby and shared facilities | Property gallery | ProjectMedia + Project.coverMediaId |
| Category (room type/villa type) | Representative type photos, bedroom arrangement and layout | Category gallery | InventoryCategoryMedia + InventoryCategory.coverMediaId |
| Individual unit (specific villa/condo) | Exact unit, floor, view, fitout and distinguishing facts | Unit gallery | UnitMedia + Unit.coverMediaId |

MediaAsset holds the physical blob once. Gallery joins hold independent order; cover must belong to its gallery. Delete from gallery unlinks, never removes shared MediaAsset or affects the other presentation layers.

Public cards prioritize exact unit cover, then its first gallery photo, then category representative cover. Actual unit detail only exposes its own ordered gallery (never falsely labels a representative category image as the exact unit). Category cards expose their separate ordered category gallery.

Hotel rooms can satisfy the photo readiness check with three type photos and a type cover. Standalone condos/private villas need their exact-unit gallery; the same physical Unit can have multiple offerings (sale/monthly/nightly), with no parallel listing property record.

## Onboarding interaction
Project wizard step 7 now has a single scoped gallery editor: choose project / category / physical unit; upload multiple JPEG/PNG/WebP images; preview and set cover; reorder with keyboard-operable buttons; detach; receive save/error status. A direct link can select a specific unit or category. The editor uses the same admin APIs and MediaAsset storage seam used elsewhere. No upload redefines booking/finance data or turns a draft object live.

## Correctness gates
- Independent `npm ci`, Prisma generate/migration replay and drift, lint/typecheck, route/UI/API tests, production build on PR HEAD.
- Category gallery API: foreign covers and incomplete/repeated orders rejected; first image becomes cover; detaching promotes next image and retains shared bytes.
- Project/unit gallery API: same membership checks and safe unlink.
- Draft project and unit remain hidden from public surfaces; media upload cannot activate an offering.
- Real media rehosting uses SHA-256 source/target byte verification before source storage retirement.
- Source nightly quote v5 and booking-request v2 perform UTC [check-in, check-out) iteration, nightly override then villa base fallback, maximum min-night constraint, and reject closed dates. Source seasonal/monthly/category and channel rate-grid logic is separately versioned; exact equivalence requires a Golden Master from the currently authoritative source engine, not a guessed formula.
- Real source operational/financial liabilities remain in the existing source/archive; this static-only package carries none.

## Known remaining limitations
1. No production migration executed for category_gallery; PR #141 requires clean isolated migration replay, RLS/data-API review and merge approval.
2. Category gallery is currently initially empty for Layantara because source category_media has zero records; manual category-photo curation is necessary.
3. Source physical media covers five of 39 villas; file rehost and missing-unit content approval remain separate.
4. The static exporter is a reproducible runnable script, not a claim that its output was generated or that the original runtime seasonal tariff formulas were all proven equivalent.
5. Existing wizard steps outside media still require a broader UX rewrite (per-field saves, drafts, rich previews, mobile flow). This work addresses scoped media authoring and its underlying schema, not a complete Airbnb clone.
