# Phase 0 — Evidence Report

**Date:** 2026-08-18
**Branch:** `claude/project-repo-clarification-bavpp0`
**Baseline commit:** `75bf763`
**Method:** every claim below was checked by reading the file or running the command named beside it. Nothing here is inferred from documentation.

---

## 0. Correction to the previous report

The previous session reported that Phase 0 was complete and that five documents had been produced
(`PHASE0_AUDIT.md`, `ATTRIBUTE_OWNERSHIP_MATRIX.md`, `ERD_CORE_DOMAIN.md`,
`PHASE1_IMPLEMENTATION_PLAN.md`, `EXECUTIVE_SUMMARY.md`).

**None of those five files exist** — not in the repository, and not in the session scratchpad
(`/tmp/claude-0/.../scratchpad/`, which contains only `ANALYTICS_EVENTS_MAPPING.md`,
`CRM_EXECUTION_PLAN.md`, `CRM_Parity_Analysis.md`, `corporate-bible-analysis.md`,
`t037-events-plan.md`, `tracking_summary.md`).

There was therefore nothing to move into the repository and nothing to merge. The documents in
`docs/architecture/` were written fresh in this session from verified evidence. The claim that they
existed was false.

---

## 1. Repository validation — commands actually run

Package manager detected from `package-lock.json` → npm.

```text
Command:      npm run build   (prisma generate + next build)
Exit code:    0
Duration:     ~150 s
Result:       PASS — compiled, 60+ routes emitted, no type errors
Warnings:     none blocking
```

```text
Command:      npx eslint src --ext .ts,.tsx
Exit code:    0
Duration:     ~90 s
Result:       PASS — no output, no warnings
```

```text
Command:      npx prisma migrate status        (against Supabase, .env DATABASE_URL)
Exit code:    1
Duration:     ~20 s
Result:       BLOCKED_BY_ENVIRONMENT
Error:        P1001 Can't reach database server at aws-1-ap-south-1.pooler.supabase.com:5432
Note:         The sandbox network policy blocks the Supabase host. This is an environment
              limitation, not a schema fault. Migration state on Supabase is UNVERIFIED.
```

```text
Command:      npx prisma migrate deploy        (against local PostgreSQL 16, myuno_test)
Exit code:    0
Duration:     ~8 s
Result:       PASS — 16 migrations found, chain applies cleanly from scratch
```

```text
Command:      npx vitest run src/modules/booking/double-booking.concurrency.integration.test.ts
Exit code:    0
Duration:     ~2 s
Result:       PASS — 6/6 (new tests, written this session)
Repeat:       12 consecutive clean runs after the retry fix described below.
              Earlier, under whole-suite load, the loser of a race occasionally received a
              driver-level write-conflict instead of DOUBLE_BOOK. Safety was never in
              question — exactly one booking won every time — but the error was wrong, so
              createBooking now retries twice on transient conflicts (P2034 / 40001 / 40P01).
```

```text
Command:      npx vitest run src/modules/booking src/app/api/bookings
Exit code:    0
Duration:     ~11 s
Result:       PASS — 111/111 after fixing one invalid test fixture (see §5)
```

Full-suite results are recorded in §7.

**Environment note.** PostgreSQL 16 is installed in the sandbox and was started locally to produce
this evidence. Before this session `.env` set `DATABASE_URL_TEST` to the **production Supabase URL**
while `src/test/util.ts:35` `resetDb()` truncates every table in the `public` schema — running
`npm test` on a machine that could reach Supabase would have wiped production. `.env` is
gitignored; the value has been repointed at the local test database and a warning comment added.
This is logged as **P0-2**.

---

## 2. Bounded-context status table

Statuses: `VERIFIED_COMPLETE` · `PARTIALLY_IMPLEMENTED` · `SCAFFOLDED` · `DOCUMENTED_ONLY` ·
`MISSING` · `BLOCKED_BY_ENVIRONMENT`.

