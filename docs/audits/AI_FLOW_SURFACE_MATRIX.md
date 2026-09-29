# AI Flow / Surface / Canonical Writer Crosswalk

**Status:** audited locator index against main 4a8ed81b24aee51020486fc049e9ef0af329ffd8 (2026-09-29), NOT a pass report.  
All paths are discovery anchors, not proof of reachability, authorization, deployment, complete process or correct writes. Rebuild from the current HEAD with npm run audit:inventory and trace each flow. Normative transitions: docs/canonical/PROCESS_MAP.md and PROCESS_PASSPORTS.md; test contract: READINESS_ACCEPTANCE.md.

## A. Entry points and role workspaces

| Audience / intent | Candidate public or workspace UI | API/domain anchor to trace | Special acceptance |
|---|---|---|---|
| General discovery | /, /projects, /projects/[slug], /search, /units/[id] | src/modules/projects/public.service.ts; src/modules/core/availability.service.ts; src/app/api/search | Honest scope, source freshness, quote parity; homepage CTA destination |
| Guest booking | /book/review, /checkout/[sessionId], /trips, /trips/[id] | src/modules/booking/booking.service.ts; src/app/api/bookings; src/modules/finance | Quote snapshot → DB allocation → payment/confirmation → Trip |
| Guest stay support | /bookings/[bookingId]/home-space, /tickets, /messages | src/modules/booking/home-space.service.ts; src/modules/comms | Own stay only; access instructions not prematurely released |
| Standalone services | /services, /services/[id], /services/orders | src/modules/services/service-order.service.ts; src/app/api/service-orders | No fake project/booking; provider, price, terms and confirmation truthful |
| Owner | /owner, /owner/units/[unitId], /owner/statements | src/modules/projects/owner.service.ts; src/modules/finance | Effective ownership and financial isolation |
| Property manager | /mc, /mc/calendar, /mc/requests, /mc/units/[unitId], /mc/mobilization | src/modules/projects/mc.service.ts; src/modules/ops | Project scope, one calendar/booking writer, team tasks |
| Frontline operations | /ops, /ops/calendar, /ops/requests, /ops/tm30, /ops/costs | src/modules/ops; src/modules/booking | Today work / exceptions, not generic analytics |
| Provider | /provider/apply, /provider, /provider/services, /provider/remittances | src/modules/services/provider.service.ts; src/modules/finance/remittance.service.ts | Own offers/orders only |
| Buyer | /buying, /buyers, /app/admin/crm/opportunities/[id] | src/modules/crm; src/modules/analytics/buyer-interest.service.ts | CRM stage does not create contract or legal title |
| Platform admin | /app/admin; /app/admin/projects, /units, /people, /providers, /ledger, /payouts | src/modules/core/permissions.ts; src/modules/audit; admin APIs | Exceptional oversight; audited privileged writes |
| Project onboarding | /app/admin/properties/new; /app/admin/properties/[id]/onboarding; /app/admin/units/[id] | src/modules/projects/property-readiness.ts; admin project/unit/media APIs | Resume, legal authority, gallery scope, per-offering capability gate |
| Financial close | /app/admin/ledger, /app/admin/statements, /app/admin/payouts, /admin/finance/reconciliation | src/modules/finance | Correct payer/beneficiary and no double payout |

## B. CO01–CO30 process-to-code investigation matrix

For every row locate actual page component → API/command → service → Prisma table(s) → permission → test → event. “Candidate anchor” is intentionally non-assertive.

