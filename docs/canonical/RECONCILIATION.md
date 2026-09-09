# RECONCILIATION.md — Baseline Findings Reconciled to Current v3 Branch

Status values are authoritative for `feat/canonical-platform-v3` as of 2026-09-09. Revalidate after material schema/flow changes. `already fixed` means the current branch contains the intended correction; it does not by itself mean production release verification has passed.

| ID | Status | Finding | Current evidence / remaining work |
|---|---|---|---|
| **F01** | **still valid** | Service orders are project-context dependent; target requires standalone customer commerce. | `CreateServiceOrderInput.projectId` remains required and canonical spec now explicitly requires nullable standalone context. Schema/API migration still required. |
| **F02** | **still valid** | ServiceProject is too thin for property-specific commercial terms. | Readiness can detect enabled supply, but pricing/SLA/cancellation/collector/commission property overrides are not yet a complete canonical PropertyServiceConfiguration model. |
| **F03** | **partially fixed** | Quantity handling risks conflating quantity, duration and participant count; quote needs a full versioned contract. | Canonical marketplace contract separates dimensions and quote versions; existing runtime still has generic `quantity` on ServiceOrder. Typed category inputs/QuoteVersion runtime remain. |
| **F04** | **already fixed** | Order closure/completion was not confirmed in baseline main. | v3 adds `fulfilled_at`, confirm/dispute deadline, explicit confirmation, scheduled auto-close and closed event contract. Public confirm seam uses transactional implementation. |
| **F05** | **already fixed** | Commission accrual and provider remittance must use the same accepted terms snapshot. | Fulfillment commission and remittance both use `take_rate_pct_snapshot`; regression coverage added. |
| **F06** | **already fixed** | Remittance eligibility must not depend on generic `updatedAt` or one narrow current status. | Provider remittance uses `fulfilled_at`, includes fulfilled/closed states and excludes undecided disputes. |
| **F07** | **already fixed** | Fulfillment state + earning creation must be atomic/idempotent. | `fulfilment-atomic.service` serializes accepted→fulfilled + commission ledger in one transaction and guards repeat fulfillment. |
| **F08** | **already fixed** | Dispute/ticket creation and acceptance window need atomic policy-aware handling. | Ticket+dispute creation is transactional; service-order row locking serializes confirm/dispute/close; DB trigger/advisory guard prevents duplicate subject disputes; invalid window config is rejected. |
| **F09** | **still valid** | Reschedule requires first-class workflow, not cancel-and-recreate. | Canonical contract exists; replacement hold/price delta/funding/commit/release-old runtime workflow is not complete. |
| **F10** | **still valid** | Physical goods/SKU/stock/delivery model was absent in baseline. | Canonical model is specified; runtime SKU/stock movement/logistics should be added only when actual product supply is enabled. |
| **F11** | **not verified** | Owner onboarding must support safe exact match, draft Party creation and invitation. | Current v3 work adds project readiness but this exact owner-identity onboarding flow has not been revalidated end-to-end in this release candidate. |
| **F12** | **still valid** | Legacy unit pricing fields and RatePlan have overlapping readers/writers. | Readiness accepts either sellable base price or active rate plan; canonical pricing cutover remains a deliberate migration task. |
| **F13** | **already fixed** | CRM summary metrics require formula/scope/naming correction. | v3 corrected active opportunity/weighted pipeline/win-rate definitions and retains satang basis. |
| **F14** | **already fixed** | CRM aggregates must be computed before pagination over permitted scope. | Pipeline aggregates now use full permitted dataset while profile cards remain page-scoped; invalid pagination returns 400. |
| **F15** | **already fixed** | Build/install migration-history mutation is unsafe normal deployment behavior. | Normal install/build no longer performs migration repair; repair remains explicit operator action. |
| **F16** | **not verified** | External mapping/event dedup must include environment via external_system_id. | Canonical architecture specifies environment-safe mappings/idempotency; current runtime mapping tables/event consumers require a dedicated audit before claiming complete. |
| **F17** | **still valid** | Standalone commerce, logistics and separated commercial states need full contracts. | Canonical contracts are complete at spec level; standalone nullable project context, typed logistics and independently persisted commercial/payment/fulfillment/settlement dimensions remain runtime work. |
| **F18** | **partially fixed** | Onboarding should expose six user-facing stages, autosave, templates, inheritance and actionable readiness. | Deterministic readiness evaluator/API and hard `live` gate are implemented. Six-stage polished wizard, templates/inheritance and full autosave UX remain. |
| **F19** | **not verified** | Service catalog content/localization/supply must be verified; seed IDs alone do not prove fake supply. | Production baseline showed 7 services/2 providers, but real-world supply/content/localization/evidence has not been verified in this branch. Do not present unverified supply as live. |
| **F20** | **partially fixed** | Public homepage needs real property imagery, practical-value hierarchy and localization/content review. | Homepage was rebuilt consumer-first around stays/services/property supply and audience entry points; final image/content/localization/runtime visual QA remains required. |

## Remaining implementation priority
1. F01/F17 standalone commerce contract and schema migration.
2. F02 property-specific service commercial terms.
3. F03 typed quantities + versioned quote runtime.
4. F09 first-class reschedule.
5. F12 canonical pricing cutover.
6. F18 onboarding wizard UX/templates/inheritance.
7. F11/F16/F19 verification audits before release claims.
8. F20 final visual/localization/runtime QA.

## Agent rule
Before touching a finding: locate current branch code; check related PRs; read this status; reclassify only with evidence; never duplicate an `already fixed` item. A code implementation is not production-complete until applicable QA/AT evidence is recorded.