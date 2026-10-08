# Night booking integrity execution — 2026-10-08

## Scope and baseline

- Actor/outcome: a guest reviews and accepts a direct-unit or category stay (CO07, QA Acceptance §2, AT19; retry coverage contributes to AT06).
- Remote `main`: `c0627258c80714257ca7b851282dba2c3bb3d834`, rechecked on 2026-10-08.
- Local base: `3e6fa8d5`, nine unpublished commits above that main from `codex/canonical-operating-loop-20261008`. They preserve request-decision serialization/expiry/audit, scheduler URL guards, inquiry/staff handoffs and Windows test portability.
- Working branch: `codex/night-booking-integrity-20261008`, an isolated local clone. Other checkout changes are untouched. `origin` points to the previous local clone, not GitHub.
- PR 231/224 (governance), 194 (PMS), 191/192/189 (agents) and 183 remain separate. No merges/cherry-picks, pushes, previews or deployments.
- Existing broad evidence remains in `architecture-2026-10-08/` and `CANONICAL_OPERATING_LOOP_EXECUTION_2026-10-08.md`; it is not upgraded by this focused slice.

## Slice 1 — mode and accepted price

**Reproduced:** the public direct-unit route trusted client `instantBook`, and omitted its accepted-price ceiling. Baseline regression run: 11 failed, 4 passed. A request-only unit became `pending_payment`; a higher direct-unit quote could be booked without renewed consent.

**Change:** the route reads the current unit capability, and `createBooking` checks it again in the unit-locked transaction. A caller may request approval but cannot enable instant booking. Both public entry paths require a nonnegative safe-integer accepted total in satang. The category signature remains required. The canonical writer calculates the actual total and refuses an increase. The direct quote returns its exact satang ceiling; the review client submits it, clears consent on re-quote, aborts obsolete reads and preserves the selected stay through login. Card checkout uses the committed booking total, including a legitimate lower price.

**Writers/effects:** existing Booking/Pricing/Payment services remain authoritative. No schema changes, migrations, production data writes or authority expansion. Existing accepted snapshots remain untouched. Media/readiness gates remain unchanged.

**Verification:**
- Passed: 23 tests in `booking-acceptance.test.ts`, API `acceptance.test.ts`, `review-client.test.tsx`, and `category-quote.test.ts`.
- Passed: focused ESLint, production TypeScript check, `git diff --check`.
- Initial TypeScript check failed on an effect's missing return; corrected and the repeat passed.
- Passed on PostgreSQL 16.15: `acceptance.integration.test.ts` (3), project-derivation (5), category allocation, blocked dates and concurrent booking tests. The initial 86-test DB run had 84 passes and two approval failures from old draft fixtures; corrected in slice 2 without weakening the live eligibility guard.
- Not run: full DB suite, browser journey, production build and deployed checks in this slice.

| Dimension | Status | Evidence / limitation |
|---|---|---|
| specification_complete | verified | CO07, QA §2, AT19 |
| code_present | verified | API → canonical writer → review recovery |
| migration_applied | not applicable | No schema change in slice 1 |
| data_config_ready | not checked | No production configuration queried/changed |
| permission_verified | partial | Server capability regression tests; broader tenant checks pending |
| ui_reachable | partial | Component flows passed; browser journey pending |
| critical_test_passed | verified for this slice | Unit/component/API tests and real DB price, mode, allocation and concurrency checks passed |
| deployed | not checked | Explicitly not authorized |
| runtime_checked | not checked | No production/runtime claim |

## Slice 2 - manual settlement and inventory occupancy

Cash and bank-transfer choices now persist on Booking. They create and approve into untimed `pending_payment`, matching F-GUEST-3 and the manually reconciled transfer rail. Card and legacy unspecified rails retain a finite hold. The bank instruction's chase deadline is not silently treated as authority to cancel a reservation.

All active availability predicates now share `blockingBookingConditions`: confirmed, checked-in, or pending payment with no expiry / future expiry. This covers direct writes, category assignment, date extension, availability checks, search, manual blocks, lease protection and Layantara intake. The PMS projection uses the same untimed-hold semantics. PostgreSQL's existing exclusion constraint remains unchanged. Requests remain nonblocking, and finite card holds still expire.

The migration `20261008170000_booking_payment_method` adds one nullable enum column without changing existing reservations or finance records. Applied only to the disposable local database. Production application needs separate authorization. Safe application rollback is to retain the additive column; do not drop it once new rows depend on their selected rail without exporting that data and resolving active reservations.

Passed: 139 tests in seven files, including seven new DB scenarios for cash/bank search, allocation, PMS, duplicate-sale/manual-block rejection, request approval, actual synthetic receipt/ledger recording, card expiry and archived-project rejection. The two positive legacy approval fixtures now use live supply; the eligibility gate is retained and has an explicit negative test.

## Test runtime

Docker remains unavailable (HTTP 500), but this no longer blocks database verification. A portable official PostgreSQL 16.15 distribution was started as a task-local process at `127.0.0.1:55432`, with a fresh `myuno_night_test` database. All 77 baseline migrations and the additive slice-2 migration applied successfully after the same Supabase compatibility-role bootstrap used by CI. Only synthetic data is used; no production URL, credentials or Windows service was changed. Dependencies are a private copy in this isolated checkout.

