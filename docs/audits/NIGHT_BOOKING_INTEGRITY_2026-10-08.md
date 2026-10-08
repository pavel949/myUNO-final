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

## Next verified risks

- Booking creation has no durable intent/replay key, especially across category fallback.
- Scoped calendar permission/effective-date checks and hotel category-media onboarding need targeted verification.
- Production URLs and external provider credentials are not test targets; no production-readiness claim follows from local evidence.

## Reconciliation notes

The old T-number plan and old PR references are historical evidence. Current canonical requirements and actual code take precedence. `RECONCILIATION.md` contains historical release/CI blockers and an older Layantara rate-source assertion; these do not override current user-designated sources (Reservations Improved for availability, the Claude rate artifact, Drive descriptions). No Layantara inventory, AA/A13/V7 mapping, media or source-authority changes are part of this slice.

Parent media evidence: source-labelled photos/video exist for 20 of 39 villas. Representative category photos and ambiguous mappings must not be assigned to a villa or used to weaken villa/condo readiness. Any hotel-category fallback remains hotel-specific; Media Master stays private and untouched.