| Process | Candidate UI / API anchor | Service / canonical fact to inspect | Failure/success evidence to demand |
|---|---|---|---|
| CO01 lead intake | /app/admin/crm; /api/leads; /api/crm | crm, comms lead service; Identity/CrmProfile | Dedup, attribution, consent, assigned next action |
| CO02 qualify/convert | /app/admin/crm/opportunities/[id] | crm, CrmOpportunity/Activity | Accepted version and typed downstream handoff |
| CO03 partner sourcing | /app/admin/prospecting; /app/admin/providers | prospecting, provider/service | External authority; snapshot of partner economics |
| CO04 owner acquisition | /owners; /app/admin/contracts | crm, project engagement/contracts | Verified mandate not inferred from lead |
| CO05 property onboarding | /app/admin/properties/new; /app/admin/properties/[id]/onboarding | projects/property-readiness, Project/Unit/InventoryCategory | Autosave, imports, owner, gallery, capability-specific blockers |
| CO06 rate/distribution | /mc/calendar; /app/admin/units/[id]; /api/pricing | core/canonical-pricing, integrations; RatePlan/PricingRule | Same quote, version, ARI push/fallback |
| CO07 booking | /search; /units/[id]; /book/review; /checkout/[sessionId] | booking, availability, finance; Booking/Payment | Overlap DB guard, hold, immutable quote, idempotency |
| CO08 pre-arrival | /trips/[id]; /ops; /mc | booking/lifecycle.jobs, ops | Arrival prerequisites and responsible blockers |
| CO09 check-in | /ops; /bookings/[bookingId]/home-space | booking, ops/verification | No early key release, check-in event |
| CO10 in-stay request | /tickets/new; /messages; /ops/requests | comms/ticket, services | Assignment and SLA escalation |
| CO11 housekeeping | /ops; /mc | ops board, booking checkout jobs | Cleaning cannot clear maintenance blocker |
| CO12 maintenance | /ops/requests; /app/admin/tickets | comms/ticket, projects | Diagnosis, approval, proof, return to readiness |
| CO13 F&B | /services; /services/orders | services, Provider/Service/ServiceOrder | Real configured supply; food requirements scoped |
| CO14 service order | /services/[id]; /services/orders/[orderId]; /provider | services/service-order, finance | Standalone vs stay context; settlement dimensions independent |
| CO15 checkout | /trips/[id]; /ops | booking, finance/deposits | Final inspection, claims, deposit and turnover |
| CO16 cancel/extend | /trips/[id]; /api/bookings | booking/cancellation, BookingReschedule | No capacity release before funded replacement |
| CO17 incident/dispute | /app/admin/incidents; /app/admin/disputes; /tickets | comms/dispute, finance | Evidence, remedy, blocked premature settlement |
| CO18 procurement | /ops/costs; /app/admin/ledger | ops, finance | Approval → vendor payable → receipt; identify missing dedicated surface |
| CO19 financial close | /app/admin/statements; /app/admin/payouts; /admin/finance/reconciliation | finance ledger/payout/statement | Period cutoff, late refund and double-pay proof |
| CO20 owner approval/capex | /owner/units/[unitId]; /ops/requests | projects/owner, comms, finance | Threshold approval before expense |
| CO21 owner stay | /owner; /api/owner-stays | projects/owner, booking | Capacity block and turnover requirements |
| CO22 staff lifecycle | /app/admin/people; /api/admin/people | core/people, role assignments | Invite/reset/suspend/revoke/reassignment |
| CO23 provider lifecycle | /provider/apply; /app/admin/providers | services/provider, Provider | Vetting/authority and payout config |
| CO24 content/media | /app/admin/content; /app/admin/projects/[id]; /app/admin/units/[id] | media, content; ProjectMedia/UnitMedia | Rights, gallery scopes, cover, public label/fallback |
| CO25 standards | /app/admin/compliance-checklists; /app/admin/compliance | compliance and operational KPI | Evidence-backed badge, expiry and reassessment |
| CO26 guest-to-owner | /buying; /app/admin/crm | crm/opportunities; ownership.service | Sales milestone not legal ownership |
| CO27 ownership/operator change | /app/admin/contracts; /app/admin/units/[id] | projects/ownership; OwnershipPeriod/UnitEngagement | Effective dates, historical payout preservation |
| CO28 offboarding | /app/admin/projects/[id]; /app/admin/units/[id] | projects, core role changes, finance | Future guests, access revocation, final statement |
| CO29 integration recovery | /app/admin/integrations; /app/admin/scheduler | integrations, ExternalEventInbox/Checkpoint, JobRun | Replay, stale event, source cutover, alert |
| CO30 leadership review | /app/admin; /app/admin/signals; /app/admin/operational-kpis | analytics, CRM, finance | Drillable source-backed metrics and actions |

**Explicitly investigate missing or incomplete surfaces:** lease agreement/milestones; sales offer/diligence/transfer; property-specific trust verdict UI; consolidated service dispatch; procurement and owner approval; provider settlement drill-down; channel-manager ARI outbound and failure queue. These are hypotheses for verification, not claims that no code exists.

## C. Domain / writer ownership questions

| Fact | Candidate canonical writer | Detect duplicates in |
|---|---|---|
| Physical property | projects; Project/Unit | Project vs commercial listing vs imported Layantara ID |
| Property organization and owner | projects/ownership, core/engagement | CRM “owner”, management contract, manual Unit owner field |
| Effective access | core/permissions, authority | UI-only role toggles, unscoped admin APIs |
| Available capacity | booking + core availability, DB constraints | public search, calendar, imported blocks, category projections |
| Guest price | canonical pricing service | unit page, search card, booking, agent/manual quote |
| Booking/stay | booking | PMS and Trip duplicate records |
| Service order | services | guest ticket masquerading as financial order |
| Accepted terms and payment | finance + immutable snapshots | client totals, mutable config, payout/report recalculation |
| Ownership economics | finance + active mandate | rental sales projected yields or editable past statement |
| Public verification | compliance + effective mandate | marketing strings, property-level generic badge |
| Published media | media + content | project/category/unit inherited/fallback images |

## D. AT01–AT30 acceptance assignment

| AT group | Processes / system seam | Must run |
|---|---|---|
| AT01–AT08 | CO03, CO10, CO14, CO17, CO23 | Standalone/stay service, terms, capacity, idempotency, fulfillment races |
| AT09–AT15 | CO06, CO07, CO14, CO16, CO19 | Reschedule funding, refunds, payout snapshots, late settlement |
| AT16–AT20 | CO05–CO07, CO24–CO25 | Onboarding import, shared physical unit, quote parity, truthful responsibility |
| AT21–AT23 | CO01–CO04, CO22, CO26 | CRM handoff, metrics and role lifecycle |
| AT24–AT28 | CO08–CO12, CO25, CO27–CO29 | Housekeeping/readiness, Layantara replay, source outage, owner/partner isolation |
| AT29–AT30 | All | Locales/mobile/keyboard, deploy/restore/migrate/jobs and signed recovery |

## E. Per-surface inspection template

- URL and navigation parent; audience, goal and default role.
- Exact query/action and canonical service/model; tenant + project + unit scope.
- Public/owner/operator/partner disclosure, source freshness and relevant compliance gate.
- Primary CTA destination and completion state; loading/empty/error/forbidden/retry.
- Mobile/desktop/keyboard; EN/RU/TH; representative or actual photography.
- AuthN/AuthZ/IDOR/PII and financial semantics.
- Unit/integration/E2E/browser test; commit; deployment; data/config; result.
- Verdict by nine readiness dimensions, not one “working” boolean.

## F. Release branch handling

On this baseline PR #144 integrates #142 and #143 on a draft release branch, *not main*. Check current refs before evaluating code; a source line that exists only in PR #144 is “implemented on draft branch” and must not be reported as production. Do not reactivate imported Layantara inventory from the existence of a mapping or a static exporter. Check photo actual-byte coverage, price Golden Master and occupancy reconciliation separately.
