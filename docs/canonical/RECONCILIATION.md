# RECONCILIATION.md — Baseline Findings Reconciled to Current v3 Branch

Status values below describe `feat/canonical-platform-v3`. `already fixed` means the release-candidate branch contains the intended implementation; it does **not** mean production deployment/runtime verification has passed.

| ID | Status | Finding | Current evidence / remaining work |
|---|---|---|---|
| **F01** | **already fixed** | Service orders were property-context dependent. | `ServiceOrder.project_id` is nullable in the additive migration/Prisma schema. Canonical order creation accepts a true standalone Phuket `service_context` containing area/address and no synthetic project. Public service wizard exposes standalone area/address ordering. |
| **F02** | **already fixed** | Property-specific service economics were too thin. | `ServiceProject` now stores enabled/public state, price and cost override, take-rate, lead time, SLA, cancellation policy, collector, fulfillment/complaint owner, inclusions, effective dates and terms version. Accepted orders snapshot the effective terms. |
| **F03** | **already fixed** | Quantity, duration and participants were conflated; quote terms were mutable. | Canonical commerce stores `quantity_dimensions`, validates category-specific dimensions, computes money server-side, and implements `ServiceQuoteRequest` + immutable/versioned `ServiceQuoteVersion` with exact accepted-version linkage to an order. Contract tests cover typed quantities. |
| **F04** | **already fixed** | Order closure/completion was incomplete. | v3 adds `fulfilled_at`, confirm/dispute deadline, explicit confirmation, scheduled auto-close and closed event contract. Public confirm seam uses the transactional implementation. |
| **F05** | **already fixed** | Commission accrual/remittance needed one accepted snapshot. | Fulfillment commission and remittance use `take_rate_pct_snapshot`; regression coverage added. |
| **F06** | **already fixed** | Remittance eligibility used mutable timestamps/statuses. | Provider remittance uses `fulfilled_at`, includes fulfilled/closed states and excludes undecided disputes. |
| **F07** | **already fixed** | Fulfillment and earning creation needed atomicity. | `fulfilment-atomic.service` serializes accepted→fulfilled + commission ledger in one transaction and prevents repeat earning. |
| **F08** | **already fixed** | Dispute/ticket creation and acceptance-window races. | Ticket+dispute creation is transactional; service-order locking serializes confirm/dispute/close; DB advisory trigger prevents duplicate subject disputes; invalid window config is rejected. |
| **F09** | **already fixed** | Reschedule needed a replacement-hold workflow. | Confirmed date changes now create `BookingReschedule`; the original booking remains unchanged while the replacement range is represented by a normal `BlockedDate`. Positive deltas require succeeded linked funding before atomic commit. Browser-return and provider-webhook success seams both commit/recover the reschedule; a DB trigger guarantees hold cleanup when the reschedule leaves an open state. |
| **F10** | **still valid / intentionally deferred** | Physical goods/SKU/stock/delivery model. | Add only when real product inventory/supply is enabled. Current requested scope is services; no fictional stock model is created. |
| **F11** | **already fixed** | Inline owner exact-match/invite/assignment/claim. | `onboardUnitOwner` performs exact normalized email lookup, creates an invited Identity only when absent, updates chain-of-title + unit current owner, grants/reactivates unit-scoped owner role and issues a seven-day claim token in one transaction. Admin unit owner API exposes the orchestration and claim URL. Existing active users are not downgraded. |
| **F12** | **already fixed for current production authority** | Legacy pricing vs RatePlan ambiguity. | Production verification found zero RatePlan rows while live units use `base_nightly_thb`. Readiness no longer treats an empty/unused RatePlan model as an alternative sellable truth; current runtime authority remains `Unit.baseNightlyThb + PricingRule` until a deliberate future cutover. |
| **F13** | **already fixed** | CRM metric definitions/scope. | Active opportunity, weighted pipeline and win-rate definitions corrected while retaining satang basis. |
| **F14** | **already fixed** | CRM aggregates before pagination. | Pipeline aggregates use the full permitted set; cards remain page-scoped; invalid pagination returns 400. |
| **F15** | **already fixed** | Build/install migration-history mutation. | Normal install/build never performs migration repair; repair is an explicit operator action. |
| **F16** | **already fixed at federation-contract level** | External identity/replay/environment safety. | Added `ExternalSystem(systemKey,environment)`, environment-scoped mappings, durable event inbox, payload-hash exact dedup and aggregate checkpoints. Older/out-of-order events are retained as stale evidence but cannot regress checkpoints. Generic authenticated-secret ingress supports Layantara/future systems; downstream domain-specific projection commands remain separate adapters. |
| **F17** | **partially fixed** | Standalone commerce/logistics/state separation. | Standalone service commerce is implemented and commercial/fulfillment/payment/dispute/settlement concepts remain separated. Product/SKU logistics remain intentionally deferred until real physical-product supply exists. |
| **F18** | **already fixed** | Six-stage onboarding, templates, inheritance/autosave, readiness. | Six-stage cockpit + hard activation readiness already existed. v3 now adds reusable versioned property templates, one resumable project draft, inherited defaults and server autosave/resume UI without creating a second operational source of truth. |
| **F19** | **partially fixed** | Public service supply/content quality. | Runtime now fails closed for incomplete public services and admin direct-create requires RU/EN/TH plus vetted provider. Production data still requires commercial confirmation before any claim of a broad verified Phuket supplier network. |
| **F20** | **partially fixed** | Public visual/localization/runtime QA. | Homepage and services UX are consumer-first and standalone ordering is surfaced. Final real-device/mobile/keyboard/slow-network and RU/EN/TH runtime validation requires a deployable v3 preview. |

## Additional correctness finding closed

- **NOI cap display boundary:** server now passes canonical satang unchanged and the client performs the single THB display conversion, removing the previous 100× understatement.

## Release blockers, not missing product architecture

1. Current Vercel preview deployment is red and its build logs are inaccessible to the connected Vercel identity; GitHub reports deployment `dpl_GmL5t7AGkF6uXG3vwojKCXNPuBXz` failed.
2. GitHub Actions continues to fail before checkout with no allocated runner/steps.
3. Production migrations are intentionally not applied while application build/deploy cannot be independently verified.
4. AT29 real deployed mobile/localization QA is therefore not yet executable against v3.
5. AT30 migration DDL received a successful full rollback rehearsal after correcting TEXT-vs-UUID ID assumptions; actual backup/restore recovery rehearsal is not exposed by the connected tooling and remains operational evidence to complete before production cutover.

## Agent rule

Before touching a finding: inspect current branch code and this matrix. Do not rebuild an `already fixed` domain. A branch-level implementation becomes production-complete only after applicable build, migration, runtime and acceptance evidence is recorded.
