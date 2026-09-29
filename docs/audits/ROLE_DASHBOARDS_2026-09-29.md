# myUNO role-dashboard audit — 2026-09-29

**Scope:** code-level review of `release/unified-myuno-20260929`, with fixes in PR #153. This is **not** evidence of a deployed production screen, successful authenticated browser session, or completed Layantara cutover. No production data is written.

## Decision and information architecture

Keep one canonical Project → Category → Unit → Offering → Booking/Stay spine, shared messages/tickets and financial ledger. A role dashboard is a scoped read model and action launcher, **not** a second booking engine. The adaptive `/app` route chooses a role home; role switching changes context, never permissions. Every actionable metric links to its canonical writer. Source and period must be explicit, including Phuket local time where appropriate.

| Audience / route | Existing entry and reviewed behavior | Improvement / acceptance |
|---|---|---|
| Founder/admin `/app/admin` | Platform counts, rollup KPIs, projects, broad ERP sidebar | **In PR #153:** attention queues link to bookings, active tickets, and unpublished inventory; add-property and live-calendar shortcuts; as-of ICT. Future: integrity and sync health from verified job data, not invented green badges. |
| Operations / reception `/ops`, `/ops/stays`, `/ops/calendar/board` | Project-scoped workboard with arrivals, departures, requests, payment tasks, OTA conflicts and canonical stay navigation in #144 | Keep one booking lifecycle. E2E: reserve/block, payment, arrival, stay, departure, owner isolation, and responsive staff access. |
| Management company `/mc` | Project+organization context; requests, units, tickets, service orders, calendar and fee report | **In PR #153:** responsive nav and scoped queue shortcuts; do not change financial source or permit writes outside role scope. E2E across two different management organizations remains required. |
| Owner `/owner`, `/owner/units/[unitId]` | Portfolio switcher, monthly booked value, historical MetricDaily chart, alerts, statements and unit detail | **In PR #153:** project selection scopes numbers, historical series, alerts, compliance and statements together; guard empty mobilization denominator. Distinguish booked gross from ledger-based owner entitlement. |
| Provider `/provider` | Provider-member queue; applicant status, services and remittances | **In PR #153:** response/fulfil queues, refresh, prioritized rows, invalid-date guard and explicit Phuket appointment times. Verify accept/decline/fulfil and remittance with real scoped accounts. |
| Guest `/trips`, `/trips/[id]`, home-space | Own booking snapshot and payment/pre-arrival actions | **In PR #153:** semantic trip links, separate API error from no trips, date-only/UTC rendering and localized statuses. E2E payment failure, hold expiry, check-in, cancellation and support. |
| Resident `/residence` | Residence relationship, announcements, messages, services and tickets | Validate multiple-building selection and no unauthorized building information in API payloads. |
| Buyer `/buying`, public `/homes` (in #148) | Enquiry/message flow, selection, legal/title due diligence separated from advertising | Consolidate the release before testing new homes routes. Buyers should see offer and enquiry state, not fabricated verified ownership claims. |
| Sales/CRM `/app/admin/crm` | Pipeline and next-actions panels | Make assigned next action and overdue follow-up primary; verify assignment scoping and handoff into buyer/rental/owner journeys. |
| Finance `/admin/finance/reconciliation`, `/app/admin/ledger`, statements | Dedicated reconciliation and ledger-backed surfaces | Add exception-first sign-off after data-cutover tests; never derive paid cash from gross booked value. |
| Juristic `/juristic` | Separate building-facing entry | Validate membership and building scope with live accounts. |
| Account/multi-role `/account`, `/app` | Account settings and adaptive landing | Preserve all held surfaces and role-safe URLs, test owner+active-stay and staff+owner precedence. |
| Housekeeping/maintenance/partner-manager | Work is mostly accessed via operations or organization surfaces, rather than a clearly evidenced independent My Shift / My Jobs / My Portfolio homepage | **Gap, not implemented in this PR:** design the minimum assigned-work queues and role-specific mobile UI without duplicating Tickets/Units/Bookings. |

## Verified code defects addressed in this PR

1. Owner project filter had only affected unit cards and ticket list; headline booked-value/occupied nights, chart, alerts, compliance and statements still represented the complete portfolio. The fix derives a single selected unit scope and server-side MetricDaily project rollups restricted to owned unit IDs.
2. Mobilization progress divided by zero when total checklist steps were zero.
3. Admin showed metrics ahead of actionable work, and its tickets tile led to generic `/ops` instead of the cross-project admin ticket board.
4. Management-company header's fixed row of navigation controls could overflow mobile screens, with no fast action count on the overview.
5. Provider order queue mixed new orders and history without priority or refresh, depended on browser timezone, and could claim the queue was empty after an API failure.
6. Guest trip cards were mouse-only click targets containing another button; fetch errors were accompanied by a false empty state; labels were generated from English status names and date-only fields used device-local rendering.

## Unresolved acceptance gates (do not mark green from code review)

- GitHub CI: lint, Prisma migration replay + drift, strict typecheck, unit/integration tests and production build must pass at the final PR head.
- Browser (desktop and narrow mobile viewport) for every role with seeded accounts, then two differently scoped projects/organizations and a multi-role identity.
- Role/RLS/authorization: no cross-owner, cross-provider, or cross-organization data even via direct API; no PII in unauthorized client payloads.
- Reconcile actual Layantara units, category media, pricing, bookings/blocks and financial records before activation; no PR #153 change activates imports.
- Confirm deployed commit, render the route matrix and repeat state-changing E2E with production-safe test records only after explicit release approval.
