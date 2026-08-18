# Production Readiness Scorecard

**Date:** 2026-08-18 · **Baseline:** `75bf763` · Evidence: `PHASE0_EVIDENCE_REPORT.md`

Scores are 0–5. Launch severity: **P0** must be fixed before any real booking · **P1** before public
launch · **P2** shortly after · **P3** enhancement.

**No P0 remains open.** That is the bar for taking a real booking — not the bar for public launch,
which the P1 list below still gates.

---

| # | Category | Score | Evidence | Blocking gap | Required action | Severity |
|---|---|---|---|---|---|---|
| 1 | Domain model | **2/5** | 71 models, but no UnitType entity, no space hierarchy, no ownership periods, no rate plans, no inventory pools (§3) | Sellable class is a loose `categoryKey String?`; ownership is a scalar with no history | Introduce `UnitType`, `SpaceNode`, `OwnershipPeriod` as entities | P1 |
| 2 | SSOT integrity | **2/5** | Price and min-nights live on `Unit`; amenities are untyped `String[]` on both Project and Unit | No canonical owner for price or amenity; no provenance API | Move price to a dated rate rule; make amenities a catalog + assignment with inheritance | P1 |
| 3 | Booking correctness | **4/5** | State machine present; 111 tests pass; concurrency now DB-enforced and proven (§5) | No `BookingItem` ⇒ multi-unit bookings impossible; no persisted `Quote` to revalidate at checkout | Add `Quote`; add `BookingItem` before multi-room sales | P1 |
| 4 | Inventory concurrency | **5/5** | `booking_no_overlap` GiST exclusion constraint (proven load-bearing by drop-and-rerun) + per-unit advisory lock + blocked-date check inside the same transaction; 13 concurrency tests | Bookings and blocks are still two tables held together by a lock rather than one constraint — correct, but a shared `unit_occupancy` table would make it structural | Fold both into one occupancy table in the inventory phase | P2 |
| 5 | Payments | **2/5** | Cash path real and tested; `finance.service.ts:227` hardcodes `'mock'`. Seam now fails closed — unimplemented provider throws, mock refused in production, nothing claims money moved without proof (9 tests) | Still cash-only. No real rail, no webhook route, no idempotency table. `/api/checkout/confirm` is authenticated and payer-scoped, so a payer can settle their own mock payment — correct for a cash-first loop, not for real money | Wire a real provider with genuine signature verification before any card payment | P1 |
| 6 | Finance | **3/5** | `OwnerStatement` + line items + two-signature sign-off with `SELECT … FOR UPDATE` — the strongest area | Ledger is single-entry; financial snapshots are updatable | Enforce snapshot immutability (DB trigger); plan double-entry | P1 |
| 7 | Security | **3/5** | bcrypt-12, HMAC sessions with `timingSafeEqual`, real AES-256-GCM; payment seam now fails closed | Audit log is mutable (zero `TRIGGER`/`REVOKE` in any migration); no KDF/AAD/key-version on encryption | Make `audit_log` append-only (P1-3) | P1 |
| 8 | Tenant isolation | **2/5** | No `organization_id` on Identity/Project/Unit/Booking/Ledger | Isolation relies entirely on project/unit scoping | Decide whether myUNO is single-tenant. If multi-tenant, add the column before data grows | P1 |
| 9 | Owner data isolation | **5/5** | Scoped in the WHERE clause; 404 (not 403) on another owner's statement; tested at `sign-off.integration.test.ts:134` and `page.integration.test.ts:137` | — | — | — |
| 10 | Operations | **3/5** | Tickets, TM30 with SLA, condition reports, compliance records | No housekeeping/task entities; tasks not generated from booking events | Add `Task`/`TaskTemplate` in the operations phase | P2 |
| 11 | External integrations | **2/5** | Only cash payments, email and blob storage make real calls. The iCal **export** feed is now authenticated and correct — blocks previously carried `TRANSP:TRANSPARENT`, telling consumers a blocked night was free | OTA **import** is still a comment block (no fetch, no parser); WhatsApp/Telegram stubs return `success: true`, so deliveries are recorded as `sent` for messages never sent | Stop recording stub sends as delivered; implement iCal fetch+parse | P1 |
| 12 | Observability | **0/5** | `console.error` only (`errorHandler.ts:17-26`) | No error tracking, no metrics, no correlation IDs, no alerting | Add error tracking before public launch | P1 |
| 13 | Testing | **4/5** | **1193/1193 passing across 81 files** (build 0, lint 0); 978-line permission matrix; 6 new concurrency tests | No load/E2E tests; media module untested; encryption untested directly. Seven fixtures were found asserting states the DB now forbids — the suite was not guarding data integrity | Add direct encryption tests; E2E for the booking path | P1 |
| 14 | Deployment | **3/5** | Vercel config, 3 crons, migration chain applies cleanly from scratch (verified locally) | Supabase migration state **unverified** — sandbox cannot reach the host | Run `prisma migrate status` from a networked machine before launch | P1 |
| 15 | Backup & recovery | **0/5** | Nothing found in the repo | No documented backup, restore drill, or RPO/RTO | Document and rehearse a restore | P1 |
| 16 | Performance | **1/5** | Indexes exist on hot booking paths | `resolveUnitForCategory` is an N+1 loop; no availability projection; no load testing | Replace the loop with a set-based query | P2 |
| 17 | Legal & privacy | **4/5** | Real AES-256-GCM, retention jobs, PDPA anonymisation, access logging; iCal feed now token-gated and stripped to availability | Audit log is mutable | Make `audit_log` append-only (P1-3) | P1 |

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
