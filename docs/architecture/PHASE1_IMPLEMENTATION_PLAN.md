# Phase 1 Implementation Plan (corrected)

**Date:** 2026-08-18 · Supersedes any earlier plan. Built from `PHASE0_EVIDENCE_REPORT.md`, not
from assumptions.

## Why the previous T-007A → T-011 sequence is replaced

The earlier plan opened with **T-007A (CRM)**. That ordering does not survive the evidence:

- The booking engine could sell the same unit twice (`PHASE0_EVIDENCE_REPORT.md` §5, question 1).
  Building CRM on top of an engine that oversells adds revenue to a system that cannot honour it.
- CRM is one of the **most** complete contexts in the repository — `CrmProfile`,
  `CrmOpportunity`, `CrmActivity`, `CrmConsent`, `LifecycleTransitionLog`, admin UI and tests all
  exist and pass. It was scheduled first while already largely done.
- Master spec §19 puts domain foundation and inventory before CRM (Phase 8).

Priority order used below: data-integrity risk → booking/payment correctness → security →
operational necessity → revenue → UX.

---

## P0 — before any real booking

### ~~P0-1 · Double-booking race~~ — DONE this session

| | |
|---|---|
| **Problem** | `createBooking` read the calendar, then inserted, with no transaction and no DB constraint. Two concurrent checkouts could both pass the read. |
| **Business impact** | Two guests arrive for one villa. Refund, relocation, reputation. |
| **Files** | `prisma/migrations/20260818000014_booking_no_overlap_exclusion/migration.sql`, `src/modules/booking/booking.service.ts`, `src/modules/booking/double-booking.concurrency.integration.test.ts` |
| **Migration** | `btree_gist`; `booking_dates_ordered` CHECK; `booking_no_overlap` GiST EXCLUDE over `(unit_id, daterange(start,end,'[)'))` where status ∈ (confirmed, checked_in, pending_payment); pre-flight guard that refuses to apply over existing overlaps |
| **Acceptance** | Two simultaneous checkouts for the last unit → exactly one confirms, the other receives `DOUBLE_BOOK`. **Met** (6/6, and 3/6 fail with the constraint dropped) |
| **Effort** | 0.5 d (spent) |
| **Rollback** | `ALTER TABLE booking DROP CONSTRAINT booking_no_overlap, DROP CONSTRAINT booking_dates_ordered;` — the application-level check still stands |

### ~~P0-2 · Test DB pointed at production~~ — DONE this session

`.env` had `DATABASE_URL_TEST` = the Supabase production URL while `resetDb()` truncates every
table. Repointed at local PostgreSQL with a warning comment. `.env` is gitignored, so **every
developer machine must be checked individually.** Effort 0.1 d.

### P0-3 · Webhook signature verification is a stub

| | |
|---|---|
| **Problem** | `providers/stripe.ts:146-154` and `providers/index.ts:43-45` return `true` unconditionally, including when a secret is configured. |
| **Business impact** | Anyone reaching the endpoint could mark a booking paid without paying. |
| **Dependencies** | A decision: ship cash-only for loop one, or connect a real provider (CLAUDE.md names Opn/Omise the default; no SDK is installed). |
| **Files** | `src/modules/finance/providers/*`, a new `src/app/api/webhooks/[provider]/route.ts` |
| **DB** | `webhook_event` table (provider, external id unique, payload, processed_at) for idempotency |
| **Tests** | Valid signature accepted; tampered body rejected; replayed event processed once |
| **Acceptance** | No code path can confirm a payment from an unverified request. |
| **Effort** | 2 d with a real provider; **0.5 d** to instead delete the stubs and hard-fail on any non-cash provider |
| **Risk** | Leaving the stub in a shipped build is the risk. Removing it is strictly safer. |
| **Rollback** | Feature-flag the provider path off; cash continues to work |

### P0-4 · Owner blocks can be oversold