| Context | Status | Schema evidence | API evidence | UI evidence | Test evidence | Production gaps |
|---|---|---|---|---|---|---|
| **Identity & Access** | VERIFIED_COMPLETE | `Identity`, `AuthAccount`, `OneTimeToken`, `RoleAssignment` (`schema.prisma:733,843,1607`) | `src/app/api/auth/*` (login, register, reset, verify, claim, guest-access) | `/login`, `/register` | `auth.integration.test.ts`; `session.test.ts` (6 tamper cases) | Sessions are stateless HMAC, 30-day TTL, **not revocable** (`session.ts:16,33`); dev secret fallback (`session.ts:18-27`) |
| **Authorization** | VERIFIED_COMPLETE | `RoleAssignment.scopeType` platform/project/unit | `core.can()` `permissions.ts:237-285`, deny-by-default `:253,284` | admin shell guard `(admin)/app/admin/layout.tsx:11` | `permissions.matrix.test.ts` — 978 lines, table-driven | `units:list` absent from matrix ⇒ silently admin-only |
| **Property Catalog** | PARTIALLY_IMPLEMENTED | `Project`, `Unit`, `UnitMedia`, `ProjectMedia` | `api/admin/units`, `api/search/units` | `/admin/projects`, `/units/[id]` | unit/search integration tests | **No structural hierarchy, no UnitType, no amenity entities** — see §3 |
| **Ownership & Contracts** | PARTIALLY_IMPLEMENTED | `UnitEngagement` (`:1355`), `ManagementContract`, `EarnedFee` | owner routes | `/owner` | `owner.service` tests | Ownership is a **scalar** `Unit.ownerIdentityId` — no ownership periods, no history |
| **Commercial Catalog** | PARTIALLY_IMPLEMENTED | `PricingRule`, `Unit.baseNightlyThb/minNights` | `api/pricing/breakdown` | booking widget | pricing tests | **No RatePlan, no RestrictionRule, no AccommodationProduct** |
| **Inventory** | PARTIALLY_IMPLEMENTED | `BlockedDate`, `Booking.holdExpiresAt` | availability inside booking service | calendar | `booking.service.integration.test.ts` | **No InventoryPool, no AvailabilityDay projection, no InventoryEvent.** Holds are a column on Booking, not an entity |
| **Booking** | PARTIALLY_IMPLEMENTED → improved this session | `Booking`, `BookingGuest`, `BookingChange` | `api/bookings/*` | `/trips`, `/bookings/[id]/home-space` | 111 tests pass | Concurrency **fixed this session** (§5). Financial snapshot present but not enforced immutable (§6) |
| **Payments** | SCAFFOLDED | `Payment`, `Refund`, `DepositPreauth` | `record-cash-payment` route | admin | cash path tested | Only **cash** is real. Stripe/Omise are stubs; **webhook signature verification returns `true` unconditionally** — see §4 |
| **Finance / Owner accounting** | PARTIALLY_IMPLEMENTED | `LedgerEntry`, `OwnerStatement`, `StatementLineItem`, `Payout` | statement + sign-off routes | `/owner/statements/[id]` | sign-off integration tests incl. race + owner-isolation | Single-entry ledger, not double-entry |
| **Operations** | PARTIALLY_IMPLEMENTED | `Ticket`, `Tm30Filing`, `ConditionReport`, `ComplianceRecord` | ops routes | `/ops`, `/ops/tm30` | tm30 + PII tests | No housekeeping/task-generation entities |
| **Distribution** | SCAFFOLDED | `IntegrationAccount` only | iCal **export** route (real); import cron is a stub | admin integrations panel | `ical-import.integration.test.ts` (tests the DB half only) | **No channel mapping model, no fetch, no iCal parser.** See §4 |
| **CRM** | VERIFIED_COMPLETE (for its own scope) | `CrmProfile`, `CrmOpportunity`, `CrmActivity`, `CrmConsent`, `LifecycleTransitionLog` | `api/admin/crm/*`, `api/leads` | `/admin/crm` | transition + lead tests | — |
| **Comms** | PARTIALLY_IMPLEMENTED | `Thread`, `Message`, `Notification`, `NotificationDelivery` | messages/threads routes | `/messages` | thread isolation tests | WhatsApp/Telegram senders are stubs that report `success: true` |
| **Analytics** | VERIFIED_COMPLETE (first-party) | `AnalyticsEvent`, `MetricDaily`, `BuyerSignal` | `api/track` | admin dashboards | analytics + signals tests | No external vendor; no error tracking at all |
| **Observability** | MISSING | — | — | — | — | No Sentry/Datadog/OTel. `console.error` only (`errorHandler.ts:17-26`) |

