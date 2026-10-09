# myUNO canonical process and maturity audit

**Scope and evidence boundary (8 October 2026).** This is a separate, read-only process audit of `pavel949/myUNO-final`. The assessed main baseline is `c0627258c80714257ca7b851282dba2c3bb3d834` (`origin/main` in the isolated checkout). The shared local implementation branch was at `11712201beaeeafc015dc9b98bbe8d4e0afb7a59` when last checked; its booking changes are **not** credited to main or production. A later local commit `57c34eb26d1017a9b24f4dfb57e0e5abd2e91bf5` addressed the long-stay inquiry and single-space staff navigation seams; it does not change this main-baseline score. The source inventory generated for that baseline reports 160 pages, 227 handlers, 22 modules, 115 Prisma models, 77 migrations, and 311 test files. Those are discovery counts, not completed user journeys. This audit read canonical documentation, the uploaded operating-loop specification, current routes/services/schema, selected tests, and the existing release evidence. It did not execute database-backed tests, authenticate as roles, inspect live production data, exercise browser flows, or verify a backup/restore. The uploaded §66 ends after the audit field `reason`; no missing tail is inferred.

The canonical contract comes from `PROJECT.md`, `docs/canonical/PRODUCT.md`, `PROCESS_MAP.md`, `PROCESS_PASSPORTS.md`, `ROLE_WORKSPACES.md`, `READINESS_ACCEPTANCE.md`, and the uploaded `MYUNO_CANONICAL_OPERATING_LOOP_CODEX.md`. `docs/audits/AI_FLOW_SURFACE_MATRIX.md` is a locator, not a pass report. One example of documentation drift: `docs/STITCH_FLOW_RECONCILIATION.md:58` calls Night Audit missing, while main contains `/ops/night-audit`; the route is currently a read-only daily view, not the full close control in specification §§59–60.

## 1. Canonical operating rule

Every role-facing process should follow the same sequence: **entry from the role's first screen → scope and authority check → input and preview → canonical command and guarded state transition → money/capacity effect → event/notification → next owner's queue → user-visible acknowledgment → retry, reversal, and evidence**. One `Identity`, one physical `Unit`, one booking/capacity authority, one accepted commercial snapshot, one service order, and one financial writer must connect the steps. Workspace switching does not grant rights. Layantara source authority and historical booking/financial facts require explicit reconciliation before any writer cutover.

## 2. Role entry and handoff map

