# One Operational Reality — integrated release acceptance

Status: integrated release candidate, **not** production acceptance. Includes #139 + #144 (Layantara, calendar, pricing, category gallery and lease/sale), #148 (MLS/public integrity), #159 (managed portfolio, owner intake, guest continuity and delegated team), reconciled with current main #157. Code integration does not imply database/data/runtime acceptance.

## Four systems, one authority

| Product space | Screens | Canonical records / writer | Safety invariant |
|---|---|---|---|
| OTA / guest commerce | /search, /units/[id], /trips, /bookings/[id]/home-space | Project, InventoryCategory, Unit, CommercialOffering, canonical quote, Booking | Search/quote cannot overrule the booking writer; no false instant confirmation |
| PMS / managed portfolio | /ops, /ops/team, /mc, /mc/portfolio, /ops/calendar/[unitId] | same Unit, Booking, BlockedDate, PricingRule, Ticket, UnitEngagement, RoleAssignment | Calendar is a projection; only existing mutation paths change occupancy and price |
| MLS / property commerce | /property/onboard, /homes, /buyers, CRM | same Project/Unit and CommercialOffering; CRM opportunity is not a second unit | Sale, monthly and short stay share physical capacity and ownership history |
| Services marketplace | /services, /services/orders, /provider, /bookings/[id]/home-space | Service, Provider, ServiceOrder, payment/settlement | Standalone customer does not require a fabricated Booking or Project |

## The seven acceptance paths — executable release record required

For each path record exact commit, environment, sanitized record IDs, screenshots, server state, money/authority proof and failure cases. **Presence of files is not a PASS.**

| ID | Actor and critical path | Expected shared truth | Status on this branch |
|---|---|---|---|
| UOR-01 | guest search → date-aware quote → request/hold → booking → Trip | identical unit, dates, price authority and booking status; no double booking | code integrated; browser/runtime NOT CHECKED |
| UOR-02 | guest Trip → pre-arrival → check-in → in-stay service → checkout → cleaning → ready | one Booking ID; service references stay; Ticket and readiness do not mutate occupancy invisibly | NOT CHECKED |
| UOR-03 | owner submits existing development + unit → admin verifies → canonical draft and owner role → permitted offering live | one Unit; owner scope and agreement, verified media/authority; no duplicate conversion | integration test exists; full browser/runtime NOT CHECKED |
| UOR-04 | manager views managed units across projects → edits permitted data → pricing/block → calendar | active UnitEngagement and project/organization RoleAssignment; only assigned units; one calendar writer | scoped read-only portfolio exists; full mutation/browser NOT CHECKED |
| UOR-05 | project manager assigns existing onsite host → host performs assigned work → manager revokes | scoped RoleAssignment enforced on every request, no platform/staff_ops escalation | API integration test added; CI/runtime NOT CHECKED |
| UOR-06 | standalone or in-stay service order → provider accepts → fulfills or declines → settlement | one order with independent payment/fulfillment/settlement states | NOT CHECKED; exception and settlement gates remain |
| UOR-07 | owner or buyer enquiry → CRM opportunity → viewing/proposal → lease/sale handover | one Unit and Identity, transaction distinct from booking, correct authority | extended #144 deal workflow integrated in code; runtime NOT CHECKED |

## Release-blocking negative tests

1. Owner A and manager A cannot read/write/export/search/aggregate owner B's unit, gallery, booking or statement; project role alone cannot confer mandate over all condo units.
2. Expired hold and requested booking are not sold occupancy; accepted booking is; checkout date is exclusive.
3. Two concurrent booking/hold requests for the same unit and night cannot both confirm. External source authority means fail closed on stale projection.
4. Booking extension across seasonal boundary uses the same canonical quote and rechecks availability.
5. Editing listing/sale terms cannot change historical booking/payment/statement snapshots; money calculations in satang.
6. Duplicate service order retry and payout retry cannot duplicate charge or liability; cancellation/fulfillment races reconcile.
7. Revoke account or scoped role denies subsequent protected API actions without waiting for session expiry.
8. Gallery/media access cannot leak private evidence; public media has explicit publication and scope.
9. Migrated Layantara occupancy matches current source by physical ID and [check-in,checkout) immediately before cutover.
10. Backup artifact restores into isolated DB; migrations replay/drift check; jobs/webhooks replay idempotently.

## Release sequence

1. Integrated #139 + #144 + #148 + #159 on release/myuno-integrated-139-144-159; common files reconciled (scope-aware media with ordering/cover, guided onboarding with structure and category gallery, truthful public project and all role navigation). Maintain the exact integrated HEAD; do not merge superseded branches independently.
2. Run isolated npm ci, lint, tests, build, Prisma migration replay/drift, and a clean test DB. No production migration from install/build.
3. Verify UOR-01–07 in an authenticated browser with at least guest, owner, two disjoint managers, staff, provider and finance accounts; record negative cases.
4. Confirm deployment commit/health, backup+restore, payment sandbox and ARI acknowledgement separately.
5. Layantara source remains authoritative until signed fresh row-level occupancy reconciliation, approved tariffs/compliance/photos and a one-writer cutover. Draft offerings remain draft.
6. Only then merge and activate capabilities independently. A green build does not mean data, operational, payment or distribution readiness.

## Delegated project team (new in this branch)

- /ops/team and /api/ops/team; managers with current active project-level staff_ops grant can grant/revoke **onsite_host** to existing active people, only within their own project.
- No new platform, admin, staff_ops, finance or organization authority. Revocation of a grant issued by another manager requires admin.
- New account invitations and advanced roles remain admin-only /app/admin/people; this is deliberate least privilege, not a completed full employee lifecycle.
- The route integration test covers foreign project, forged high role/scope, out-of-scope revoke and stale-session revoked manager.

## Known blockers, not euphemisms

- The #144 galleries/calendar/rates/physical structure/lease-sale and Layantara code now share the integrated branch, but migrations, production data and operational flows are NOT accepted merely because code is merged.
- No confirmed end-to-end browser pass, production data access, live card payment, OTA ARI acknowledgement or restore proof on this exact head.
- Vercel build-rate limit is a deployment blocker; it must not be confused with a local code-test result.
- Layantara live preflight on 2026-09-29 found 31 unverified unit specs, only five units with source photos, and unapproved tariff terms; source booking authority remains external.
