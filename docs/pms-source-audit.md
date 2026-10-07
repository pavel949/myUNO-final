# PMS source and navigation audit — 2026-10-08

Assessment baseline: `pavel949/myUNO-final`, main `e92f4a0080ac97698e77ad7b11f70170dfd0455d`. Scope: source routes, surfaces, role gates, linked workflows, operational scope, structural layout, single-unit/condominium/resort use. Read-only assessment; no PMS code, data, role, reservation, financial or deployment mutation performed by this audit worker.

**Verdict:** substantial PMS screens and canonical workflows exist. Source evidence does not support calling the system fully usable for a whole resort or all delegated manager roles. Several ordinary navigation paths discard operational context or lead to staff/admin-only screens. These are broken journeys, not evidence that every target screen is absent. Production usability and resort cutover remain **not assessable from this source audit**.

## Method and evidence limits

- Read repository entry point, canonical specification pack and PMS architecture/audit companions.
- Ran `npm run audit:inventory`: 160 pages, 227 handlers (224 API), 22 modules, 115 Prisma models, 77 migrations, 304 test files, zero static route collisions.
- Source inventory found 24 `/ops` pages, 10 `/mc` pages and four `/owner` pages. Grouped inventory below covers every discovered `/ops` and `/mc` page.
- Ran focused existing tests: **5 files, 17 tests passed** (`projectScope.test.ts`, `projectScope.null-project.test.ts`, `UnifiedStayCalendar.test.tsx`, `pms-operations-expansion.test.ts`, `pms-touch-targets.test.ts`). These are unit/schema/fixture UI tests, not a authenticated production role or workflow exercise.
- Production session, real data, migration application, OTA credentials, source authority, actual pricing configuration and screenshots were not available to this source worker. Runtime observations belong in the companion runtime audit. No screenshot-based overlap claim is made here.
- Existing main/open-PR/deployment reconciliation is owned by the coordinating task. Findings reference this exact baseline and must be marked resolved separately if code subsequently changes.

## Current surface inventory

| Job | Existing routes | Source assessment |
|---|---|---|
| Staff Today | `/ops` | Project switcher, arrivals/departures, requests, money exceptions, services, tickets, mobilization and SLA. Header offers 11 equal actions; section links often omit project context. |
| Managed company Today / portfolio | `/mc`, `/mc/portfolio` | MC scopes select one project+organization; Portfolio compatibility route targets managed property section. Cross-project calendar exists, but Today is one chosen scope even when subtitle says across portfolio. |
| Occupancy / unit override | `/ops/calendar`, `/ops/calendar/board`, `/ops/calendar/[unitId]`, `/mc/calendar`, `/mc/units/[unitId]` | Compatibility routes converge on shared calendar; grid is read-only with canonical unit mutation panel. MC unit legacy route targets Property Workspace. |
| Operating space | `/ops/spaces`, `/ops/spaces/[spaceId]` | Resort, condo-managed subset and portfolio grouping use actual physical units; membership capabilities control cards. Several targets use different authorization systems or do not retain space. |
| Unit workspace | `/mc/properties/[unitId]`, `/ops/units/[unitId]/edit`, `/ops/projects/[id]/edit` | 11 tabs: overview, calendar, reservations, operations, rates, channels, financials, owner, property, media, activity. Facts/media editor exists. MC-only booking drilldown breaks. |
| Reservations / requests | `/ops/reservations`, `/ops/requests`, `/mc/requests` | Manual reservations and reservation groups exist in operating space; requests have inbox. Sidebar has Requests but no direct Reservations; navigation depends on Workspaces. |
| Stay lifecycle | `/ops/stays`, `/ops/stays/[bookingId]`, `/ops/stays/[bookingId]/check-in` | Department queue, stay detail, folio and guided check-in exist. Staff department gate excludes MC-only manager linked from property workspace. |
| Cleaning / maintenance / tasks | `/ops/housekeeping`, `/ops/maintenance`, `/ops/tasks` | Readiness cards, task queue and preventive plans exist. Dedicated cleaning/maintenance require spaceId; sidebar does not provide it. Maintenance open-task cards are informational only. |
| Mobilization | `/ops/mobilization`, `/ops/mobilization/[unitId]`, `/mc/mobilization`, `/mc/mobilization/[unitId]` | Existing onboarding execution surfaces; separate from daily PMS tasks. Production data/state progression not checked. |
| Costs / claims / compliance | `/ops/costs`, `/mc/costs`, `/ops/claims`, `/ops/tm30`, `/mc/tm30` | Existing scoped recording/claims/TM30 surfaces; submission and accounting correctness not exercised. |
| Team / daily close | `/ops/team`, `/ops/night-audit` | Project onsite-host assignment exists; not operating-space team manager. Daily reconciliation exists; advanced finance target is admin-only. |
| Add inventory | `/ops/new-unit` | Form exists, separate from property editor; data/authority/launch readiness not checked. |
| Owner continuity | `/owner`, `/owner/units/[unitId]`, `/owner/statements`, `/owner/statements/[statementId]` | Own assets/statements exist outside operator shell. Ownership isolation and actual statement money not runtime verified. |