| Role / first job | Canonical first screen and handoff | Main source surface found | Process UX verdict |
| --- | --- | --- | --- |
| Public visitor / choose a stay, home, service, or owner path | Job-led public search → truthful offer → quote/inquiry | `/`, `/search`, `/projects/[slug]`, `/units/[id]`, `/homes`, `/services` | Multiple real entry points; quote, long-stay, and service handoffs need distinct checks. |
| Guest/customer / continue a trip or order | `/app` → Trips & Orders → payment, arrival, service, help, checkout | `src/app/app/page.tsx`, `/trips/[id]`, `/bookings/[bookingId]/home-space`, `/services/orders/[orderId]` | Relationship hub and transactional pages exist; full cross-role journey and live acknowledgments untested. |
| Agent / sell authorized live inventory | Agent Today → search/quote → proposal/share → request/hold → own booking/payment status | No agent page under `src/app` in `origin/main`; booking channel includes `agent` | Required P0 Agent Workspace is absent on main. Reconcile open agent/distribution PRs before implementation or release. |
| Owner / see money, home, condition, approvals | `/owner` → asset → statement/approval/stay → operator response | `/owner`, `/owner/units/[unitId]`, `/owner/statements`, `/api/owner-stays` | Real scoped owner views and owner stay path; capex approval and operator handoff are not a first-class sequence. |
| Self-managed owner / edit authorized listing | My Property → allowed content/calendar → review/acknowledgment | `/property/onboard`, `/property/listings`, `/api/units/[unitId]/pricing-rules` | Submission and listing paths exist; preserve separate myUNO-host tariff authority. Exact mandate and role checks need execution. |
| Partner/management-company manager / run delegated portfolio | `/mc` Today → property → bookings, tasks, team, finance | `/mc`, `/mc/portfolio`, `/mc/properties/[unitId]`, `/mc/requests` | Connected portfolio surface; scoped writes and handoff to staff/owner need role-run proof. |
| Provider / act on orders | `/provider` → accept/decline → fulfill/problem → remittance | `/provider`, `/provider/services`, `/provider/remittances` | Order queue and remittance view exist; quote, reschedule, proof, and payout exceptions need complete flow tests. |
| Buyer/client / advance an offer | My Proposals → shortlist/viewing/diligence → signed transaction → title evidence | `/buying` shows saved homes and team inquiry; admin `PropertyDeal` exists | Honest partial flow. Buyer proposal/diligence surface is not equivalent to the documented My Proposals journey; legal title remains separate. |
| Resident / raise common-property issue | My Home & Requests → ticket → juristic/operator action → visible resolution | `/residence`, `/tickets` | Narrow surface exists; common-asset task semantics remain incomplete. |
| Juristic person / govern building common property | Building Operations → resident reports/announcement → responsible work | `/juristic` | Deliberately narrow board; do not grant unit operations by navigation. Common-area work lacks a canonical unit-free task. |
| CRM/sales / answer a lead | My Next Actions → identity, opportunity, proposal → typed downstream transaction | `/app/admin/crm`, `/app/admin/crm/opportunities/[id]`, `src/modules/crm` | CRM is substantial; accepted proposal to booking/order/mandate handoff and CRM event coverage need proof. |
| Revenue/reservations/front desk / sell and receive stays | Pricing & Restrictions / Arrivals & Requests → guarded quote/booking/payment/check-in | `/ops`, `/ops/requests`, `/ops/stays`, `/ops/calendar`, admin tariff editor | Real daily boards and actions; booking response race on main and approval/payment/arrival cross-role evidence are P0. |
| Housekeeper/technician / complete assigned work | My Shift / My Jobs → checklist/problem/evidence → supervisor verification → readiness | `/ops/housekeeping`, `/ops/maintenance`, `/ops/tasks` | Boards use `OperationalTask`; primary nav to housekeeping/maintenance lacks `spaceId` and redirects via `/ops/spaces`, adding a non-sequential step. |
| Marketplace coordinator / resolve exceptions | Orders Requiring Action → replace/refund/escalate → finance | `/app/admin/service-orders`, `/provider`, tickets | Components exist; a unified exception-to-settlement queue was not demonstrated. |
| Finance / close obligations | Reconciliation & Obligations → source drilldown → sign-off/payout → exception cleared | `/app/admin/ledger`, `/app/admin/statements`, `/app/admin/payouts`, `/admin/finance/reconciliation` | Individual writers/views exist; `/ops/night-audit` does not implement daily close classification/sign-off. |
| Founder/admin / decide from exceptions | Needs Attention → project/metric source → assign action → follow-up | `/app/admin`, `/app/admin/processes`, signals/reports | Cross-project dashboards exist; metric dictionary, booking contribution, project P&L, and decision/action loop need source-backed proof. |

`src/modules/core/landing.ts` and `src/app/app/page.tsx` make role surfaces discoverable; they do not themselves prove the permitted action, outcome, or handoff. `src/app/ops/layout.tsx:42-45` exposes specialized operations links, while both `/ops/housekeeping` and `/ops/maintenance` redirect to `/ops/spaces` when `spaceId` is absent.

## 3. Detailed canonical process maps and observed seams

### A. Lead, owner, partner, and supply onboarding — CO01–05, CO23–25; AT16–17, AT20–23

1. **Applicant/customer** enters through `/owners`, `/manage`, `/property/onboard`, `/providers`, or a lead form. Capture source/consent and match one `Identity`; ambiguous matches go to a visible review queue (CO01).
2. **CRM/BD** owns an unassigned or assigned lead, qualifies the actual job, creates a versioned proposal, records a next action, and hands an accepted result to a typed Booking, ServiceOrder, management mandate, or Provider case (CO02–04).
3. **Applicant** saves a six-step property submission. **Onboarding operator** reuses an existing Project/Unit where appropriate, verifies owner/manager authority and media provenance, configures offerings/pricing/operations, and reviews capability-specific readiness before live activation (CO05/24/25).
4. **Provider applicant and network admin** verify organization, coverage, documents, terms and payee, then expose only approved offers (CO23). Every rejection or `needs_information` state returns to the applicant with an owner and next step.
5. **Owner/partner** receives a specific publication or blocker result; no submission creates legal ownership, host tariff authority, or booking write rights by itself.