| | |
|---|---|
| **Problem** | `BlockedDate` and `Booking` are separate tables with no cross-table constraint. `createBooking` never consults `BlockedDate` (`resolveUnitForCategory` does, but the direct path does not). |
| **Business impact** | A unit the owner reserved for themselves, or that is under maintenance, can be sold. |
| **Approach** | Either (a) a shared `unit_occupancy` table both bookings and blocks write to, carrying one exclusion constraint — the correct long-term shape and the seed of the inventory model; or (b) short-term, check `BlockedDate` inside the `createBooking` transaction. |
| **Recommendation** | (b) now, (a) in the inventory phase — (a) is a data migration and should not be rushed behind a P0. |
| **Tests** | Booking over an owner block is refused; concurrent block-create and booking-create cannot both win |
| **Effort** | 0.5 d for (b), 3 d for (a) |
| **Rollback** | Revert the service change; constraint unaffected |

### P0-5 · Unauthenticated iCal export

`api/units/[unitId]/ical/export/route.ts:131` deliberately skips auth. The feed exposes booking
dates, status, type, and nightly pricing per unit UUID. Fix: per-unit signed token in the URL.
Effort 0.5 d. Tests: unguessable-token required; wrong token 404s.

---

## P1 — before public launch

| ID | Title | Problem | Effort | Acceptance |
|---|---|---|---|---|
| P1-1 | Financial snapshot immutability | `priceBreakdown` / `cancellationPolicySnapshot` are updatable JSON | 1 d | A DB trigger rejects any UPDATE of snapshot columns on a confirmed booking; test proves a later config change cannot alter stored economics (master spec §20 mandatory financial test) |
| P1-2 | Atomic modification & cancellation | `requestExtension` re-checks then updates without a transaction (`booking.service.ts:568`) | 1 d | Extension is one transaction; concurrent extension and booking cannot both win |
| P1-3 | Audit-log immutability | Zero `TRIGGER`/`REVOKE` in any migration; any code may update or delete audit rows | 0.5 d | `BEFORE UPDATE OR DELETE` trigger raises; test proves it |
| P1-4 | Persisted `Quote` | Checkout has no server-side quote to revalidate against; price is recomputed ad hoc | 3 d | Quote row with expiry; checkout revalidates and reports any change before payment |
| P1-5 | Error tracking & correlation IDs | None at all | 1 d | Unhandled errors reach a tracker with a correlation ID |
| ~~P1-6~~ | Serialization-failure retry | **DONE this session.** Under contention Prisma/Postgres raise write-conflict (P2034) / serialization (40001) / deadlock (40P01). Safety always held — exactly one booking won — but the loser occasionally received a driver error instead of `DOUBLE_BOOK`. `createBooking` now retries twice on transient conflicts, so the retry sees the committed winner and returns the clean domain error. 12 consecutive clean runs | done | Met |
| P1-7 | Stub sends recorded as delivered | `messenger.ts:121` returns `success: true` from a stub, so `NotificationDelivery` says `sent` | 0.5 d | A disabled channel records `skipped`, never `sent` |
| P1-8 | Encryption hardening + tests | No KDF, no AAD, no key version; no direct test | 1.5 d | Key-version prefix enables rotation; tests cover IV uniqueness and tamper rejection |
| P1-9 | Rate limiting off-process | In-memory `Map` (`rateLimit.ts:14`) is useless on serverless | 1 d | Shared store; limits hold across instances |
| P1-10 | Backup & restore drill | Nothing documented | 1 d | A documented, rehearsed restore with stated RPO/RTO |
| P1-11 | Verify Supabase migration state | `BLOCKED_BY_ENVIRONMENT` in this sandbox | 0.25 d | `prisma migrate status` clean from a networked machine |

---

## P2 — shortly after launch

`UnitType` and `SpaceNode` as entities · amenity catalog with inheritance and provenance ·
`OwnershipPeriod` with effective dates · resolve the `UnitEngagement` / `ManagementContract`
duplication · replace the `resolveUnitForCategory` N+1 loop with a set-based query · real iCal
fetch + parse · `BookingItem` for multi-unit bookings · double-entry ledger.

## P3 — enhancements

Availability projection · inventory pools · rate plans and restriction rules · channel mapping
model · maps/geocoding · analytics warehouse.

---

## Recommended next task

**P0-3 (webhook verification)** — and the cheap, safe form of it: since only cash is real
(`finance.service.ts:227` hardcodes the mock provider) and no webhook route exists, the correct
move is to **delete the stubbed provider adapters from the shipped path and fail closed** on any
non-cash provider. That removes a forged-payment vector in half a day without pretending an
integration exists.

**P0-4** is the natural follow-on, since it is the same booking transaction that was just made safe.
