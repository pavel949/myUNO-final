# Media readiness and Project Portal release note — 2026-10-04

## Scope

This release makes one canonical media system govern Project Space, category presentation, exact-unit listings and Stay discovery.

No listing/media shadow model is introduced. The physical asset remains `MediaAsset`; presentation order and cover remain scoped through `ProjectMedia`, `InventoryCategoryMedia` and `UnitMedia`.

## Public media contract

- Project gallery: project/common-area context.
- Category gallery: representative room/villa-type context.
- Unit gallery: exact physical home.
- Public gallery minimum: three valid non-encrypted JPEG/PNG/WebP photos plus a cover attached to that same gallery.
- Five or more photos is recommended.
- Private villas and condominiums require exact-unit media for the individual unit to be public.
- Hotel rooms may use a category gallery when the media is explicitly disclosed as representative room-type photography.
- A media-incomplete unit is excluded from Stay Search, public project/unit projections and sitemap and cannot be deep-linked around the gate.
- Category search/booking requires a ready representative category gallery.
- Broken storage assets are surfaced in the scoped admin gallery editor instead of being treated as visually ready.

## Admin workflow

`/app/admin/projects/[id]/media` is the single scoped editor. Operators choose Project, Category or Unit, upload multiple photos, set the cover, reorder and unlink. Readiness is shown in the editor.

Readiness blockers link directly to `?select=category:<id>` or `?select=unit:<id>` so the operator lands on the failing scope.

Project/category/unit gallery APIs now share the same cover membership/order rules and public-photo restrictions. Removing a photo unlinks the gallery relation only; shared MediaAsset bytes are not deleted.

## Production evidence checked

### Layan Tara Villas

Current canonical state remains draft and is intentionally not made public by this release.

- 39 physical units.
- 8 inventory categories; all are currently draft.
- 67 media links are present at project scope.
- The same 67 assets are also exact-unit media; there are currently no project-only/common-area assets.
- Exact-unit photo coverage currently exists for five villas: G5, G6, G7, G8 and V2.
- The remaining villas have no proven exact-unit gallery.
- All eight category galleries are currently empty.
- The 67 existing assets pass the public media metadata checks (photo, non-encrypted, supported mime type, non-empty storage key).

Consequences:
- Do not activate the resort merely because 67 files exist.
- Curate genuine project/common-area photography for the Project Portal.
- Curate representative category photography before category-selling flows are activated.
- Photograph or ingest approved exact-unit media for every villa that will be sold as a specific villa.
- Existing source-authority, tariff, compliance and operational readiness gates still apply separately.

### The Title Legendary

The canonical project is currently draft and remains intentionally non-public.

Current production record has no canonical units, categories or project media. The Project Portal cannot be considered ready until the real inventory (for example the managed exact units), project-level presentation media and commercial/canonical data are loaded and pass normal readiness.

The current stored slug is `thetitlelegendary`; naming/slug normalization should be performed as part of the canonical data completion, not by a public redirect that hides incomplete data.

### Existing sample live unit

The previously audited sample unit `LB-11 Lagoon View` is live in a legacy/untyped project but has no exact media and no cover. The new public media gate makes that state non-public until the gallery is corrected rather than rendering a blank booking listing.

## Project Portal behavior

A public Project Space still requires `Project.status = live`. Media readiness never upgrades a draft project.

Within a public project:
- Project gallery is rendered only from project-scoped presentation media.
- Stay availability appears only when media-ready stay inventory exists.
- Buy and long-term-rent entry points appear only when canonical commercial/legal eligibility returns verified exact-unit homes.
- Category cards are shown only when representative category media is ready.
- Unit cards contain only media-ready units.
- Hotel room representative media is labelled.
- Unit links preserve project context.
- Exact-unit and type-level media are never silently relabelled as one another.
- Sale and long-term-rent detail pages use the complete exact-unit gallery, not only a cover image.
- Condominium Project Space is presented as a general property portal rather than forced into resort-only wording/schema.

## Verification gates

Before merge/release:
1. media readiness unit tests;
2. search integration regression;
3. public unit-detail media regression;
4. canonical catalog → search → booking integration;
5. lint/typecheck/build;
6. browser verification of admin scoped gallery and public Project Space;
7. post-deploy verification that a media-incomplete live unit is absent from Search and returns no public Unit Detail;
8. verify draft Layan Tara Villas and The Title Legendary remain non-public until their data/readiness work is actually complete.