**Main trace:** `src/app/property/onboard/wizard.tsx:62-104` saves/resumes and distinguishes submitted from converted; `src/modules/projects/property-readiness.ts:91-352` derives blockers including source authority; `/app/admin/properties/[id]/onboarding` reads readiness; provider apply/admin routes exist. **Missing proof:** real media bytes/rights, current mandate, exact Layantara assets, dry-run/replay for bulk import, all six capability gates and a role-run applicant → operator → publication acknowledgment. The owner/manager proposal-to-mandate transition is fragmented across public forms, CRM and contracts. Preserve the existing wizard and readiness engine.

### B. Rates, distribution, agent proposal — CO06–07, CO29; AT18–19, AT25–26; spec §§11–18

1. **Revenue authority** selects exact physical units/categories, previews rate/restriction consequences, approves and atomically versions the canonical `Unit`/`PricingRule` rules. The public, reservation and agent quote must use the same calculation and accepted snapshot.
2. **Channel operator** publishes or explicitly marks rates/availability/restrictions manual, monitors freshness and failures, and routes errors to CO29. iCal occupancy import is not full ARI.
3. **Agent** signs in, sees only contracted Layantara/project stock and terms, creates a shareable proposal, requests/holds one physical unit, receives booking/payment status, and never sees another agent's terms or owner/guest private data.

**Main trace:** pricing breakdown/category quote APIs, tariff editor, category booking token, `src/modules/integrations/channel-health.ts:8-145`, booking channel `agent`. **Gap:** no agent page on `origin/main`; `channel-health` can report `manual_only`, and OTA overlap copy explicitly asks an operator to correct the channel manually. Draft PRs must be reconciled before adding another agent/pricing engine. Production ARI and quote-to-booking parity are not proven.

### C. Guest booking, payment, confirmation — CO07–08; AT18–19, AT28; spec §§19–29

1. **Guest/agent** searches published eligible supply and obtains canonical price and source freshness; the final review freezes dates, party, terms and accepted total.
2. **Booking service** validates authority and unit/category eligibility, uses the shared physical-capacity lock and database overlap constraint, and creates a request or time-bound payment hold. A non-binding request must not consume sold capacity.
3. **Reservations** acts from `/ops/requests` or `/mc/requests`; approval rechecks the current unit/block/source authority and commercial snapshot. **Payment staff/provider callback** records/verifies the required amount according to the accepted policy before confirmation.
4. **Confirmation** creates one durable booking occurrence, guest/agent acknowledgment, operations/pre-arrival work, CRM event and analytics/finance effects with retry-safe delivery. **Guest** returns to Trip Hub; every failure shows pending/declined/expired/requote state.

**Main trace:** `/book/review`, `/api/bookings`, `/checkout/[sessionId]`, `src/modules/booking/booking.service.ts`, `/api/bookings/[id]/respond`, finance provider/cash/bank-transfer seams, `/trips/[id]`. **Observed main P0:** request approval could race a later manual/iCal block and decline could overwrite a competing approval; the separate local branch adds a lock and conditional status update, but its database race assertions have not run. Source code does not establish the whole payment → confirmation → every notification/CRM event contract. Do not count the local patch as main.

### D. Arrival, check-in, stay and front desk — CO08–10, CO13; AT24, AT28–29; spec §§28–33

1. **Guest** sees one contextual pre-arrival checklist for payment, party, passports/TM30 where applicable, ETA, transfer, deposit, unit readiness and access.
2. **Front desk** sees arrivals/departures/in-house/unpaid/guest issues and each blocker with due time, responsible owner and next action; sensitive passport/access data stays scoped.
3. **Host** verifies the configured prerequisites, records identity/condition/access evidence, then moves `Booking` to checked-in. Any override needs actor, reason and audit. **Guest** enters Home Space and can request help or order services.
4. **Request intake** creates one typed ticket/task/service order with acknowledgment/SLA, departmental owner, execution and guest-visible resolution.