## Broken journeys and concrete evidence

| ID / priority | Trigger and observed source result | Exact evidence | Required repair |
|---|---|---|---|
| PMS-01 / P1 | Click Housekeeping or Maintenance in staff sidebar → `/ops/spaces`, instead of named screen. | `src/app/ops/layout.tsx:42–43`; housekeeping page:16–17, maintenance page:17–18 require `spaceId`. | Preserve selected space in shell or explicitly offer scope selection before opening. |
| PMS-02 / P1 | Open calendar from Operating Space, change date/range/project/category → new URL omits `spaceId`; view becomes entire authorized portfolio/project. This is scope confusion, not established unauthorized access. | `src/app/ops/calendar/board/page.tsx:36–45` reads space; `src/components/ops/UnifiedStayCalendar.tsx:34–49,84–94` has no space prop/query. | Carry space through every filter, date navigation, inspection/task/unit/back link and refresh path; validate intersected authority server-side. |
| PMS-03 / P1 | MC-only manager opens current stay, next arrival or Open booking inside Unit Workspace → staff-only Stay 360 returns not-found. | `src/app/mc/properties/[unitId]/page.tsx:282,289,340`; `/ops/stays/[bookingId]/page.tsx:37–39`; `src/app/libs/projectScope.ts:4,149–164`. | Canonical stay reader must allow matching active MC managed-unit authority with appropriate capabilities; do not grant blanket staff access. |
| PMS-04 / P1 | Operating Space Finance & reports → admin ledger. Non-admin finance member goes home; admin ledger ignores spaceId and defaults to first project. | Space home:127; admin layout:12–18; admin ledger page:10–24 accepts only project/date filters. | Scoped finance read model in PMS or correct scoped existing finance route; retain admin write separation. |
| PMS-05 / P1 | Operating Space Team → project onsite-host assignment. `spaceId` is ignored; MC-only space manager has no staff project grant and returns `/ops`. | Space home:126; `src/app/ops/team/page.tsx:10–26,28–50`. | Expose operating-space teams/members/capabilities through their canonical membership workflow or truthfully name the project-only surface. |
| PMS-06 / P1 | Pricing / Channels cards both open read-only occupancy calendar. `channel=attention` is never read; no scoped channel configuration screen or direct category tariff editor is offered. | Space home:125,128; calendar SearchParams:19–29; `AvailabilityPricingPanel.tsx:10–16,62` is one-unit override editor. | Link pricing to category master rates/restrictions with unit inheritance, and channel card to scoped health/settings; avoid pretending monitoring is management. |
| PMS-07 / P2 | Navigation away from chosen project or space resets context: shell links are bare URLs; Stay 360 Back drops project/space; calendar Front Desk drops scope. | Ops layout:37–46; MC layout:25–32; Stay 360:90; UnifiedStayCalendar:157,172. | One explicit current work scope carried by canonical navigation helpers; switch scope only through visible selector. |
| PMS-08 / P2 | MC Today says across portfolio but loads first/matching project+organization; no all-scopes Today option. | `src/app/mc/page.tsx:36–45,80,94`; `/mc/portfolio` selects one scope for dashboard. | Clear selected-project heading; add authorized all-managed Today summary using shared scope readers when supported. |
| PMS-09 / P2 | Maintenance open tasks have status/due information but no task-open or actionable queue link. | `src/app/ops/maintenance/page.tsx:97` renders plain articles; Task queue does exist. | Each task card should open exact task in scoped queue; preserve space and unit. |

No P0 exploit, financial corruption or double-booking has been demonstrated by this source-only audit. This does not mean those classes were verified safe.

## Structural UX and component quality

