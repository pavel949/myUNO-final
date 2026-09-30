# AI Full-Platform Assessment Contract — myUNO

**Status:** operational audit playbook; subordinate to PROJECT.md and docs/canonical/.  
**Baseline observed:** main at 4a8ed81b24aee51020486fc049e9ef0af329ffd8, 2026-09-29.  
**Purpose:** let any coding agent assess the *current deployed and repository implementation* against the canonical product program, without confusing a specification, a branch, a passing unit test or a screen with working production behavior.

## 1. Mandatory read/inspection order

1. Read PROJECT.md, AGENTS.md, docs/canonical/README.md and its entire normative pack, especially PROCESS_MAP.md, PROCESS_PASSPORTS.md, QA_ACCEPTANCE.md, READINESS_ACCEPTANCE.md, DATA_MODEL.md and RECONCILIATION.md.
2. Inspect the current main HEAD, open PRs, their bases/diffs/checks, deploy SHA/environment, schema, migration history and release/cutover records. Never silently substitute the current checkout for main or production.
3. Run npm run audit:inventory (or node scripts/audit-platform-inventory.mjs --out audit-inventory.json). Inspect its route/module/model inventory, then trace real caller-to-writer paths. An inventory is a *discovery aid*, not proof of reachability or correctness.
4. Read docs/audits/AI_FLOW_SURFACE_MATRIX.md. For each journey, locate actual routes, components, APIs, handlers, domain services, Prisma models, policies, tests, events, external systems and operator SOPs. Replace any candidate location that has moved.
5. Collect evidence from the target environment. For each positive claim, name branch/commit/environment and a directly reproducible test or runtime observation.

## 2. What to assess

The intended product is one identity + canonical physical asset across property management, Stay/PMS, long-term lease, sales, owner operations, concierge and partner distribution. Layantara is one managed Project Space; other villas/condos may be managed or partner-operated. Individual-unit, category inventory and project-wide management share the same foundation. Public trust labels depend on evidence and actual operational mandate.

Inspect these layers separately: public network; guest Trip/Home Space; owner; partner/manager/provider; frontline staff; platform control plane; domain services; database; integrations; finance; compliance; jobs; analytics; deployment/recovery.

## 3. Evidence rules and status vocabulary

Record for every capability the nine readiness dimensions from READINESS_ACCEPTANCE.md: specification_complete, code_present, migration_applied, data_config_ready, permission_verified, ui_reachable, critical_test_passed, deployed, runtime_checked.

Allowed dimension values: verified, partial, failed, not checked, not applicable. Never use a single green score to mask failure. Separately classify findings as preserve, extend, fix, migrate, already fixed (branch-scoped), blocked, not checked. Severity P0 (money/security/inventory/data loss), P1 (broken core workflow), P2 (quality/scale/UX), P3 (polish). Distinguish observed facts from hypotheses, missing evidence and design recommendations.

Evidence row columns: process ID; actor; user intent; canonical writer; UI route; API/action; service; models; authorization/tenant scope; state transition; financial effect; messages/jobs; exceptions; test path; commit/PR; deployment; real data; result; evidence URL/log; owner; next action.

NEVER mark a process complete merely because a route, Prisma model, unit test or database migration exists.

## 4. Trace every vertical slice

For each CO01–CO30 and AT01–AT30:
input/trigger → actor and effective authority → form/read-model → route/API/action → domain command → validation/transaction/concurrency → canonical tables → event/outbox/integration → read-model UI → notifications → money/settlement (if applicable) → retry/exception → handover → observable evidence.

Inspect: mobile and desktop; EN/RU/TH; loading, empty, error, stale, forbidden, expired, double-click, retry and recovery. Verify navigation actually reaches all intended surfaces, including direct URL, contextual link and role landing; check the destination, not only link presence.

For each flow test: happy path; invalid input; unauthorized/foreign project/owner/partner ID; conflict/concurrency; provider/channel timeout; reversal/refund; rerender/refresh; idempotent retry; accessibility and smaller viewport.

## 5. Targeted domain checklist