**Main trace:** `/ops` Today board, `/ops/stays/[bookingId]/check-in`, `/bookings/[bookingId]/passports`, `/bookings/[bookingId]/home-space`, `src/modules/booking/lifecycle.jobs.ts`, `src/modules/booking/work-projection.ts`, `src/modules/ops/operational-task.service.ts:51-66`, tickets. Source enforces at least a turnover readiness check before check-in. **Gap:** full derived arrival readiness across payment/access/TM30/maintenance, user-visible blockers and all notification/event delivery have not been traced or run end to end. Scheduler preflight is failing in the recorded GitHub run, so scheduled reminders are not operationally evidenced.

### E. Service order, provider fulfillment and exception — CO03, CO10, CO13–14, CO17, CO19, CO23; AT01–15; spec §§39–40

1. **Customer/guest/owner** selects a real eligible service in standalone address, stay, owned-home or managed-property context. The UI states instant, confirmation, quote, concierge or referral mode and uses typed quantity/duration/capacity.
2. **Provider/coordinator** accepts a versioned offer/quote; order creation stores accepted terms, collector, price/cost/commission, resource/capacity and payment obligation. For quote mode: `QuoteRequest → QuoteVersion → acceptance → ServiceOrder`.
3. **Provider** accepts/declines, performs work, records evidence and fulfillment; customer confirms or disputes within the accepted window. Decline/no-show/cancel/reschedule/retry produces one valid financial outcome and a visible replacement/refund queue.
4. **Finance** recognizes earning only from valid fulfillment, applies refunds/disputes/late adjustments, allocates one payable/receivable once, and exposes provider remittance source lines.

**Main trace:** `/services/[id]`, `/api/service-orders`, `/provider`, `/provider/remittances`, `src/modules/services/service-order.service.ts`, finance remittance/ledger services. **Concrete disconnected path:** `ServiceQuoteRequest` and `ServiceQuoteVersion` exist in `prisma/schema.prisma:3599-3644`, but the scoped source search found no quote service/UI handler; `src/app/services/[id]/order-wizard.tsx:100-127` sends quote-priced guests to WhatsApp/messages and `src/app/api/service-orders/route.ts:65-67` rejects direct quote orders. This is an honest manual fallback, not a canonical accepted quote or trackable commercial handoff. The in-stay service → source-backed project P&L loop is not proven by a route or test name.

### F. Housekeeping, maintenance and common assets — CO11–12, CO15, CO18, CO20; AT24; spec §§34–38, 48

1. **Checkout** creates turnover cleaning with booking/unit/due time. **Housekeeper** sees only assigned My Shift work, starts/checks/evidences it, reports a blocker, and completes the task.
2. **Supervisor** inspects and either fails to remediation or passes. Derived readiness remains blocked by critical maintenance, safety, access or restocking work even if cleaning passes. A next-arrival risk becomes an owned exception.
3. **Technician** triages reactive or scheduled work, records impact/block, estimate, required owner/budget approval, parts/vendor, repair and verification; inventory block is released only after verification plus all other readiness conditions.
4. **Manager/juristic** assigns reception, grounds, shuttle, common pool, utilities and safety work to project/common assets without inventing a villa; cost and procurement evidence flow to finance.

**Main trace:** `/ops/housekeeping`, `/ops/maintenance`, `/ops/tasks`, `src/modules/ops/operational-task.service.ts`, `PreventiveMaintenancePlan`. Housekeeping read model explicitly prioritizes blocking maintenance before clean/ready. **Concrete gap:** `prisma/schema.prisma:2385-2413` requires `OperationalTask.unitId`; the canonical task cannot represent a common project asset without a fake villa. `src/app/ops/layout.tsx:42-45` links to `/ops/housekeeping` and `/ops/maintenance` without `spaceId`, while those pages redirect to `/ops/spaces` if absent. Procurement/owner estimate approval is not a first-class task-to-invoice workflow in the inspected source. Avoid duplicating `OperationalTask` to fix these gaps.