---

## 3. Domain-model verification (master spec §4/§5)

Checked directly against `prisma/schema.prisma` (71 models) and the 16 migrations.

| Required entity | Verdict | Evidence |
|---|---|---|
| Project | **Partially implemented** | `schema.prisma:859`. Has slug, geo, timezone, currency, status. **No** organization/tenant FK, no property_category, no operating_model, no lifecycle beyond draft/live/archived, no version column |
| Structural hierarchy (SpaceNode) | **Absent** | No building/floor/zone/cluster model. `Unit.floor` is a free-text `String?` (`:906`) |
| UnitType | **Represented incorrectly** | `UnitType` is a Prisma **enum** of `villa/condo/townhouse` (`:40-44`), not an entity. `Unit.categoryKey String?` (`:904`) is a loose string standing in for a sellable class — no name, occupancy, bed config, or content of its own |
| Physical Unit | **Partially implemented** | `schema.prisma:901`. Carries bedrooms/bathrooms/maxGuests/size. **Violates SSOT**: `baseNightlyThb` and `minNights` (price) and `amenityKeys` sit directly on the unit |
| Amenity definition / assignment | **Absent** | `Project.amenityKeys String[]` (`:867`) and `Unit.amenityKeys String[]` — untyped arrays, no catalog table, no inheritance resolution, no provenance |
| Ownership period | **Absent** | Ownership is the scalar `Unit.ownerIdentityId` (`:902`). Changing an owner rewrites the present with no history and no effective dates |
| Management agreement | **Partially implemented** | `UnitEngagement` (`:1355`) has startsOn/endsOn/status/fee override — closest thing to an agreement. `ManagementContract` also exists. **Two overlapping models for one concept** |
| Rental program enrollment | **Represented incorrectly** | Collapsed into `UnitEngagement.engagementType` |
| Accommodation product | **Absent** | No product entity. Booking attaches straight to a physical `Unit` |
| Inventory pool | **Absent** | `resolveUnitForCategory()` (`booking.service.ts:94`) loops units by `categoryKey` in application code — an N+1 scan, not a pool |
| Availability (projection) | **Absent** | No `AvailabilityDay`. Availability is derived per-request |
| Inventory hold | **Represented incorrectly** | `Booking.holdExpiresAt` column (`:1024`), not an entity. A hold and a booking are the same row |
| Inventory block | **Partially implemented** | `BlockedDate` (`:962`) with reason enum incl. `ota_import` |
| Rate plan | **Absent** | — |
| Rate rule | **Partially implemented** | `PricingRule` (dated price override) — no plan, no derived rates |
| Restriction rule | **Absent** | `minNights` is a scalar on Unit; no arrival/departure/advance-notice rules |
| Quote | **Absent** | `api/pricing/breakdown` computes a price but persists nothing. There is **no server-side quote to re-validate against at checkout** |
| Booking / BookingItem | **Partially implemented** | `Booking` exists; **no `BookingItem`** — one booking = one unit. Multi-room/mixed bookings (§9) are impossible |
| Booking snapshot | **Partially implemented** | `priceBreakdown Json` + `cancellationPolicySnapshot Json` on Booking (`:1018,1026`). Captured, but nothing prevents a later UPDATE — see §6 |
| Payment | Partially implemented | `Payment` (`:1091`) — cash real, provider mocked |
| Refund | Partially implemented | `Refund` |
| Owner statement | **Verified complete** | `OwnerStatement` + `StatementLineItem` + sign-off state machine with `SELECT … FOR UPDATE` (`statement-signoff.service.ts:171`) — the best-engineered area of the codebase |
| Channel mapping | **Absent** | Only generic `IntegrationAccount` (`:2579`) |
| Audit event | **Partially implemented** | `AuditLog` (`:1663`) exists and is written to, but **immutability is not enforced** — see §6 |

### Structural defects found

- **JSON hiding relational structure** — `Booking.priceBreakdown` and `cancellationPolicySnapshot`
  are `JsonB`. Line items are not queryable, not constrained, not joinable to the ledger.
- **SSOT violations** — price (`Unit.baseNightlyThb`), stay rules (`Unit.minNights`),
  amenities (`Project.amenityKeys` / `Unit.amenityKeys`) all live on the wrong entity per the
  master spec §3.1.