- Property graph: organization / portfolio / development / project / building-zone / category / physical unit / offer, ownership periods, mandate, photos, amenities, descriptions, address/Plus Code, key/access secrets and audit; prevent physical duplication and false inheritance.
- Commercial modes: short stay, weekly/monthly/yearly lease, sale; offers must not cross-activate another commercial mode. Distinguish apartment vs resort unit vs room-type inventory.
- Authority: platform identity, membership, scoped role, effective OperatingScope/contract, permitted action and resource state; owner/partner/worker isolation at SSR/API/media/export/aggregates.
- Pricing: base/category/unit/date/channel/season, fees, taxes, discounts, utility/deposit, occupancy and currency; one immutable quote snapshot; historical accepted terms unchanged.
- Availability: booking, holds, owner blocks, maintenance, OTA/foreign source and shared physical capacity; DB-constrained allocation and anti-double-book concurrency.
- Stay: discover → quote → request/instant → pay/confirm → pre-arrival → check-in → in-house → requests → checkout → deposit/refund → return; single booking identity.
- Owner: claim/invite → mandate → condition/mobilization → calendar → statements/distributions → approvals/maintenance → renewal/offboarding.
- Sales & lease: lead → qualification → offer/viewing → diligence/authority → agreement/milestone → transfer/occupancy → aftercare; NEVER invent a complete engine from CRM stages alone.
- Concierge: standalone/address or stay/owner context → real provider/terms → quote/order → capacity/assignment → acceptance → fulfillment proof → dispute/refund → settlement. Service order != booking.
- Financial integrity: correct collector, earning/receivable/payable, double allocation, payout-period immutability, partial refunds and late reversals.
- Trust/compliance: management badge tied to current mandate, verified partner evidence, permitted-use channel gate, TM30 accountable owner, expiration/reassessment.
- Integrations: source-of-truth, staging/prod mapping, incoming/outgoing events, ARI vs iCal, lag, failed jobs, replay and reconciliation.
- Quality: actual images and unit-category labeling, search freshness, search-to-quote parity, fallback failures, operational SLAs and service recovery.
- Infra: migrations/drift, backup and restore, data loss window, webhook secrets, scheduler health, logs/alerts, production build and rollback.

## 6. Required current implementation crosswalk

Use AI_FLOW_SURFACE_MATRIX.md as a candidate locator only. Report per route: role, purpose, parent navigation, child links, data query, write command, canonical model, permission, empty/loading/error/forbidden state, mobile behavior, tests, deployment evidence. Flag duplicate or dead routes, misleading CTA, duplicated writers, direct Prisma writes bypassing domain service, route path collisions, unscoped queries and hard-coded demo data. Flag an undocumented route as a discovery item rather than deleting it.

Generate and inspect the repository inventory; do not use the generated route list as a substitute for checking UX reachability or business behavior.

## 7. Multi-tenancy and public Project Spaces

Prove org/project/unit effective scope and RLS/Data API vs Prisma server permissions separately. Cross-tenant tests must cover owner A vs B, manager A vs B, provider A vs B, guest A vs B, and platform support. Public global search must expose only approved published fields; private inventory, source documents, access codes, financials and identities stay private. Project branding, content, amenities, gallery, policies and operator responsibility are scoped configuration. An unapproved sale-only unit must not appear in short-stay bookability.

## 8. Layantara migration and release cutover

Reconcile 39 real villas, their physical crosswalk, 8 category definitions, actual media coverage, tariffs, rules, offerings, bookings/blocks, owners, staff and compliance against authoritative sources and signed extracts. Track per-entity count, stable identifiers, missing/duplicate/orphan rows, tariff Golden Master mathematical parity, owner/booking/hold liability, current PMS authority, channel mapping and rollback. Do not infer 39 galleries from 39 mapped villas. No production activation until source authority, data parity, DB migration, runtime checks and owner/operator sign-off are verified.

On the 2026-09-29 baseline PR #144 is a draft unified release (base release/layantara-unified-cutover), with #142 gallery and #143 quote/readiness under integration. Reinspect their *current* state and overlapping files before editing. Do not merge an audit-only branch as if it activates those features.

## 9. Standard assessment artifacts

Produce all of:
1. BASELINE.md — repo/main/PR/commit/deploy/database versions; access limitations.
2. INVENTORY.json — generated pages, route handlers, modules, tests, models, migrations.
3. SURFACE_MAP.md — screen/role/route/nav/caller/command/model/test matrix, responsive and state evidence.
4. FLOW_MATRIX.md — CO01–CO30 and AT01–AT30 with nine readiness dimensions and links.
5. SOURCE_OF_TRUTH.md — each critical fact, writer, consumer, scope, event and duplication.
6. DATA_RECONCILIATION.md — Layantara + other managed assets vs live records; never include PII/secrets in artifacts.
7. GAPS.md — P0–P3, proven issue, affected user/business, root cause, dependency and safest fix.
8. RELEASE_EVIDENCE.md — tests/build/migrations/drift/runtime and explicit cutover decision.

Use the companion docs as templates; generated files may remain local/untracked until evidence is checked. Redact guest details, passports, tokens, access codes, payment credentials and exact private addresses.

## 10. Implementation decision rules

Preserve verified functionality; do not rebuild already-fixed work on another branch. Implement one vertical slice at a time, including schema/permission/UX/error/test/docs where applicable. Migrations use expand → backfill → parity → controlled cutover → observe → contract later. Never production db push or unapproved historical rewrite. Use feature and capability gates rather than false “live” labels.

Conclude with two separate statements: (a) code/branch readiness and (b) real deployed operating readiness. Attach exact evidence and unknowns to both.