### G. Modification, cancellation, checkout and deposit — CO15–17, CO21; AT09, AT14, AT24; spec §§41–48

1. **Guest/agent/operator** requests extension, reschedule, party or unit change; server uses accepted policy and canonical repricing, reserves replacement capacity before releasing old, coordinates payment/refund delta, records before/after/reason, then replans services/tasks and notifies affected roles.
2. **Cancellation** applies the accepted policy snapshot and commits booking state plus inventory release; refund obligation and channel/agent/CRM consequences follow once, with a failed-refund queue.
3. **Departure** checks balance and service obligations, captures condition evidence, makes a separate damage/deposit decision, checks out, revokes access where applicable, opens turnover, and later closes financial obligations. Owner stay uses the same physical capacity.

**Main trace:** `/api/bookings/[id]/modify`, `/cancel`, `/checkout`, `/api/owner-stays`, `BookingReschedule`, condition/deposit claim routes, `src/modules/finance/deposits.service.ts`, owner stay turnover module. There are targeted integration test files for date change, reschedule, refund and deposit paths, but this audit did not run them. Full reverse-path event/notification/CRM and seasonal quote parity remain unverified.

### H. Financial close and leadership controls — CO18–20, CO30; AT13–15, AT30; spec §§49–63

1. **Each source event** posts or references an immutable, dated, currency-explicit financial consequence with project/unit/booking/order/channel/category dimensions and source evidence. Booking contribution and Project P&L are derived read models with drilldown; recorded cost absence is `not recorded`, not assumed zero.
2. **Daily close operator** selects project/day, reconciles bookings, occupancy, payments, cash/transfers, refunds, services, costs, deposits, outstanding balances and external occupancy. Controls classify blocking/warning/informational; a blocking exception keeps day open with an owner.
3. **Finance** reconciles refunds/receivables/payables, generates statements from the correct contract period, signs off, records one payout allocation, and carries late adjustments into a later period. **Owner/provider** sees statements/remittances, not editable ledger truth.
4. **Founder** sees source-backed occupancy, ADR, revenue vs cash, costs, contribution, project operating result, obligations and exceptions, makes an assigned decision, and follows it to closure across projects.

**Main trace:** ledger/statement/payout writers, owner/provider reporting and `/admin/finance/reconciliation` exist. `src/app/ops/night-audit/page.tsx:43-91` reads arrival/departure/in-house counts, ledger entries and open tasks, then explicitly calls itself a read model at line 110; it has no daily-close state, blocking/warning classification or sign-off command. `src/modules/workflows/property-to-financial-close.integration.test.ts` is a useful fixture from one booking through statement, but its test was not executed here and it does not prove the complete §§59–60 controls or contractual Layantara waterfall. The management contract data, real cost completeness, payout and backup/restore remain unverified; do not automate an unapproved waterfall.

### I. CRM, buyer, ownership, staff and resident governance — CO01–04, CO20–28; AT20–23, AT27–28

1. **CRM** links source/consent to one Party, assigns a next action, versions proposal/acceptance and creates a typed downstream transaction; domain events update CRM without staff rekeying guest data. Agent attribution is scoped.
2. **Buyer** sees a shared shortlist/proposal/viewing/diligence state. Admin `PropertyDeal` records signed/closed agreement evidence; only separately verified legal title updates `OwnershipPeriod`. Management mandate and operator changes have effective dates and historical payout preservation.
3. **Admin/manager** invites, grants exact scope, revokes sessions/work assignments, and records audit. **Resident/juristic** reports/governs common property without gaining unit booking, pricing or owner-finance powers. **Owner** gets an estimate-versioned approval before capex.
4. **Offboarding** inventories future guest/owner obligations, disables new sales, hands over data/work, revokes scope, reconciles money and archives without erasing history.

**Main trace:** public lead form/CRM routes, `src/modules/crm/property-deal.service.ts:5-170`, `/buying`, `/juristic`, `/residence`, role grant/revoke APIs. `PropertyDeal` correctly keeps legal title separate. `/buying` says purchase is handled with an external team and supports inquiry, which is an honest partial boundary; no buyer My Proposals sequence was found. Capex appears as a CRM opportunity type but not an estimate approval → procurement → cost chain in this scoped search. Staff revoke/reassignment and end-to-end offboarding need execution/evidence.

