# Unified myUNO user journeys — implementation and release ledger

Date: 2026-09-29. Baseline: main 4a8ed81b24aee51020486fc049e9ef0af329ffd8. This document is an execution ledger, not production sign-off. Use docs/canonical/PROCESS_MAP.md, PROCESS_PASSPORTS.md and READINESS_ACCEPTANCE.md as normative contracts.

## Existing release dependencies — do not duplicate

- PR #139 is the coherent draft Layantara release, incorporating the non-conflicting work of #134/#137. Do not independently merge its predecessor branches. Its production activation depends on 39 *real* villa identities, physical media, rates, offering terms, bookings/blocks, staff/compliance and signed source-target reconciliation.
- PR #132 hardens strict health/Data API grants. Its migration requires controlled replay and verified credentials.
- PR #131 changes the signed-in navigation. Avoid parallel editing of Navbar/layout until its status is reconciled.
- This PR only changes shared landing routing and tests. It does not deploy, migrate data, change payments, or claim end-to-end readiness.

## Lifecycle handoffs: owner of the canonical fact, user surface, acceptance evidence

| Journey | Entry → terminal state | Canonical boundary | User surface | Acceptance gate |
|---|---|---|---|---|
| Identity | Register/invite → scoped active membership | Identity / roles / membership, server authorization | /app, /account | cross-role and foreign-ID isolation, reset/revocation |
| Guest | Search → booked → prearrival → in-house → checked out | Booking remains transaction; Trip is derived; no duplicate stay | /search, /book/review, /trips, /bookings/[bookingId]/home-space | AT19, payment/hold retry, arrival/checkout, mobile/i18n |
| Owner | Enquiry → mandate → onboard → finance → change/offboard | verified ownership/authority, unit-scoped roles, ledger | /owners, /owner, /app/admin/properties/new | AT16, AT20, AT27, AT28 |
| Developer | Enquiry → verified organization → project → unit → offering → lead | Organization/ProjectOrganizationRole/Project/Unit; never infer authority | /developers, admin Developer 360; external portal remains a gap | project/import/readiness + permission proof |
| Buyer | Qualified opportunity → viewing/diligence → accepted transaction → verified ownership | Party and opportunity; ownership only from legal evidence | /buyers, /buying, CRM | AT21, evidence-backed role transition |
| Team | Invite → scoped work → reassignment/revoke | staff role scope, task/booking authority | /ops, /app/admin/people | AT23, AT24, foreign-project denial |
| Services | Eligible supply → quote/order → fulfillment → acceptance → settlement | canonical ServiceOrder, accepted terms and ledger | /services, /services/orders, /provider | AT01–AT15, including failure/race/refund |
| Layantara | Source mapping → validated projections → authority cutover | one authority per fact, replay-safe external mapping | operational calendar/Stay/finance | AT25–AT26, signed 39-unit reconciliation |
| Platform | Restore, replay and production smoke | migration/backup/runtime evidence | /api/health?strict=1 and admin | AT29–AT30 |

## Release gates

1. Baseline: record main SHA, PR overlap, migration drift and production source ownership; prove backup restore before touching live data.
2. Shared contracts: identity scopes, canonical property/offering/price/physical inventory, event and integration authority; preserve previous routes with redirects.
3. Commerce: server-priced quote, hold, booking, refund and service-order lifecycle; concurrency/idempotence and ledger tests.
4. Role workspaces: no dead actions, role-native default home, guest history across stays, owner evidence, developer onboarding, staff Today.
5. Layantara: source snapshot, mapping/dry-run, 39 villa reconciliation, historical bookings/blocks, media, rates, staff and compliance. Activation only after signed parity.
6. Production: build + lint + full tests + isolated migration replay + drift + smoke + strict health + rollback/restore. Record environment, commit, test IDs and logs for every gate.

## Current changes in this PR

- /app now routes a guest without an active stay to /trips, rather than dropping the authenticated customer back into public search.
- availableSurfaces includes /trips for the guest role even when an owner/staff role wins default routing.
- New/anonymous identities still land in /search; an active stay retains first priority, including for owners/admins.
- Pure-policy regression tests cover guest default, multi-hat discoverability and unaffiliated identity.

## Honest status

This patch can be reviewed independently of PR #139. Local full-repository build, database tests, real-device UX, production activation and Layantara reconciliation have **not** been executed by this patch. No journey is marked production-verified by existence of a route or a green structural test.
