# RECONCILIATION.md — Baseline Findings Reconciled to Current v3 Branch

Status values are authoritative for `feat/canonical-platform-v3` as of 2026-09-09. Revalidate after material schema/flow changes. `already fixed` means the current branch contains the intended correction; it does not by itself mean production release verification has passed.

| ID | Status | Finding | Current evidence / remaining work |
|---|---|---|---|
| **F01** | **still valid** | Service orders are project-context dependent; target requires standalone customer commerce. | `ServiceOrder.project_id` and `CreateServiceOrderInput.projectId` remain required. `POST /api/service-orders` still returns `no project context` when an authenticated customer has no booking/property scope. Canonical migration must make project context nullable without a synthetic “All Phuket” project. |
| **F02** | **still valid** | ServiceProject is too thin for property-specific commercial terms. | `ServiceProject` remains only `service_id + project_id`. Pricing/SLA/cancellation/collector/commission/effective-date overrides are not yet a complete canonical `PropertyServiceConfiguration`. |
| **F03** | **partially fixed** | Quantity handling risks conflating quantity, duration and participant count; quote needs a full versioned contract. | Canonical marketplace contract separates dimensions and quote versions; existing runtime still has generic `quantity` on `ServiceOrder`. Typed category inputs and immutable accepted `QuoteVersion` runtime remain. |
| **F04** | **already fixed** | Order closure/completion was not confirmed in baseline main. | v3 adds `fulfilled_at`, confirm/dispute deadline, explicit confirmation, scheduled auto-close and closed event contract. Public confirm seam uses transactional implementation. |
| **F05** | **already fixed** | Commission accrual and provider remittance must use the same accepted terms snapshot. | Fulfillment commission and remittance both use `take_rate_pct_snapshot`; regression coverage added. |
| **F06** | **already fixed** | Remittance eligibility must not depend on generic `updatedAt` or one narrow current status. | Provider remittance uses `fulfilled_at`, includes fulfilled/closed states and excludes undecided disputes. |
| **F07** | **already fixed** | Fulfillment state + earning creation must be atomic/idempotent. | `fulfilment-atomic.service` serializes accepted→fulfilled + commission ledger in one transaction and guards repeat fulfillment. |
| **F08** | **already fixed** | Dispute/ticket creation and acceptance window need atomic policy-aware handling. | Ticket+dispute creation is transactional; service-order row locking serializes confirm/dispute/close; DB trigger/advisory guard prevents duplicate subject disputes; invalid window config is rejected. |
| **F09** | **partially fixed** | Reschedule requires first-class workflow, not cancel-and-recreate. | Booking date modification now reprices through the booking engine, observes blocked dates and serializes capacity with advisory locking. However a positive price delta commits the new dates before the funding adjustment succeeds; the canonical replacement-hold → funding → commit → release-old workflow remains. |
| **F10** | **still valid** | Physical goods/SKU/stock/delivery model was absent in baseline. | Canonical model is specified; runtime SKU/stock movement/logistics should be added only when actual product supply is enabled. Do not create fictional inventory. |
| **F11** | **partially fixed** | Owner onboarding must support safe exact match, draft Party creation and invitation. | Owner email resolution is now exact via the unique `CITEXT` Identity email rather than fuzzy-first-result assignment. Existing `/api/admin/people/invite` + `/auth/claim` provide the canonical invite/claim pipeline. Unit onboarding still needs an inline create/invite handoff when no Identity exists and an end-to-end invite/login/owner-scope verification before this is complete. |
| **F12** | **still valid** | Legacy unit pricing fields and RatePlan have overlapping readers/writers. | Search/browse/public surfaces still read `Unit.baseNightlyThb` while canonical `RatePlan` also exists. Readiness accepts either sellable base price or active rate plan; a deliberate single-authority pricing cutover remains. |
| **F13** | **already fixed** | CRM summary metrics require formula/scope/naming correction. | v3 corrected active opportunity/weighted pipeline/win-rate definitions and retains satang basis. |
| **F14** | **already fixed** | CRM aggregates must be computed before pagination over permitted scope. | Pipeline aggregates now use full permitted dataset while profile cards remain page-scoped; invalid pagination returns 400. |
| **F15** | **already fixed** | Build/install migration-history mutation is unsafe normal deployment behavior. | Normal install/build no longer performs migration repair; repair remains explicit operator action. |
| **F16** | **partially fixed** | External mapping/event dedup must include environment via external-system identity. | Integration accounts now carry an explicit `production/preview/development/test` environment contract; registration fails closed on cross-environment overwrite and reads/lists hide mismatched accounts. A first-class `ExternalSystem`/mapping identity and replay/idempotency audit for Layantara federation still remain. |
| **F17** | **still valid** | Standalone commerce, logistics and separated commercial states need full contracts. | Canonical contracts are complete at spec level, but standalone nullable project context is not yet in Prisma/runtime. Typed logistics and independently persisted commercial/payment/fulfillment/settlement dimensions also remain runtime work. |
| **F18** | **partially fixed** | Onboarding should expose six user-facing stages, autosave, templates, inheritance and actionable readiness. | A six-stage project onboarding cockpit now exists at `/app/admin/projects/[id]/onboarding`, with readiness score, blockers/warnings and links to existing editors. Hard `draft → live` readiness gate is implemented. Templates/inheritance and fuller autosave remain. |
| **F19** | **still valid** | Service catalog content/localization/supply must be verified; seed IDs alone do not prove fake supply. | Production verification on 2026-09-09 found 2 providers, both `active` and database-marked vetted. There are 3 active legacy seed services with no EN/RU/TH localized title fields, plus 4 fully EN/RU/TH-localized services that remain `draft`. Database vetting flags do not prove real external supply. Do not market the active catalog as a verified Phuket network until commercial/supply evidence is confirmed. |
| **F20** | **partially fixed** | Public homepage needs real property imagery, practical-value hierarchy and localization/content review. | Homepage was rebuilt consumer-first around stays/services/property supply and audience entry points. Final real-device/mobile/keyboard/slow-network visual QA and localization review remain; production service content is also not yet clean enough for a final public claim. |

## Additional correctness finding closed during reconciliation

- **NOI cap display boundary:** unit onboarding was dividing `noiCapAnnualThb` by 100 on the server and the client divided again for display, making the visible cap 100× too small. The server now passes canonical satang unchanged and the client performs the single THB display conversion.

## Remaining implementation priority
1. F01/F17 standalone commerce Prisma + runtime migration.
2. F02 property-specific service commercial terms.
3. F03 typed quantities + versioned quote runtime.
4. F09 replacement-hold reschedule funding workflow.
5. F12 canonical pricing cutover.
6. F18 templates/inheritance/autosave completion.
7. F11 inline owner create/invite + E2E login/owner-scope verification.
8. F16 first-class external-system mappings + replay/idempotency verification.
9. F19 real supply/content activation evidence and localization cleanup.
10. F20 final visual/localization/runtime QA.

## Agent rule
Before touching a finding: locate current branch code; check related PRs; read this status; reclassify only with evidence; never duplicate an `already fixed` item. A code implementation is not production-complete until applicable QA/AT evidence is recorded.