### J. Integration recovery and release — CO29–30; AT25–26, AT30

1. **System** records source/environment ID, inbox/outbox event, version/checkpoint, retry attempt and lag; affected capacity/payment remains pending or fail-closed if authority is unavailable.
2. **Integration operator** sees one exception, reconciles exact source IDs, replays idempotently, records recovery/RCA and returns the originating booking/service/finance process to its owner.
3. **Release operator** confirms migration parity, signed Layantara authority boundary, verified backup and scratch restore, monitored scheduler and role/runtime tests before any new writer/reader cutover.

**Main trace:** Layantara adapter/inbox/checkpoint services and admin integrations/scheduler screens exist. The recorded GitHub scheduler run `37710252282` failed configuration preflight (`APP_BASE_URL`, `CRON_SECRET` absent); backup run `37705986597` failed preflight (`BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` absent). Neither proves dispatch, dump, restore or replay. Production data parity and signed cutover evidence were not available to this audit. The uploaded §66 audit requirement remains truncated after `reason`.

## 4. CO01–CO30 source maturity score

This is a **process evidence score, not a production readiness certificate**. Each CO process receives 0–4 points on the audited main SHA: **0** = no source path found; **1** = fragments/models/screens exist but the canonical transition or handoff is not connected; **2** = an actor can reach a canonical command and see a result in source, but a required part of the full passport is missing or unproven; **3** = current-SHA critical positive/negative/concurrency tests actually passed and the role handoff was exercised; **4** = the complete role journey was observed on deployed target data/config, including exception/recovery. Documentation alone adds no point. An unexecuted test file adds no point. No flow qualifies for 3 or 4 in this read-only audit.

| CO | Process | Score | Main evidence / limiting seam |
| --- | --- | ---: | --- |
| 01 | Lead intake | 2 | Lead form/API/CRM; dedup, consent and owned SLA handoff unrun. |
| 02 | Qualification/conversion | 1 | CRM opportunities and `PropertyDeal`; generic accepted result → typed downstream transaction not shown. |
| 03 | External partner sourcing | 1 | Provider/prospecting fragments; partner term/commission-to-fulfillment path not shown. |
| 04 | Owner acquisition | 1 | Owner/manage entry and contracts; verified mandate handoff not traced. |
| 05 | Property onboarding | 2 | Six-step submission, admin readiness; live data and full applicant/owner proof absent. |
| 06 | Rate/distribution | 2 | Tariff/quote writer, channel-health; ARI synchronization/recovery manual or unproven. |
| 07 | Booking | 2 | Guest/ops command path; main approval/block race, local fix not DB-tested. |
| 08 | Pre-arrival | 1 | Trip/ops/jobs; one derived multi-factor Arrival Readiness not shown. |
| 09 | Check-in | 2 | `/ops/stays/[bookingId]/check-in`, booking transition/readiness check; full prerequisite set unrun. |
| 10 | In-stay request | 2 | Ticket/task/service route and ops action; SLA/guest close-loop unrun. |
| 11 | Housekeeping | 2 | Task board/checklist/readiness; inspector/rework/next-arrival sequence unrun. |
| 12 | Maintenance | 2 | Task board/preventive plan; common asset/approval/cost-to-block seam incomplete. |
| 13 | F&B | 1 | Generic services; configured food supply, dietary data and stock/money path not shown. |
| 14 | Service order | 2 | Order/provider/finance commands; quote mode routes out to manual communication. |
| 15 | Checkout | 2 | Booking checkout, condition/deposit and turnover components; whole handoff unrun. |
| 16 | Cancel/reschedule/extension | 2 | Booking modify/cancel and `BookingReschedule`; full funding/notification parity unrun. |
| 17 | Complaint/dispute | 2 | Ticket/dispute/deposit/service seams; race/finance remedy not executed. |
| 18 | Procurement | 1 | Cost entry exists; requisition → approval → receipt → payable not shown. |
| 19 | Financial close | 1 | Statement/payout/reconciliation and read-only daily view; no controlled daily close. |
| 20 | Owner approval/capex | 1 | CRM capex type/owner context; versioned estimate decision-to-work not shown. |
| 21 | Owner stay | 2 | `/api/owner-stays` and owner action; contract charge/turnover negative paths unrun. |
| 22 | Staff lifecycle | 1 | Role/team grant/revoke fragments; session/task reassignment loop not shown. |
| 23 | Provider lifecycle | 2 | Apply/admin approval, offers/orders; real vetting/payee/runtime unverified. |
| 24 | Content/media | 2 | Admin project/unit media and readiness; rights, locale and actual-byte coverage unverified. |
| 25 | Standards | 1 | Compliance/checklist surfaces; versioned reassessment/public endorsement not shown. |
| 26 | Guest-to-owner | 1 | Buyer inquiry and admin `PropertyDeal`; proposal/diligence/title handoff partial. |
| 27 | Ownership/operator change | 1 | Ownership/contract models; effective-date access/settlement cutover unrun. |
| 28 | Offboarding | 1 | Status/revoke/finance pieces; obligations-to-archive process not shown. |
| 29 | Integration recovery | 1 | Inbox/checkpoint/admin screens; scheduler preflight failed and replay unproven. |
| 30 | Leadership review | 1 | Admin dashboard/process board; source-backed metric decision/follow-up loop not shown. |

