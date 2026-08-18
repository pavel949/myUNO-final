# Production Readiness Scorecard

**Date:** 2026-08-18 · **Baseline:** `75bf763` · Evidence: `PHASE0_EVIDENCE_REPORT.md`

Scores are 0–5. Launch severity: **P0** must be fixed before any real booking · **P1** before public
launch · **P2** shortly after · **P3** enhancement.

**No P0 remains open.** That is the bar for taking a real booking — not the bar for public launch,
which the P1 list below still gates.

---

| # | Category | Score | Evidence | Blocking gap | Required action | Severity |
|---|---|---|---|---|---|---|
| 1 | Domain model | **3/5** | 72 models. `OwnershipPeriod` now gives units an effective-dated chain of title (doc 02 §2.5.1), so a past statement can prove who owned the unit when it was earned | Still no `UnitType` entity, no space hierarchy, no rate plans, no inventory pools (§3). Sellable class is a loose `categoryKey String?` | Introduce `UnitType` and `SpaceNode` as entities | P1 |
| 2 | SSOT integrity | **2/5** | Price and min-nights live on `Unit`; amenities are untyped `String[]` on both Project and Unit | No canonical owner for price or amenity; no provenance API | Move price to a dated rate rule; make amenities a catalog + assignment with inheritance | P1 |
| 3 | Booking correctness | **4/5** | State machine present; 111 tests pass; concurrency now DB-enforced and proven (§5) | No `BookingItem` ⇒ multi-unit bookings impossible; no persisted `Quote` to revalidate at checkout | Add `Quote`; add `BookingItem` before multi-room sales | P1 |
| 4 | Inventory concurrency | **5/5** | `booking_no_overlap` GiST exclusion constraint (proven load-bearing by drop-and-rerun) + per-unit advisory lock + blocked-date check inside the same transaction; 13 concurrency tests | Bookings and blocks are still two tables held together by a lock rather than one constraint — correct, but a shared `unit_occupancy` table would make it structural | Fold both into one occupancy table in the inventory phase | P2 |
| 5 | Payments | **2/5** | Cash path real and tested; `finance.service.ts:227` hardcodes `'mock'`. Seam now fails closed — unimplemented provider throws, mock refused in production, nothing claims money moved without proof (9 tests) | Still cash-only. No real rail, no webhook route, no idempotency table. `/api/checkout/confirm` is authenticated and payer-scoped, so a payer can settle their own mock payment — correct for a cash-first loop, not for real money | Wire a real provider with genuine signature verification before any card payment | P1 |
| 6 | Finance | **4/5** | `OwnerStatement` + line items + two-signature sign-off with `SELECT … FOR UPDATE`. A booking's `price_breakdown` and `cancellation_policy_snapshot` are now immutable once set, enforced by trigger — the master spec's mandatory financial test passes (11 tests, 6 fail with the triggers dropped) | Ledger is single-entry | Plan double-entry before volume | P1 |
| 7 | Security | **4/5** | bcrypt-12, HMAC sessions with `timingSafeEqual`, real AES-256-GCM; payment seam fails closed; `audit_log` is append-only by trigger — update and delete both refused | No KDF/AAD/key-version on encryption. The triggers are ordinary ones, so a superuser setting `session_replication_role` bypasses them — they stop the application, not the database owner | Add key-version prefix to enable rotation | P1 |
| 8 | Tenant isolation | **2/5** | No `organization_id` on Identity/Project/Unit/Booking/Ledger | Isolation relies entirely on project/unit scoping | Decide whether myUNO is single-tenant. If multi-tenant, add the column before data grows | P1 |
| 9 | Owner data isolation | **5/5** | Scoped in the WHERE clause; 404 (not 403) on another owner's statement; tested at `sign-off.integration.test.ts:134` and `page.integration.test.ts:137` | — | — | — |
| 10 | Operations | **3/5** | Tickets, TM30 with SLA, condition reports, compliance records | No housekeeping/task entities; tasks not generated from booking events | Add `Task`/`TaskTemplate` in the operations phase | P2 |
| 11 | External integrations | **3/5** | Cash payments, email and blob storage make real calls. iCal **export** is token-gated and correct (blocks previously carried `TRANSP:TRANSPARENT`, telling consumers a blocked night was free). iCal **import** now really fetches, parses and imports, with SSRF guards, UID idempotency and conflicts raised to ops (29 tests) | No OTA **push** — availability is read from channels, never written to them, so a direct booking does not close the villa on Airbnb. WhatsApp/Telegram stubs still return `success: true`, recording `sent` for messages never sent | Stop recording stub sends as delivered; decide whether ARI push is in scope | P1 |
| 12 | Observability | **3/5** | Structured JSON logging with a per-request correlation id issued in middleware, echoed on the response, and returned to the caller as a quotable `reference`; PII scrubbed by field name and by content (25 tests) | **No alerting** — nothing pages anyone, and no log drain or vendor is configured. No metrics, no tracing | Configure a log drain and an alert on error rate; that is an ops decision, not a code gap | P1 |
| 13 | Testing | **4/5** | **1297/1297 passing across 90 files** (build 0, lint 0); 978-line permission matrix; 13 concurrency tests, 29 iCal, 25 observability | No load/E2E tests; media module untested; encryption untested directly. Seven fixtures were found asserting states the DB now forbids — the suite was not guarding data integrity | Add direct encryption tests; E2E for the booking path | P1 |
| 14 | Deployment | **3/5** | Vercel config, 3 crons, migration chain applies cleanly from scratch (verified locally) | Supabase migration state **unverified** — sandbox cannot reach the host | Run `prisma migrate status` from a networked machine before launch | P1 |
| 15 | Backup & recovery | **0/5** | Nothing found in the repo | No documented backup, restore drill, or RPO/RTO | Document and rehearse a restore | P1 |
| 16 | Performance | **2/5** | Indexes on hot booking paths; category availability is now one set-based query rather than two per unit (a forty-villa category cost 81 round trips per search) | No availability projection; no load testing; no query budget | Load-test search and booking before launch | P2 |
| 17 | Legal & privacy | **5/5** | Real AES-256-GCM, retention jobs, PDPA anonymisation, access logging; iCal feed token-gated; audit log append-only; logs PII-scrubbed by field and by content | — | — | — |

