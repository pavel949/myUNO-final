# P2 product-design closure — 2026-10-03

## Scope

This release closes the three remaining P2/optional capabilities from
`docs/audits/DESIGN_SYSTEM_GAP_CLOSURE_2026-10-01.md` without duplicating
property, booking, pricing, CRM, finance or media storage.

## 1. Governed Research & Index publication

Implemented as a governed publishing workflow rather than a decorative market-data page.

- `ResearchPublication` — destination + locale scoped publication record.
- `ResearchSource` — numbered source register.
- `ResearchCorrection` — public append-only correction log.
- author and reviewer are different identities; DB and service enforce independence.
- sources are required before review and frozen when review starts.
- content is frozen when review starts.
- publication requires reviewed status, a reviewer and at least one source.
- corrections cannot be updated or deleted.
- public `/research` and `/research/[slug]` show only published records.
- admin `/app/admin/research` exposes draft → review → publish/retract and correction workflows.
- no market figures are seeded or invented by the release.

## 2. Video Library

Video reuses the existing canonical `MediaAsset` storage seam.

- `MediaAssetKind.video` supports direct-play MP4/WebM.
- video upload requires configured blob storage; the data-URI fallback is deliberately disabled.
- `VideoPublication` stores publication metadata, locale, provenance, recorded date and optional scope.
- publication requires provenance.
- scope IDs are validated against canonical Area / Project / Unit records.
- public `/videos` reads only published, non-encrypted canonical media.
- admin `/app/admin/videos` uploads and publishes the same MediaAsset record.
- CSP explicitly permits governed HTTPS/blob media playback.
- no second media/storage model and no fabricated transcoding capability.

## 3. Country-desk localization model

Global desks are now part of `DestinationConfig`.

Each desk declares:
- slug and market code;
- supported/default locales;
- source markets;
- localized content keys.

`src/modules/global-desks.ts` is now a compatibility projection over the active
destination configuration. Desk routes still enter the same canonical property,
booking and services engines; they never own inventory, pricing or a separate CRM.

## Governance / integrity

- Research and Video are publication projections, not canonical property writers.
- Destination desks are localization/routing configuration, not market-specific databases.
- No public research rows or videos are seeded as factual content.
- Existing identity, property, booking, pricing, service and finance invariants are unchanged.

## Legacy “P2” reconciliation

Older `PHASE1_IMPLEMENTATION_PLAN.md` used “P2” for a separate architecture backlog.
Several of those items have since shipped under canonical equivalents:
`OwnershipPeriod`, `InventoryCategory`, `ProjectStructureNode`,
`SleepingSpace/Bed`, `RatePlan`, set-based category availability, ChannelMapping
and real iCal fetch/parse/sync.

That historical list is not silently re-labelled as complete here. In particular,
multi-unit `BookingItem`, accounting-policy migration to double-entry and Q37's
management-revenue authority are separate core-domain changes. Q37 explicitly
requires a founder accounting ruling; this product-design release does not invent one.

## Verification contract

Required before merge:
- migration reproducibility and zero drift;
- research governance integration tests;
- video publication integration tests;
- destination/desk configuration tests;
- content-key seed guard;
- reachability/admin-nav guards;
- lint, full tests, typecheck and production build.
