# PROJECT.md — myUNO Canonical Platform Program

**Status:** authoritative product, architecture and implementation specification  
**Repository:** `pavel949/myUNO-final`  
**Target:** `myUNO.app`  
**Version:** 3.0  
**Date:** 2026-09-09  
**Audience:** any capable coding agent or engineering team. Vendor-neutral.

## 0. Canonical document hierarchy

1. `PROJECT.md`
2. `docs/canonical/PRODUCT.md`
3. `docs/canonical/DESIGN.md`
4. `docs/canonical/ARCHITECTURE.md`
5. `docs/canonical/DATA_MODEL.md`
6. `docs/canonical/SERVICES_MARKETPLACE.md`
7. `docs/canonical/CRM_SPEC.md`
8. `docs/canonical/PROCESS_MAP.md`
9. `docs/canonical/ROLE_WORKSPACES.md`
10. `docs/canonical/MIGRATION_DELIVERY.md`
11. `docs/canonical/AI_AGENT_RULES.md`
12. `docs/canonical/QA_ACCEPTANCE.md`
13. `docs/canonical/READINESS_ACCEPTANCE.md`
14. `docs/canonical/ROADMAP.md`
15. `docs/canonical/RECONCILIATION.md`
16. `docs/canonical/DECISIONS_CHANGELOG.md`

Existing repository docs remain evidence of current behavior. Where they conflict with this pack: preserve production data/safety, preserve verified behavior until migration, follow this pack as target state, and record reconciliation through an ADR/change record. No document may silently contradict another.

## 1. Mission

myUNO is a **unified property, stay, ownership, relationship and Phuket services network**.

It must let users complete practical jobs:
- guests/customers: find a stay, book/request, manage a vacation, order services before/during a stay, order eligible Phuket services without a stay, get help and track fulfillment;
- owners: submit or claim inventory, self-manage where allowed, apply for professional management, see money/bookings/condition/approvals/asset history;
- property managers/partners: onboard managed inventory, invite team, operate only delegated functions, manage price/availability where authorized, use the service network;
- providers: publish verified offerings, manage capacity, fulfill orders, resolve exceptions and reconcile earnings;
- myUNO team: operate properties, CRM/commercial relationships, standards, service network, finance, data quality and portfolio exceptions.

The user should experience jobs completed, not modules.

## 2. North Star

> **Find a place. Live well. Get things done. Own with clarity.**

Underneath:

```text
Property Graph
+ Party / CRM Graph
+ Stay Graph
+ Ownership Graph
+ Services / Provider Network
+ Verified Operating Events
+ Standards / Evidence
= compounding myUNO network
```

Every new property should improve the network, not merely enlarge the catalogue.

## 3. Non-negotiable invariants

1. One global human Identity/Party; no separate guest/owner/buyer universes.
2. Roles and relationship states may coexist.
3. Legal ownership, CRM lifecycle, user role and commercial opportunity are distinct.
4. One physical Unit. Commercial configurations do not duplicate physical inventory.
5. One declared authority for each exclusive function on each effective scope.
6. One canonical writer for each financial fact.
7. Pricing, availability and booking authority are explicit by property/unit scope.
8. Public management/verification claims derive from active scope and evidence.
9. Dashboards and 360s are derived read models.
10. New ordinary properties do not get a new database or application fork.
11. Layantara may remain a federated operational store until deliberate cutover.
12. No uncontrolled bidirectional table synchronization.
13. Private evidence/media is separated from public marketing media.
14. Historical bookings, payments, settlements, ownership and accepted terms are not rewritten by later configuration.
15. User-visible actions connect to real workflows.
16. A customer may buy eligible services without a stay or property relationship.
17. Emergency guidance is never blocked by commerce/auth friction when urgent help is required.
18. Configuration cannot accidentally override legal responsibility/exclusive authority.
19. AI may assist but cannot invent availability, price, authority, verification or completion.
20. Code existence alone is never readiness.

## 4. Experience layers

```text
PUBLIC NETWORK
Explore · Stays · Services · Homes · For Owners · For Partners

MY myUNO
Trips · Orders · Homes · Saved · Ownership · Work · Partner

PROPERTY / PARTNER WORKSPACES
Layantara OS · managed residences · partner portfolios

CONTROL PLANE
Needs Attention · CRM · Portfolio · Owners · Network · Standards · Integrations
```