| Area | Source finding | Improvement / verification needed |
|---|---|---|
| Navigation density | Shared MC shell has 248px desktop rail (`StitchShells.tsx:64`), then MC dashboard renders another 228px rail (`mc/client.tsx:634–635`). | Use one persistent rail; move view tabs into work area. Screenshot 1024/1280/1440 widths before changing layout. |
| Tabs/localization | 11 MC property tabs, group labels and most workspace copy are literal English; raw tab names rendered with capitalization; active tab lacks aria-current (`properties/page.tsx:264–275`). | Registry labels for RU/EN/TH; grouped progressive navigation; active semantics and long-string mobile tests. |
| Sticky layout | Global Navbar and workspace sidebar both `sticky top-0 z-40` (`Navbar.tsx:150`, `StitchShells.tsx:64`). | Measure actual DOM/screenshots before alleging collision; align offsets with persistent header height. |
| Calendar scanning | First unit column sticky; date header is plain `<thead>` with no vertical sticky positioning (`UnifiedStayCalendar.tsx:300–314`). | Sticky date header in defined scroll container; ensure overlays/header/column layers do not occlude cells. |
| Mobile calendar | Dedicated compact day agenda exists; desktop wide grid hidden below md. | Positive source structure, but not proof of real mobile usability or Thai/Russian wrapping. |
| Task status copy | Housekeeping state and maintenance task status are raw enum strings with underscores replaced (`housekeeping/page.tsx:92–94`, maintenance:97). | Translate statuses through enum-label registry and retain consistent chips. |
| Entry hierarchy | Staff Today header has 11 equal links above Needs Attention (`ops/page.tsx:308–349`); MC has competing outer navigation, inner navigation and unit tabs. | One main action per current job; place setup/admin options in secondary menu. |
| Financial meaning | MC financials is bounded ledger/statement summary, not complete reconciliation/settlement; Channels is health projection, not verified external ARI. | Name capabilities honestly and link real exception resolution. Do not fabricate adapter health, price or money. |

## Single unit, condo portfolio and resort assessment

| Scenario | Source-supported jobs | Gaps preventing a full usability claim |
|---|---|---|
| One delegated unit | Facts/media, availability blocks/unit rate override, canonical quote preview, bookings/readiness/tasks, owner/financial summary. | MC booking detail denial; no verified production authority/data; settings spread across tabs/edit/calendar. |
| Managed units in one condominium | Active MC engagement limits units; shared calendar supports category/unit/project filters. | Scope lost on shell/date links; team/finance cross different authority systems; category pricing not reachable as an ordinary PMS workspace job. |
| Whole Layantara resort | Operating Space grouping, reservations/groups, housekeeping/readiness, maintenance, tasks, calendar, team concepts in schema. | Reachability defects above; actual 39 villas/8 categories/rates/bookings/source authority and rollback not checked; read-only projection does not prove resort cutover. |
| Multiple managed properties | Shared calendar can span authorized MC engagements across projects. | Today only one project+organization, global task links drop selected scope, no complete portfolio finance/job smoke evidence. |

## Readiness dimensions

Values below apply only to this source assessment. A route existing is not UI/runtime acceptance.

| Capability | Spec | Code | Migration | Data/config | Permission | UI reachability | Critical tests | Deployed | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| Shared calendar | verified | verified | not checked | not checked | partial | partial | partial | not checked | not checked |
| Unit workspace | verified | verified | not checked | not checked | partial | partial | not checked | not checked | not checked |
| Reservation/stay lifecycle | verified | verified | not checked | not checked | partial | failed for MC-only drilldown | not checked | not checked | not checked |
| Housekeeping/maintenance | verified | verified | not checked | not checked | partial | failed sidebar path | partial schema | not checked | not checked |
| Rates/distribution | verified | partial | not checked | not checked | not checked | partial | not checked | not checked | not checked |
| Team/finance for space | verified | partial | not checked | not checked | partial | failed delegated targets | not checked | not checked | not checked |
| Layantara operational cutover | verified | partial | not checked | not checked | not checked | partial | not checked | not checked | not checked |

Relevant CO processes inspected at route/source level: CO05/06/07/08/09/10/11/12/15/18/19/20/21/22/24/27/28/29/30 are **partial or not checked**, never runtime verified. CO01/02/03/04/13/14/16/17/23/25/26 are outside this focused source assessment and **not checked**. All AT01–AT30 full E2E acceptance scenarios are **not checked** by this worker; focused unit tests must not be substituted for them.

## Repair order and runtime acceptance

1. Fix context propagation and ordinary broken links without widening authority.
2. Make MC Stay 360 and Operating Space team/finance routes agree with canonical delegated permissions; test two disjoint MC managers and staff departments, expired/revoked engagement, non-admin finance role and owner.
3. Provide clear category tariff entry and channel exception resolution; compare exact preview to canonical guest quote for same dates/party/rate plan.
4. Reduce duplicate rails and localize all actual task/tariff/status controls; inspect desktop/mobile with real long names and RU/TH copy.
5. Run authenticated resort smoke: Today → selected space → reservation → check-in → turnover → task inspection/readiness → checkout; no financial or inventory mutation without intended test fixtures and verified authority.
6. Reconcile live Layantara unit/category/source occupancy/rates and migration state before any resort operating go-live assertion. Keep source PMS authority unless explicit cutover evidence says otherwise.

Code/branch readiness: **partial**, concrete P1 navigation/workspace defects identified. Real deployed operating readiness: **not assessable from source**, authenticated runtime evidence and actual data/configuration required.