**Result: 45 of 120 possible points = 37.5%, rounded to 38/100, for evidence-backed process maturity on main.** Fifteen rows score 2 and fifteen score 1. This describes how much of the canonical process can be supported by the inspected source and evidence; it is deliberately capped by missing executed acceptance and runtime evidence. It does **not** mean 38% of code exists, that production is 38% safe, or that a missing test failed. The P0 gates below override any composite score.

Nine-dimension release view for these processes: specification is largely present; code and UI are partial; migration-applied status, live data/config and exact permission coverage are not checked; current-SHA critical CO/AT suites were not run in this audit; Vercel metadata says the audited main SHA was READY, but individual deployed flows and runtime behavior were not observed. The local booking branch adds source-level safeguards only, with no migrated isolated-DB race pass or production evidence. `outputs/FLOW_MATRIX.md` is the companion CO/AT nine-dimension ledger; its many `N` entries should remain `not checked` until direct evidence is collected.

## 5. Findings ordered by risk

### P0 — correctness and release gates

1. **Booking decision race on main (CO07, AT18–19).** Approval and manual/iCal block could claim the same nights; decline could overwrite approval. The local branch repair must pass isolated PostgreSQL races, foreign-scope and stale/requote tests, then be reconciled with overlapping PR #194 before merge. Do not infer a passed assertion from an authored test.
2. **Scheduler and backup/recovery are not operationally evidenced (CO29, AT30).** Recorded GitHub workflows failed required-config preflight. Supply the Next.js app origin (not the Supabase host), matching cron secret, protection bypass where required, and backup credentials through approved secret management; prove monitored dispatch, dump, scratch restore and external side-effect reconciliation. No preview or unsafe cutover.
3. **Layantara single-writer and data parity remain a cutover gate (CO05–07, CO29; AT25–26).** Reconcile exact physical units/categories, future occupancy, bookings/payments, media bytes, tariff Golden Master, source authority, signed writer freeze and replay. Documentation or a config flag is insufficient for a fresh production claim.
4. **Agent P0 route absent on main (CO06–07; spec §§16–18).** Reconcile #189/#191/#192 before building one scoped Agent Workspace. Acceptance: authorized live quote/proposal/share/request/booking/payment-status for one real test agent, negative cross-agent terms test, no independent rate engine.
5. **Daily close controls are absent from the read-only Night Audit view (CO19, §§59–60).** Define immutable business-day facts and blocking/warning/informational controls, then implement exception ownership, sign-off and source drilldown using existing booking/finance writers. Do not treat a ledger sum as a balanced day or use an unapproved Layantara waterfall.

### P1 — broken sequence or missing first-class workflow

