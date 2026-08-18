# Executive Summary — Phase 0 Verification

**Date:** 2026-08-18 · **Branch:** `claude/project-repo-clarification-bavpp0` · **Baseline:** `75bf763`

## The short version

myUNO is **not production-ready**, and it was not production-ready when the previous report said it
was. The reason is specific and was verifiable in a single file: **the booking engine could sell the
same villa to two guests at once.** No test covered it, and no database constraint prevented it.

That defect is now fixed and proven fixed. Three other blocking issues remain open.

## What the previous report got wrong

1. **The five audit documents did not exist.** Not in the repository, not in the scratchpad. There
   was nothing to preserve. The documents now in `docs/architecture/` were written this session from
   verified evidence.
2. **"Architecturally production-ready" was untrue.** `createBooking` checked availability and then
   inserted, with no transaction and no constraint between the two. Two concurrent requests could
   both pass the check.
3. **"Adapters ready" was doing a lot of work.** Only cash payments, email, and blob storage make
   real network calls. The OTA sync job is a comment block describing what it would do. Stripe has
   no SDK installed. WhatsApp and Telegram log to the console and report success.
4. **A test-database setting pointed at production.** `resetDb()` truncates every table in the
   schema, and `DATABASE_URL_TEST` was the live Supabase URL. Running `npm test` from a machine that
   could reach Supabase would have destroyed the production database.

## What is genuinely good

The permission system is real, deny-by-default, and covered by a 978-line table-driven test. Owner
data isolation is enforced in the query — an owner asking for another owner's statement gets a 404,
and that is tested from both the API and the page. The owner-statement sign-off is a proper state
machine using `SELECT … FOR UPDATE`. PII encryption is real AES-256-GCM with a fresh random IV per
record and a verified auth tag. The build is clean, lint is clean, and the migration chain applies
from scratch against a real PostgreSQL.

This is a well-built codebase with a hole in the one place that mattered most.

## What was done this session

- Started a local PostgreSQL and ran the migration chain and test suites against it, so the evidence
  is executed rather than asserted.
- **Fixed the double-booking race** with a PostgreSQL GiST exclusion constraint, a transactional
  `createBooking` that also retires abandoned holds inline, and six concurrency tests.
- **Proved the fix is load-bearing**: dropping the constraint fails three of the six tests and
  leaves genuinely overlapping rows behind. Restoring it returns the suite to green.
- Fixed a test fixture that had been creating a booking which ended a month before it started — it
  only ever passed because nothing validated the range. Added a `CHECK` so it cannot recur.
- Repointed the test database away from production.
- Wrote the six architecture documents, including an honest scorecard.

## What still blocks a real booking

| ID | Issue |
|---|---|
| **P0-3** | Payment webhook signature verification returns `true` unconditionally — a forged request could mark a booking paid |
| **P0-4** | A unit the owner has blocked for themselves can still be sold — blocks and bookings are separate tables with no shared constraint |
| **P0-5** | The iCal export feed is unauthenticated and exposes per-unit occupancy and nightly pricing |

Full detail in `PHASE0_EVIDENCE_REPORT.md`; scoring in `PRODUCTION_READINESS.md`; sequenced work in
`PHASE1_IMPLEMENTATION_PLAN.md`.

## Recommended next step

**P0-3, in its cheap form.** Only cash payments are real; the provider is hardcoded to `'mock'` and
no webhook route exists. Rather than build an integration nobody has credentials for, delete the
stubbed provider adapters from the shipped path and fail closed on any non-cash provider. That
removes the forged-payment vector in about half a day and stops the codebase from implying an
integration that does not exist.

**P0-4** follows naturally — it is the same booking transaction that was just made safe.

## On the CRM-first plan

The earlier plan started with CRM (T-007A). CRM is already one of the most complete parts of the
system — models, admin UI, and passing tests all exist. Meanwhile the booking engine could
oversell. The corrected sequence puts data integrity and payment correctness first; CRM work should
resume once no P0 remains.