- **No tenant boundary** — grep for `organizationId|tenantId` across the schema returns hits on
  only `RoleAssignment`, `Announcement`, and `UnitEngagement.managementOrgId`. `Identity`,
  `Project`, `Unit`, `Booking`, `LedgerEntry`, `OwnerStatement` have **no** organization column.
  Isolation is per-project / per-unit / per-owner-identity only.
- **Missing effective dates** — ownership and amenity assignment have none.
- **Cascade-delete risk** — `Booking.unit` and `Booking.project` are `onDelete: Cascade`
  (`:1041-1042`). Deleting a unit destroys its bookings, and with them the financial history their
  ledger entries reference.
- **Duplicated concept** — `UnitEngagement` vs `ManagementContract`.

---

## 4. External integrations

Classification per master spec §7. Verified by reading each adapter.

| Provider | Classification | Evidence |
|---|---|---|
| Airbnb | **ADAPTER_ONLY** | `cron/sync-ical-imports/route.ts:56-62` is a comment block: *"Stub: In production, this would: 1. Fetch the OTA iCal URL 2. Parse the iCal events…"*. It only stamps `lastSyncAt`. No iCal parser exists in `src/` |
| Booking.com / Agoda | **ADAPTER_ONLY** | same code path |
| iCal export | LIVE but **unauthenticated** | `api/units/[unitId]/ical/export/route.ts:131` — *"no auth check for public iCal export"*. Leaks booking dates, status, type and nightly prices to anyone with a unit UUID |
| Payment — cash | **LIVE_AND_TESTED** | `finance.service.ts:77-207` + ledger; route and service tests |
| Payment — mock | **MOCKED** (shipped default) | `finance.service.ts:227` hardcodes `const provider = 'mock'` |
| Payment — Stripe | **ADAPTER_ONLY** | `providers/stripe.ts` — no `stripe` dependency in `package.json`, SDK import commented out (`:15-17`), every method returns `cs_test_${Date.now()}`-style literals |
| Payment — Opn/Omise | **NOT_IMPLEMENTED** | `providers/index.ts:66-69` — `console.warn('Omise provider not yet implemented; falling back to mock')`. Note CLAUDE.md names Opn/Omise the default provider |
| Deposit pre-auth | **MOCKED** | `deposits.service.ts:41-42` — `providerSessionId: \`mock-preauth-${bookingId}\`` |
| Email | LIVE (untested network path) | real `fetch('https://api.resend.com/emails')` `comms/email.seam.ts:58`; console fallback without a key |
| WhatsApp | **ADAPTER_ONLY** | `integrations/messenger.ts:105-124` — `console.log` then `return { success: true }` |
| Telegram | **ADAPTER_ONLY** | same function |
| File storage | LIVE, **untested** | real `@vercel/blob` `put` (`media.service.ts:32-40`); no test file in `src/modules/media/` |
| Maps / geocoding | **NOT_IMPLEMENTED** | lat/long are hand-typed admin form fields; no SDK, no geocoder anywhere |
| Analytics | first-party only | `analytics/track.ts`; no external vendor |
| Error tracking | **NOT_IMPLEMENTED** | no Sentry/Datadog/OTel; `console.error` only |

**Security consequence.** `providers/stripe.ts:146-154` and `providers/index.ts:43-45` both return
`true` from `verifyWebhookSignature` — including when a webhook secret *is* configured. Any party
who can reach the endpoint could forge a payment confirmation. Logged as **P0-3**.

---

## 5. Booking & inventory correctness — the ten questions