One platform does not mean one UI.

## 5. Public UX priority

Homepage order:
1. Find a stay/search.
2. Real places on myUNO.
3. Ways to stay.
4. Phuket services.
5. Trip-management value.
6. Owner paths.
7. Partner paths.
8. Trust/standard/responsibility.

Do not lead with six equal audience cards or internal terms.

## 6. Asset hierarchy

```text
Destination / Area
→ Development
→ Property / Operating Property
→ Building / Zone (optional)
→ Collection (editorial/commercial grouping)
→ Unit (physical inventory)
→ Commercial Configuration / Offering
```

A Collection is not ownership or authority. Alternate bedroom-sale modes of one villa share physical capacity.

## 7. Effective authority

Resolve from:

```text
active Identity
+ Organization membership
+ scoped RoleAssignment
+ resource scope
+ active OperatingScope/contract
+ function authority
+ action/field restrictions
+ resource state
```

Exclusive functions include publishing, pricing, availability, booking acceptance, guest care, maintenance, service coordination, content, finance and team management. Overlapping active authority claims are conflicts, never "latest row wins".

## 8. Database and federation

Current topology has separate myUNO and Layantara stores. Target:
- myUNO DB = global/control-plane canonical domains;
- Layantara DB = mature resort-local execution during transition;
- future ordinary properties = shared myUNO DB.

Separate DB requires legal/contractual/inherited-PMS/measured-isolation justification.

Integration uses `ExternalSystem` unique by `(system_key, environment)`, `ExternalRecordLink`, versioned `BusinessEvent`, durable inbox/checkpoint, idempotency and explicit authority commands. Never confirm an authority-owned booking from a stale projection.

## 9. Standalone commerce

Services marketplace supports:
- stay context;
- owned-home context;
- managed-property context;
- standalone address/service-area context.

For standalone orders, property/project may be null; responsible organization and validated service/delivery context are required. Never create a fake “All Phuket” property.

## 10. Commerce model

Support services, quote work, referrals, products, rentals/equipment, packages and recurring services as real supply becomes available.

Target concepts: CatalogDefinition; Provider; ProviderOffering/existing Service; OfferingTermsVersion; PropertyServiceConfiguration; CoverageRule; Resource/Capacity; QuoteRequest/QuoteVersion; Order/OrderLine; Fulfillment; SettlementAllocation.

Evolve existing models instead of mechanically duplicating them.

## 11. Commerce states

Keep independent:
- commercial acceptance;
- fulfillment;
- payment;
- dispute/case;
- settlement;
- administrative closure.

Fulfilled ≠ paid. Closed ≠ settled. Accepted terms are versioned/frozen for the transaction.

## 12. Money invariants

- THB uses integer minor units in core calculations.
- Client totals are never authoritative.
- Quantity, duration, participant count, capacity and amount are distinct.
- Financial recognition uses immutable business dates, not `updatedAt`.
- Commission/remittance use accepted transaction snapshots.
- Closed statements are adjusted, not rewritten.
- Provider-collects and myUNO-collects create different receivable/payable logic.
- Payout allocation is idempotent and cannot pay one obligation twice.
- Tax rules are scoped/versioned; no property tax assumption becomes global automatically.

## 13. CRM

CRM is the relationship/commercial operating system on the same Identity. It provides Today/next actions, inbox, contacts/organizations, opportunities, activities/calendar, proposals, referrals and formula-defined reports. It does not duplicate bookings, orders, ledger, legal ownership or support cases. See `CRM_SPEC.md`.

## 14. Company process loop

CO01–CO30 cover lead intake through booking/stay/services/operations/finance/ownership/provider/staff/offboarding/integration recovery/leadership review. Each requires a process passport with trigger, actors, scope, fields, transitions, SLA, money, communications, failures, evidence, screen and acceptance. See `PROCESS_MAP.md`.

## 15. Universal onboarding

One six-stage user flow:
1. What is being connected?
2. Units and content.
3. Owner and responsibility.
4. Sales/pricing/settlement.
5. Operations/services/team.
6. Review and launch.

