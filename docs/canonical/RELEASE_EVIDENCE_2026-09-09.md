# RELEASE_EVIDENCE — myUNO canonical v3 release candidate

**Repository:** `pavel949/myUNO-final`  
**Branch:** `feat/canonical-platform-v3`  
**PR:** #64  
**Evidence refreshed:** 2026-09-10

This file separates branch implementation from production verification. `implemented` does not mean `deployed`.

## 1. Acceptance status

| Capability | Specification | Branch implementation | Migration | UI/API | Test evidence | Production/runtime |
|---|---|---|---|---|---|---|
| AT01 standalone Phuket services | verified | **implemented** | additive migration prepared + rollback rehearsed | standalone area/address ordering exposed | contract coverage added | not deployed |
| AT03 property-specific service economics | verified | **implemented** | prepared | price/cost/take-rate/SLA/cancellation/collector/effective terms | immutable order snapshots | not deployed |
| AT04 typed quantities + QuoteVersion | verified | **implemented** | prepared | typed order inputs + quote request/version/accept APIs | quantity contract tests | not deployed |
| AT09 replacement-hold reschedule | verified | **implemented** | prepared | modify flow creates hold/funding/commit workflow | concurrency/payment seams implemented | not deployed |
| F11 inline owner invite/assignment/claim | verified | **implemented** | existing identity/ownership schema | admin owner API orchestration | transaction invariants implemented | not deployed |
| AT25 federation replay/out-of-order | verified | **implemented at ingress contract** | prepared | authenticated federation event ingress | replay/order contract tests | Layantara adapter runtime not deployed |
| F18 templates/inheritance/autosave | verified | **implemented** | prepared + seed templates | resumable six-stage cockpit + autosave | readiness tests already present | not deployed |
| AT29 RU/EN/TH/mobile/keyboard/slow network | verified | partial static implementation | n/a | responsive/i18n surfaces exist | not sufficient | **not checked on v3 deployment** |
| AT30 restore/migration/replay | verified | migration/replay mechanisms implemented | **DDL rollback rehearsal passed** | n/a | replay contracts present | **backup/restore rehearsal not available through connected tooling** |

## 2. Newly completed structural work

### Standalone services and property economics

- `ServiceOrder.project_id` is nullable in the v3 schema/migration.
- Standalone orders require an explicit Phuket area or service address; no fake `All Phuket` project exists.
- `ServiceProject` now carries property-local price/cost/take-rate/lead-time/SLA/cancellation/collector/fulfillment/complaint/inclusions/effective-date/version terms.
- Client-supplied totals are never authoritative; canonical creation calculates the total on the server.
- Accepted orders store immutable `terms_snapshot` and typed `quantity_dimensions`.

### Quotes

- `ServiceQuoteRequest` and versioned `ServiceQuoteVersion` are implemented.
- Quote commercial fields are immutable after creation; accepting a quote stamps acceptance and links the exact version to the resulting order.
- Provider/admin authorization is required for quote creation; only the requesting customer can accept.

### Rescheduling

- Confirmed-booking date changes now use `BookingReschedule`.
- Original booking dates stay unchanged while the replacement range is held.
- The replacement hold is also represented by a normal `BlockedDate`, so existing availability readers see it.
- Positive price delta must be funded before commit.
- Browser payment confirmation and provider webhook both commit or recover the linked reschedule.
- DB trigger removes replacement holds whenever the reschedule leaves an open state.

### Owner onboarding

`onboardUnitOwner` performs exact normalized email resolution and, in one transaction:
- creates an invited Identity only when absent;
- closes/replaces chain-of-title as applicable;
- updates the Unit current-owner pointer;
- grants/reactivates unit-scoped `owner` role;
- invalidates older unused claim tokens;
- issues a seven-day account-claim token for invited owners.

Existing active users are not downgraded or forced through claim again.

### Federation

- `ExternalSystem` unique by system + environment.
- Environment-scoped external mappings.
- Durable event inbox with exact `(system,event_id)` dedup.
- Canonical payload hash prevents changed-payload replay under the same event id.
- Aggregate checkpoint rejects/stores older events as stale rather than regressing state.
- Generic ingress is disabled unless `MYUNO_FEDERATION_SECRET` is configured server-side.

### Property onboarding

- Six-stage onboarding/readiness cockpit.
- Hard activation readiness gate.
- Versioned reusable templates.
- Resort / managed-condominium / standalone-villa starter templates.
- One resumable `ProjectOnboardingDraft` per project.
- Template configuration is inherited/default state only; operational editors remain authoritative.
- Server autosave/resume UI added.

