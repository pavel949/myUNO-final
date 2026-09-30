# Project Space: Layantara parity and reusable development template

Date: 2026-09-30. Branch: `release/myuno-integrated-139-144-159` / PR #160.
This is an implementation/evidence ledger, NOT production acceptance.

## Canonical reusable contract

- Physical inventory: existing `Project → InventoryCategory → Unit`. A category is **2BR Superior**; a physical home is **Villa A10**. Existing 8/39 Layantara mapping and distinct G1–G5 / G6–G7 / G8 remain unchanged.
- Public template: `/projects/[slug]` + `ProjectEditorialSections`; owner/manager intake belongs to the same Project ID. The component reads `project.<slug>.editorial.*`, and area copy from the shared `Area.descriptionKey`.
- Category copy: `categoryEditorialKeys` reads source-provenance imported keys for Layantara; all new projects use `project.<slug>.category.<categoryKey>.title/description`. Canonical category name is displayed separately from the marketing title, not used as a physical unit name.
- Source media remain individual `MediaAsset` references. Project-level gallery may reuse the same asset without altering `UnitMedia`, source unit identity, or commercial offerings. Category representative media require the destination gallery migration and truthful category scope. Never label one villa's photograph as a different exact villa.
- Area copy is reusable for Legendary, Serenity and others in the same Area; verified property coordinates remain independent per Project.
- Sellability uses existing project/category/unit/CommercialOffering, source booking authority and quote gates. Editorial copy or project photos **cannot** activate bookings.

## Live connected database verification and transfer

| Domain | Verified state / action |
|---|---|
| Source inventory | 39 physical villas, 8 categories; all 39 source identity mappings and category assignment in target |
| Project `layantara-villas` | Existing draft Project; no second project was created |
| Source exact-unit media | 67 rows across five actual units: G5, G6, G7, G8, V2; 34 others have no exact-unit coverage |
| Project gallery | 67 existing source-backed MediaAssets linked through ProjectMedia; G8 existing image set as draft project cover; individual UnitMedia untouched |
| Editorial | 17 keys in EN/RU (34 new target translation rows); importer preserves existing translations and marks new copy needs_review |
| Category descriptions | Existing eight category source descriptions in EN/RU/TH retained, rendered by shared public page and private preview |
| Category marketing titles | 8 × EN/RU/TH = 24 published-source title translations imported to existing content registry |
| Layan area | One shared Area.descriptionKey with EN/RU/TH; reusable by other projects |
| Location | Project coordinates remain unverified 0,0. Public rendering refuses that geo and uses address search rather than claiming precise map pin |
| Private preview | /app/admin/projects/[id]/preview: scoped to platform admin, reads actual draft canonical categories/units/galleries and has no booking or payment controls |
| Public sellability | Still draft and source-controlled; not activated |
| Payment/booking authority | Untouched; LayantaraOS remains current writer |

**Media provenance warning:** all 67 URLs continue to resolve through LayantaraOS public storage; linking a MediaAsset is NOT byte migration or independent backup. Source guest-media has eight published *static-page* image references, some sharing the same base image with a query-string category label. They have not been mistaken for eight independent verified physical-villa image sets.

## Required sign-off before public release

1. Exact-head lint/typecheck/tests/build and database migration replay/drift. Current live database lacks new inventory-category gallery/physical structure schema.
2. Verify each source image byte and destination storage copy or explicitly accept the source-owned dependency; attach category-specific representative galleries with honest source provenance. Do not use another unit's exact-unit photo as a unit's own.
3. Confirm approved project/area map pin (not 0,0), management claims, licence wording and editorial copy in EN/RU/TH.
4. Verify all 31 pending exact-unit specifications, import approved rate/term policies and run source/target quote Golden Master.
5. Final source occupancy delta and one-writer cutover before exposing booking actions. Maintain every protective block until matched to an accepted canonical record.
6. Complete mobile/desktop authenticated preview and public role/browser E2E on actual deployment SHA.

The editorial template is reusable now; project portal public activation, complete category image parity, independently stored media and live booking acceptance are not falsely represented as complete.