Requirements: server autosave, resume, templates/inheritance, drafts, import dry-run/idempotency, existing-development reuse, owner/partner invite, actionable readiness and separate `canPublish`, `canReceiveInquiry`, `canRequestBooking`, `canInstantBook`, `canOperate`, `canSettle` gates.

## 16. Pricing/inventory

Canonicalize through reader/writer inventory, backfill, shadow parity, writer cutover, reader cutover, block legacy writes, observe, cleanup later. Historical booking snapshots remain unchanged. Shared physical capacity prevents alternate commercial configurations from double-selling the same unit. Availability has source/freshness/hold/concurrency/fallback. iCal is not full ARI.

## 17. Guest-facing system

```text
discover → search → quote → book/request → Trip Hub → pre-arrival → arrival/access → stay/Home Space → services/orders → support → itinerary → checkout → post-stay → return/ownership relationship
```

Booking = transaction; Trip = derived orchestration; Home Space = active-stay UX. Support wallet, travel party, itinerary, property map, emergency, safe PWA information and AI concierge with deterministic action boundaries.

## 18. Role workspaces

Founder/admin → Needs Attention; property manager → Today; reservations → Arrivals & Requests; CRM → My Next Actions; revenue → Pricing & Restrictions; frontline → My Shift; technician → My Jobs; marketplace coordinator → Orders Requiring Action; finance → Reconciliation & Obligations; owner → My Homes; partner manager → My Portfolio; provider → My Orders; guest/customer → My Trips & Orders. See `ROLE_WORKSPACES.md`.

## 19. Design

Target: **quiet premium hospitality network with serious operating machinery underneath**. Public = image-led/editorial/spacious/utility-first. Operations = denser/case-oriented/exception-driven. Preserve mature Andaman/ivory/gold tokens and components where sound, but redesign composition away from generic SaaS/audience-card walls. See `DESIGN.md`.

## 20. Reliability/release

Build/install must not mutate production migration history. Required: explicit migration stage, backup, restore rehearsal, expand/contract, resumable backfill, compatibility check, scheduler/job health, post-restore external-payment reconciliation and idempotent webhooks/jobs. See `MIGRATION_DELIVERY.md`.

## 21. Security

Verify Prisma DB role and Supabase Data API separately. No privileged browser credential; scoped server authorization; cross-property/partner/owner IDOR tests; safe caching; public DTO allowlists; short-lived private media access; audited privileged changes; no raw PII in logs/analytics/events; no broad policy change merely to silence advisor warnings.

## 22. Agent behavior

This project is vendor-neutral. ChatGPT/Codex, Claude Code, Cursor, Gemini or another agent follows `inspect → reconcile → implement → migrate → test → deploy → runtime verify → document`. See `AI_AGENT_RULES.md`.

## 23. Readiness

For each capability track independently: specification complete, code present, migration applied, data/config ready, permission verified, UI reachable, critical test passed, deployed, runtime checked. Values: verified/partial/failed/not checked/not applicable. P0 money/security/inventory failures block go-live regardless of score. See `READINESS_ACCEPTANCE.md`.

## 24. Scalability

A normal new property must not require code, a new DB, auth fork, service-table fork or custom dashboard. Standard path: organization → asset → ownership/authority → config → team/services/channels → validation → live. Track onboarding time, engineering interventions, config reuse and data-quality failures.

## 25. Implementation sequence

1. Baseline/safety.
2. Critical order-money-migration fixes.
3. Shared contracts/authority/pricing.
4. Team/CRM/operational workspaces.
5. Supply onboarding.
6. Marketplace completion.
7. Public + role UX.
8. Layantara federation.
9. Distribution/advanced automation.

Do not let visual redesign hide known financial/order correctness issues.

## 26. Definition of Done

Material alignment requires canonical boundaries; reliable pricing/availability/booking; full guest trip; owner self-list + management application; partner onboarding/operation; standalone service ordering; multi-property provider network; daily CRM; role workspaces; no-loss Layantara integration; reliable backups/migrations/jobs; tested access isolation; coherent premium design; and AT01–AT30 evidence.

The product is complete only when real users can complete defined processes and the system can prove resulting data, authority and money.