| # | Question | Answer before this session | Answer now |
|---|---|---|---|
| 1 | Can two concurrent requests confirm the last unit? | **YES — this was a live defect.** `createBooking` read `findBlockingConflict` then called `create` with no transaction and no constraint (`booking.service.ts:157-168` at `75bf763`) | **No** — proven by test |
| 2 | Is prevention enforced by the database or only application code? | **Application only.** No `EXCLUDE`, no unique index, no `FOR UPDATE`, no `$transaction` anywhere in the booking module | **Database** — `booking_no_overlap` GiST exclusion constraint |
| 3 | Do inventory holds expire safely? | Partly — `expireHolds` job exists, but a lapsed hold still blocked the calendar until it ran | Yes — `createBooking` retires lapsed holds inline, covered by a test |
| 4 | Can a payment webhook be processed twice? | **Unknown/unsafe** — there is no webhook route at all, and signature verification is a stub that always returns `true` | Still no webhook route, but the seam now **fails closed**: the stub adapters are deleted and nothing can claim a signature verified. Idempotency must be built with the real rail (P1) |
| 5 | Does a confirmed booking retain an immutable financial snapshot? | Snapshot columns exist (`priceBreakdown`, `cancellationPolicySnapshot`) but **nothing prevents an UPDATE** | Unchanged — **P1-1** |
| 6 | Can later rate-plan changes alter a confirmed booking? | No rate plans exist. `PricingRule` edits do not retro-alter a stored `totalThb` | Unchanged (adequate for now) |
| 7 | Can one unit be blocked by owner stay and sold at once? | **Yes.** `BlockedDate` and `Booking` are separate tables with no cross-constraint; `createBooking` never consulted `BlockedDate` | **No** — `createBooking` checks blocks inside its advisory-locked transaction, and iCal import takes the same lock, so the two paths serialize. 7 tests; 5 of them fail with the check removed |
| 8 | Can category and specific-unit inventory oversell each other? | Category resolution loops physical units, so it shares their calendar — but the loop was itself racy | Mitigated by the same constraint |
| 9 | Are modification and cancellation atomic? | `requestExtension` re-checks then updates without a transaction (`booking.service.ts:568`) | Partly — **P1-2** |
| 10 | Is channel inventory reconciled after each event? | **No.** The sync job is a stub | Unchanged — P2 |

### What was changed this session (P0-1)

- `prisma/migrations/20260818000014_booking_no_overlap_exclusion/migration.sql`
  - `CREATE EXTENSION btree_gist`
  - `booking_dates_ordered` — `CHECK (end_date > start_date)`
  - `booking_no_overlap` — `EXCLUDE USING gist (unit_id WITH =, daterange(start_date, end_date, '[)') WITH &&) WHERE (status IN ('confirmed','checked_in','pending_payment'))`
  - a pre-flight `DO` block that refuses to apply if overlapping rows already exist, naming the count
- `src/modules/booking/booking.service.ts`
  - `createBooking` now runs in `db.$transaction`, retires lapsed holds inline, and maps a 23P01
    violation to the existing `DOUBLE_BOOK` domain error via `rethrowAsDoubleBook`
  - `approveBookingRequest` maps the same violation on its status transition
- `src/modules/booking/double-booking.concurrency.integration.test.ts` — 6 tests

- `createBooking` takes `pg_advisory_xact_lock(hashtext(unit_id))` at the start of the transaction.
  Without it, concurrent inserts of the same range make Postgres take exclusion-constraint locks in
  arrival order and a stampede **deadlocks** instead of queueing. That was still *correct* — the
  constraint held and the loser retried — but CI showed 12 `deadlock detected` entries with
  `CONTEXT: while checking exclusion constraint on tuple … in relation "booking"`, and the retry
  thrash pushed a `beforeEach` hook past its 20 s timeout. One lock per unit turns the stampede into
  a queue; different units are unaffected; the lock releases on commit or rollback.

**Proof the constraint is load-bearing, not decorative:** dropping it and re-running the suite fails
tests and leaves genuinely overlapping rows in the table (re-adding it then fails with
`conflicts with key … [2026-09-10,2026-09-14)`). Restoring it returns the suite to 6/6.

Note the layering, which the drop test makes visible: with the advisory lock in place, dropping the
constraint fails **1** of 6 rather than 3 — the two service-path races are now caught by the
pre-flight read, because the lock serializes them. The failing one is the test that bypasses
`createBooking` and changes a booking's status directly. That is the point: **the lock provides
orderliness, the constraint provides the guarantee**, and it is the constraint that still governs
any writer which does not go through the service.

**Proof the deadlocks are gone:** the local Postgres log held 848 `deadlock detected` entries
accumulated before the lock was added, and **zero** new ones across three further stampede runs.

### Regression found and fixed

`api/bookings/[id]/verify-passports/route.integration.test.ts:104` built a fixture with a start
date of *yesterday* while leaving the factory's fixed default end date of `2026-07-17` — a stay
ending a month before it began. It only ever passed because nothing validated the range. The
fixture now derives its end date from its start date.