## 3. Previously completed critical controls

- fulfillment + service commission is atomic/idempotent;
- provider remittance uses immutable `fulfilled_at` and accepted take-rate snapshot;
- late refunds carry into later payable periods rather than rewriting recorded payout periods;
- unresolved refunds/disputes block payout;
- confirmation/dispute race is serialized;
- duplicate disputes have application and database concurrency protection;
- `service.fulfilment_confirm_window_hours` must be a positive whole number;
- normal install/build never mutates migration history;
- RBAC differentiates read/write and project/unit/provider/organization scope;
- CRM has account ownership, worklist and scope-wide-before-pagination metrics;
- current live pricing authority is `Unit.baseNightlyThb + PricingRule`; unused RatePlan is not treated as a second go-live truth;
- NOI cap is converted from satang to THB exactly once in presentation.

## 4. Database evidence

Production project: `burcnghheyzbzffzgmjz`.

Read-only verification on 2026-09-10:
- project: 3
- unit: 5
- provider: 2
- service: 7
- booking: 0
- service_order: 0
- ledger_entry: 0

The v3 migrations are not present in production migration history.

A transaction-wrapped rehearsal of `20260909160000_canonical_commerce_federation_onboarding` initially caught a real TEXT-vs-UUID mismatch. The migration was corrected to use the same TEXT representation as existing Prisma IDs. Rehearsal then returned:

`rollback_rehearsal_ok`

The transaction was rolled back; production schema and data were not changed.

## 5. Review evidence

- All original CodeRabbit inline review threads are resolved.
- CodeRabbit combined status is green on the integrated branch revisions inspected during this release pass.
- A fresh manual CodeRabbit review was requested specifically for schema/migration alignment, standalone ordering, quote immutability, reschedule payment recovery, owner claim security, federation replay and onboarding autosave.
- Focused tests exist for authority, readiness, order closure, finance/concurrency, typed service quantities and federation ordering.

## 6. Current external release blockers

### GitHub Actions

The workflow itself includes checkout, Node/npm, lint, PostgreSQL migration, build and tests. The observed run still fails before checkout: no runner and no steps are allocated. This is not evidence that application tests fail, but it means CI is **not passed**.

### Vercel

GitHub reports a real failed preview deployment and provides deployment IDs (latest inspected branch status included `dpl_31waTzmUueDzAEQHrb7UcbmsxLbR`). The connected Vercel identity receives 403 when listing project deployments and 404 when opening the deployment ID, so its build log cannot be retrieved from this session. Vercel therefore remains a hard release-verification blocker.

### AT29

The v3 branch cannot be marked mobile/localization/accessibility passed until a successful preview is available for real-device/viewport, RU/EN/TH, keyboard and slow-network checks.

### AT30

Migration rehearsal and replay design/testing are complete to the level available without destructive production operations. The connected Supabase interface does not expose backup snapshot creation / point-in-time recovery rehearsal. A genuine backup→restore→external-side-effect reconciliation drill therefore remains operational evidence, not something to fake in production.

## 7. Security advisor note

The current production Supabase security advisor reports many `RLS enabled, no policy` informational findings across the existing Prisma-managed public schema and two legacy extension-placement warnings (`citext`, `btree_gist`). This release does not broadly change those controls: the application uses scoped server authorization/Prisma access and the newly introduced operational tables are explicitly revoked from PUBLIC. A broad RLS/extension migration is separate security-hardening work and must not be mixed into this release without validating the actual DB role/Data API architecture.

## 8. Release decision

The requested F01/F02/F03/F09/F11/F16/F18 functionality is implemented in the release-candidate branch and documented as such.

**Do not apply the production migration or merge #64 while the Vercel build is red and GitHub CI cannot execute.** The remaining blockers are verification/infrastructure blockers rather than missing domain architecture.

Required cutover sequence once a real build can run:
1. successful Prisma generate/lint/build/tests;
2. no unresolved blocking review findings;
3. immediate pre-cutover production migration/history/data check;
4. apply migrations once;
5. deploy the same reviewed SHA;
6. smoke AT01/03/04/09/11/25 plus auth/booking/payment paths;
7. run AT29 deployed UX checks;
8. record backup/restore operational evidence for AT30;
9. merge/promote only after the above evidence is green.
