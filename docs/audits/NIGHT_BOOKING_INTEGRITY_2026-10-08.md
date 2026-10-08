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
- Added but not yet run: `acceptance.integration.test.ts` on PostgreSQL and updated project-derivation fixtures for the new public acceptance contract.
- Not run: full DB suite, browser journey, production build and deployed checks in this slice.

| Dimension | Status | Evidence / limitation |
|---|---|---|
| specification_complete | verified | CO07, QA §2, AT19 |
| code_present | verified | API → canonical writer → review recovery |
| migration_applied | not applicable | No schema change in slice 1 |
| data_config_ready | not checked | No production configuration queried/changed |
| permission_verified | partial | Server capability regression tests; broader tenant checks pending |
| ui_reachable | partial | Component flows passed; browser journey pending |
| critical_test_passed | partial | 23 unit/component/API tests passed; real DB concurrency pending |
| deployed | not checked | Explicitly not authorized |
| runtime_checked | not checked | No production/runtime claim |

## Next verified risks

- Cash/bank reservations currently receive the card hold expiry; all availability readers must agree on non-expiring unpaid reservations before changing the writer. DB exclusion already covers every `pending_payment` booking.
- Booking creation has no durable intent/replay key, especially across category fallback.
- Scoped calendar permission/effective-date checks and hotel category-media onboarding need targeted verification.
- Docker API returns HTTP 500; no disposable PostgreSQL is listening. Investigating a separate portable PostgreSQL process confined to this task. Production URLs and external provider credentials are not test targets.

## Reconciliation notes

The old T-number plan and old PR references are historical evidence. Current canonical requirements and actual code take precedence. `RECONCILIATION.md` contains historical release/CI blockers and an older Layantara rate-source assertion; these do not override current user-designated sources (Reservations Improved for availability, the Claude rate artifact, Drive descriptions). No Layantara inventory, AA/A13/V7 mapping, media or source-authority changes are part of this slice.