---

## 6. Security & tenancy

| Area | Verdict | Evidence |
|---|---|---|
| Password hashing | REAL — bcrypt cost 12 | `auth/utils/hash.ts:1-7` |
| Session integrity | REAL — HMAC-SHA256, `timingSafeEqual` | `session.ts:29-58` |
| Session revocation | **MISSING** | no session table; 30-day TTL (`session.ts:16`) |
| AES-256-GCM | **REAL crypto** | `src/lib/encryption.ts` — random 12-byte IV per record (`:18`), auth tag captured and verified (`:25,42`), format `iv:tag:ciphertext` (`:27`) |
| — key derivation | **MISSING** | raw env hex used directly (`:6-15`); no KDF, no AAD, no key version ⇒ rotation impossible |
| — direct unit test | **MISSING** | no `src/lib/encryption.test.ts`; no test asserts IV uniqueness or tamper rejection. Round-trip and ciphertext-at-rest *are* covered indirectly (`ops/guest-pii.integration.test.ts:25-79`) |
| Authorization | REAL, deny-by-default | `permissions.ts:237-285`; 978-line matrix test |
| Owner isolation | **REAL and tested** | scoped in the WHERE clause (`api/owner/statements/route.ts:21-29`); 404 on another owner's statement, with tests at `sign-off.integration.test.ts:134` and `page.integration.test.ts:137` |
| Rate limiting | REAL but **in-memory** | `rateLimit.ts:14` — a `Map`; ineffective across serverless instances. Not applied to reset-password, claim, or verify-email |
| CSRF | Partial | `sameSite: 'lax'` cookie; no token |
| Webhook signature validation | **STUB — returns `true`** | `providers/stripe.ts:146-154`, `providers/index.ts:43-45` |
| Audit-log immutability | **NOT ENFORCED** | grep over all migrations for `TRIGGER|RULE|REVOKE|GRANT` returns **zero hits**. Any code path may `auditLog.update/delete` |
| PII in logs | Handled | `redactEmail` (`email.seam.ts`) |
| IDOR | Spot-checked clean | `api/bookings/[id]/route.ts:45-51` 404s rather than 403s (no existence leak) |
| Tenant boundary | **MISSING as a column** | see §3 |

---

## 7. Full-suite result

```text
Command:      npx vitest run          (against local PostgreSQL 16)
Exit code:    0
Duration:     ~315 s
Result:       PASS — Test Files 81 passed (81) · Tests 1193 passed (1193)
```

Final state: **build 0, lint 0, tests 1193/1193.**

Getting there surfaced seven pre-existing test fixtures that were only ever valid because the
database did not constrain them. They fall into two groups:

1. **Stays ending before they began** — four fixtures passed a past `startDate` while inheriting the
   factory's fixed `endDate` of `2026-07-17`. Fixed at the source: `src/test/util.ts` now derives the
   default departure from the supplied arrival, so the factory cannot produce an impossible stay.
2. **Two stays in one unit on one night** — three fixtures double-booked a unit deliberately.
   `analytics.integration.test.ts` even asserted *"two overlapping bookings still occupy one night"*,
   encoding the defect as expected behaviour. Each was rewritten to a reachable state that preserves
   the original intent (a cancelled stay alongside a live one; an owner night adjacent to a guest
   night; two arrivals in two units).

These were latent data-integrity bugs in the test suite, not regressions from the change.

Results from any run pointed at Supabase are `BLOCKED_BY_ENVIRONMENT` and must not be read as
either pass or fail.

---

## 8. Verdict

myUNO is **not production-ready**, and was not architecturally production-ready at the time of the
previous report. The specific reason the earlier verdict was wrong: the booking engine — the one
component whose correctness the business depends on — could sell the same unit twice, and no test
covered it. That is now fixed and proven.

What is genuinely strong: the permission matrix and its 978-line table-driven test, owner-statement
sign-off (a real state machine with row locking), owner data isolation, and PII encryption as
actual AES-256-GCM.

What remains open is listed as P0/P1 in `PRODUCTION_READINESS.md` and sequenced in
`PHASE1_IMPLEMENTATION_PLAN.md`. **Three P0 items remain open**, so no real booking should be taken.