---

## Open P0 items — all must close before a real booking

| ID | Title | Why it blocks | Status |
|---|---|---|---|
| ~~P0-1~~ | Double-booking race in `createBooking` | Same unit sellable twice | **CLOSED this session** — DB exclusion constraint + 6 tests |
| ~~P0-2~~ | `DATABASE_URL_TEST` pointed at production | `resetDb()` truncates every table — `npm test` would wipe production | **CLOSED this session** — repointed at local test DB, warning added |
| ~~P0-3~~ | Stub adapters fabricated confirmations; webhook verification returned `true` | A deployment configured for a real rail would have taken fake payments | **CLOSED this session** — Stripe stub deleted, seam fails closed, 9 tests |
| ~~P0-4~~ | Owner blocks not covered by the exclusion constraint | A unit could be owner-blocked, under maintenance, or already sold on an OTA, and still sold here | **CLOSED this session** — checked inside the advisory-locked transaction, both sides serialized, 7 tests |
| ~~P0-5~~ | Unauthenticated iCal export | Per-unit occupancy and pricing readable by UUID | **CLOSED this session** — per-unit signed token, payload cut to availability only, 9 tests |

## Overall

**Weighted verdict: the P0 list is clear; the system is still not ready for public launch.**

The booking engine is now safe on its core invariant — the single largest risk, and the reason the
previous "architecturally ready" verdict was wrong. A unit cannot be sold twice, cannot be sold over
a block, the payment seam cannot claim money arrived when it did not, and the calendar feed no longer
publishes occupancy and rates to anyone holding a UUID.

What stands between here and a public launch is P1, and the two largest items are not code defects
but absences: **there is no observability at all** (no error tracking, no metrics, no correlation
IDs — a failure in production would be invisible), and **no documented or rehearsed backup restore**.
Financial snapshots and the audit log are also still mutable.

---

## Database & deploy — resolved 2026-08-18

**Production database: Supabase** (project `MyUno- final`, ap-south-1, Postgres 17), used as plain Postgres. No Supabase SDK is installed; the connection string is the entire integration, so the "no vendor lock in the code" rule in doc 15 §2 holds literally.

**Prisma Cloud disconnected.** It was a hosted database at `db.prisma.io` plus a GitHub check — never the production database, failing six consecutive PR checks with `P1001: can't reach database server`. Prisma the **ORM** is unaffected and remains the schema, migrations, and client. Nothing in the repository referenced Prisma Cloud, so removal took no code change.

**Two real defects were found and fixed on the way:**

1. **Nothing applied migrations to production.** `scripts/repair-failed-migrations.mjs` documented itself as running "before `prisma migrate deploy`", but no such step existed outside CI's throwaway database. The hosted database sat seven migrations behind the repository while every build reported success. Fixed by `scripts/deploy-migrations.mjs`.
2. **The first version of that fix was itself a hazard.** It would have migrated whatever `DATABASE_URL` pointed at — and this repository's `.env` points at production, so a developer running `npm run build` would have migrated production unasked. Migrating is now opt-in: a Vercel production deploy, or explicit `MIGRATE_ON_BUILD=1`.

**State of the hosted database:** 30 migration rows, 0 unfinished — the repository's 22, plus 8 orphan rows left from before the migrations were renamed to timestamped names. The orphans are cosmetic; they make `prisma migrate status` warn about migrations "not found locally" and can be deleted.

**Still outstanding:** the production connection string lives in a developer `.env`. It is gitignored, but anyone with a checkout holds production, and this database stores passports under PDPA (doc 12). It belongs in the platform secret store before real guest data exists.