1. **Quote-priced services leave the canonical commerce path (CO14, AT04/06/13).** Wire the existing `ServiceQuoteRequest`/`ServiceQuoteVersion` schema to request, operator response, version acceptance and `ServiceOrder` with immutable terms; WhatsApp can share the quote link, not hold accepted price as the only record.
2. **Long-stay project CTA opens WhatsApp without a structured transaction (CO01–02, CO26).** Preserve the existing project-scoped lead form, then ensure CTA context and consent become a typed CRM opportunity/next action with a visible reply state. The WhatsApp channel may remain optional.
3. **Common infrastructure cannot use the canonical task as modeled (CO12/18, §38).** Add explicit project/common-asset scope while preserving unit tasks and cost attribution; migrate safely and test access/block behavior without fake Units.
4. **Housekeeper/technician first-screen navigation adds a context detour.** Carry authorized `spaceId` or select a permitted space on the destination, then show assigned work immediately. Test empty, forbidden and resumed task states on mobile.
5. **Owner approval and procurement are fragmented (CO18/20).** Add versioned estimate → threshold/owner decision → work/PO/receipt → cost/statement line on existing task and finance writers. Keep unapproved cost decisions pending.
6. **CRM, buyer and ownership handoffs are partial (CO02/26–28).** One Party, typed accepted result, proposal/viewing/diligence states, separate legal title evidence, effective-date rights and offboarding obligations need a guided next-action path. Preserve the honest off-platform legal boundary.
7. **Arrival and service exceptions need one owned status (CO08–10, CO14).** Consolidate derived pre-arrival blockers and provider decline/no-show/failed-payment/refund queues into actor-specific `Today` surfaces with retry and return-to-customer path.

### P2 — clarity, coverage and scale

1. Publish one formula and source dictionary for occupancy, ADR, revenue versus cash, booking contribution, project operating result, owner/operator obligations and refresh cadence. Every KPI drills to permitted source records.
2. Check EN/RU/TH meaning, mobile/keyboard, slow network, stale, partial, forbidden and expired states on one representative journey per role (AT29). A content key or route is not a visual/interaction pass.
3. Consolidate workspace navigation around each role's first job while preserving the existing canonical writers. Distinguish unavailable supply or missing data from genuine empty state and provide explicit resume/next-action links.
4. Measure onboarding time, exception age, channel lag, job backlog and quote/booking parity across different property types before expanding destinations or creating new service boundaries.

## 6. Execution order and acceptance gates

1. **Prove safety on the current code line.** Refresh main/PR/deploy refs, run migrated isolated PostgreSQL booking/service/finance negative and concurrency suites, reconcile #194, validate schema/migration replay, and inspect the final diff. Keep main and local branch results separate.
2. **Restore operations/recoverability.** Make scheduler and backup workflows green with actual dispatch and scratch restore evidence; document RPO/RTO and payment/webhook reconciliation. No Layantara authority change until the signed cutover packet passes.
3. **Complete the first revenue loop.** One authorized agent and one direct guest: search → same canonical quote → request/hold → policy payment → confirmed booking → notification/pre-arrival → staff action. Verify AT18–19, 25–26, 28 and role-specific UI results.
4. **Complete one stay and service loop.** Arrival readiness → check-in → in-stay extra cleaning order → fulfillment/dispute option → checkout → condition/deposit → turnover/inspection → owner/provider/finance result. Verify AT01–15/24 with negative and retry paths. Do not activate unsupported supply to fabricate success.
5. **Close and explain the money.** Reconcile daily exceptions, booking contribution and project operating result from canonical lines; sign off statements/payouts with current verified contract terms. Make missing costs explicit.
6. **Complete acquisition and governance.** Owner/manager/provider onboarding, CRM next-action handovers, buyer proposal/diligence, effective ownership/operator changes and offboarding, then role/mobile/localization checks across the full CO01–CO30 / AT01–AT30 matrix.

**Current decision:** the source demonstrates meaningful platform foundations, but the complete canonical operating loop is not verified. This audit does not authorize merge, production publication, preview deployment, migration, Layantara writer cutover, or a claim that any CO process is production ready. It provides a source-backed sequence of work and the evidence required to change that conclusion.