## Slice 3 - durable booking creation and recovery

The corrected baseline reproduced four failures and one pass: repeated requests created new requests, category retries did not recover the assigned unit, concurrent retries were not one intent, and changed payloads were not bound to their original key. An initial fixture run failed earlier on missing cancellation configuration; it was repaired before recording the reproduction.

`POST /api/bookings` now requires a UUID idempotency key. The server fingerprints the selected asset/category, project, dates, party, mode, settlement method and note, scoped to the authenticated guest. A unique database index and an intent lock acquired before the unit lock serialize concurrent attempts. Recovery precedes pricing and availability, so an already accepted booking is returned unchanged after a quote expires, rates change, or the first assigned villa disappears from search. A reused key with changed stay details returns `BOOKING_INTENT_CONFLICT`. Fresh keys still face all normal eligibility, media, pricing and overlap gates.

Review keeps the attempt key in its URL through retries, refresh, back navigation and login. An authenticated, uncached GET recovers only the requesting guest's booking. Replays do not emit duplicate creation notifications/analytics or create another checkout. An unavailable provider explicitly returns `CHECKOUT_UNAVAILABLE` with the saved pending booking; retries recover it without claiming a payment succeeded. Existing trip checkout remains responsible for resuming the payment.

Migration `20261008173000_booking_creation_intent` adds two nullable columns, a guest/key unique index and a paired-null check. Applied only to the disposable database (79 total migrations). It does not rewrite old reservations. Rollback should retain these columns and the uniqueness constraint: deleting recorded keys would remove retry protection for accepted attempts. Production migration remains unauthorised.

Passed: 67 tests across nine files covering the canonical catalog-to-booking journey, request/category/direct creation, price acceptance, double-booking concurrency, guest isolation, one card checkout, and UI recovery. After adding the unavailable-provider case, its eight DB tests plus twelve API regressions passed (20 total, overlapping the preceding run). Production TypeScript, changed-file/new-file ESLint and diff whitespace checks passed. No live provider, notification delivery, browser journey or production build is claimed by these results.

Test reconciliation: the old catalog retry assertion expected 409; it now requires 200 with the original booking id and still requires 409/DOUBLE_BOOK for a distinct intent on occupied inventory. Archived-project and sale-only negative fixtures now carry valid acceptance input, reaching the actual eligibility guard instead of failing earlier on missing request fields.

## Next verified risks

- Hotel category-media onboarding needs targeted verification.
- Production URLs and external provider credentials are not test targets; no production-readiness claim follows from local evidence.

## Reconciliation notes

The old T-number plan and old PR references are historical evidence. Current canonical requirements and actual code take precedence. `RECONCILIATION.md` contains historical release/CI blockers and an older Layantara rate-source assertion; these do not override current user-designated sources (Reservations Improved for availability, the Claude rate artifact, Drive descriptions). No Layantara inventory, AA/A13/V7 mapping, media or source-authority changes are part of this slice.

Parent media evidence: source-labelled photos/video exist for 20 of 39 villas. Representative category photos and ambiguous mappings must not be assigned to a villa or used to weaken villa/condo readiness. Any hotel-category fallback remains hotel-specific; Media Master stays private and untouched.

Updated parent evidence: A12 and V2 New include PNG files marked with `c2pa.created`, `gpt-image` and `trainedAlgorithmicMedia`; these are not verified real-villa photographs. Inventory Master takes precedence over derivative mappings: V7 = 2BR Garden Retreat / SPA; B23 = 3BR Superior; A13 = AA is still unconfirmed. No imports or inventory edits were performed.

## Slice 4 - current operating authority

Baseline: four failures, three passes. A scoped calendar opened without `view_calendar` or for an archived operating space; future operating-space assignments were exposed; MC scope ignored mandate start/end dates.

The board now uses the existing capability helper, which requires an active member, active space and the requested capability. Operating-space inventory requires an active space and a current unit assignment. Current MC reads and `hasManagedUnitMcAccess` share the same active mandate period `[startsOn, endsOn)`, permitting legacy null bounds but excluding future, expired and ended mandates. The direct unit guard also verifies the unit's actual project against the claimed role scope. MC booking, request, ticket, service-order and dashboard unit readers use the same predicate. Explicit draft/future mobilization preparation remains a separate existing permission; it is not current guest/booking access.

Passed: 36 tests across MC service, calendar, ticket scope, project helpers and the new DB mandate cases. Additional cross-project guard case passed, followed by production TypeScript, ESLint and diff checks. Coverage includes missing capability, revoked member/role, inactive space, future/expired assignments, legacy/current mandates, different organizations and overlapping portfolios. No migration or live role/security setting was changed.

## Review handoff

The first two commits (`91015fd1`, `12d4cfe5`) were exported relative to `3e6fa8d5` as `booking-first-two-review.patch` and saved to Library for the parent's independent review. Later slices remain separate commits.
