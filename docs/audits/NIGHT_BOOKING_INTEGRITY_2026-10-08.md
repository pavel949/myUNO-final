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

## Remaining verification

- Final full-suite verification is pending after the follow-up fixes below. Production compilation and HTTP runtime verification passed; browser E2E is blocked as documented below.
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

## Slice 5 - consistent accommodation media activation

Baseline: six failures. The public readiness report accepted room-type photos, but onboarding and commercial activation required unit photo links. Conversely, activation counted three links without validating their media. An explicit villa, condo or townhouse inside a hotel project incorrectly inherited representative-room privileges.

Onboarding and short-stay activation now use the existing public gallery validator, including valid MIME/type, nonempty storage key, positive size, unencrypted assets, three distinct photos and a cover within the gallery. Hotel rooms may use their category's representative gallery; their media is never relabelled as exact-unit photography. An explicit private accommodation type overrides the project label and still requires exact-unit photos. Legacy unclassified hotel rooms retain the existing category fallback. Project readiness uses the same classification for its instructions.

Passed: 44 tests across six files, including the six new real-database regressions, legacy hotel/resort unit detail and the catalog-to-booking journey. Test assets are synthetic metadata confined to the disposable database; no real media was uploaded, assigned or imported. Production TypeScript, changed-file ESLint and whitespace verification accompany this slice. No migration, inventory mapping or external media changes.

## Independent review correction - public payment policy

The parent's independent reviewer identified a slice-2 risk: the public API validated the payment enum but not `booking.payment.methods_enabled`, allowing an unauthorized manual rail to create an untimed hold in a card-only project. Seven new baseline cases failed and seven compatibility cases passed.

The public route now resolves allowed methods from the actual assigned unit's project before calling the writer. Both direct and category paths reject a disabled method with `PAYMENT_METHOD_UNAVAILABLE` and no booking/payment write; the same applies to requests awaiting approval and omitted methods defaulting to cash. Recovery of an already accepted booking still precedes this check, preserving its recorded agreement. Manual PMS authorization and the separate owner-stay writer are unchanged.

Passed: 39 tests across payment-method policy (14), acceptance (12), creation recovery (8) and project derivation (5). Explicitly enabled mock-card scenarios now configure their rail in fixtures. Tests prove permitted cash/transfer, one project not inheriting another's override, authenticated manual PMS creation on both instant/request units, and zero-rent confirmed owner stays on a request-only/card-only property. No real provider or money was used.

## Broad verification checkpoint

The complete suite against the unchanged application at `20b36fb2` finished in 609 seconds: 320 files passed, one failed; 2655 tests passed and one failed (2656 total). The sole failure was the scoped Ops board arrivals assertion. Its `dayRange` uses server-local midnight for PostgreSQL calendar dates, causing timezone-dependent bounds. This is being investigated as an application defect; the existing expectation is retained. The independent-review regressions were added after collection and are recorded separately above, not included in this full-suite count.

## Independent review follow-up - iCal occupancy

Ten of 36 new baseline cases reproduced older discrepancies: export treated requests, declined/expired and completed stays as occupied; import retained completed stays and elapsed payment holds as conflicts; unit/portfolio alerts retained elapsed holds. These were not introduced by the first two commits.

The iCal export, import-conflict check and alert readers now use `blockingBookingConditions`, matching direct booking, search and PMS. Confirmed/checked-in stays and untimed/future payment holds block; requests, cancelled/declined/expired/completed/checked-out stays and elapsed holds do not. Existing feed token authorization, redaction and scoped alert filtering are retained.

Passed: 70 tests across five iCal files, including 36 new state cases and existing import locking, idempotency, scoped alerts and token/redaction regressions. All events are synthetic or test fetch mocks; no production scheduler, live feed, OTA or external message was called. Production TypeScript and ESLint with zero warnings passed for both review follow-ups.

## Ops board calendar correction

The unchanged original arrivals assertion plus five new timezone/hold cases reproduced six failures (three other tests passed). The board now resolves each scoped project's current calendar day using `Project.timezone` and queries its stored PostgreSQL date directly. This removes the server-local midnight conversion and supports simultaneous projects on different local dates. Arrivals and unpaid stays also use the shared active occupancy predicate, excluding elapsed card holds while retaining manual reservations. Existing authorization scope and project filters remain intact.

Passed: 16 tests across Ops board, new calendar regressions and calendar projection. Coverage includes Phuket early morning under UTC/Bangkok/Los Angeles server timezones, simultaneous Bangkok/Pacific properties, exclusion of an out-of-scope project, active/manual holds and an elapsed hold. The original scoped Ops board test now passes without changing its expectation.

## Database replay and portability

`db:verify` initially failed before any migration: the Windows `psql` argument parser ignored options following a positional URL, so the scratch database was not created. It now uses explicit `--dbname` options, and launches the installed Prisma CLI with Node instead of relying on an `npx.cmd` shell shim. No schema semantics or verification gate was removed.

Passed: all five gates on PostgreSQL 16.15 at `127.0.0.1:55432`: 79 migrations applied to a fresh scratch database; ten operational tables have no anon/authenticated grants; RLS enabled; zero Prisma schema drift; a second migrate deploy applied nothing. The scratch database was dropped on completion. These are local verification results, not production migration approval.

The payment correction patch (`c8ce7400`, 15844 bytes) and a 17:34 UTC progress checkpoint were also saved to Library. Approval context includes exact `booking.service.ts` and manual reservations route versions at `3e6fa8d5` and `20b36fb2`.

## Local production runtime checkpoint

At `c7465a1c`, full ESLint with zero warnings, Prisma generation and the Next production build (including type checking) passed. The content-review switch was disabled only for the disposable local fixture, matching the CI build setting. The build used one Next worker on this 8 GB Windows laptop. No deployment was created.

The built server was bound only to `127.0.0.1:3010` against the disposable PostgreSQL database. The fixture used a clearly named synthetic project, two units (instant and request), and unchanged repository screenshots as local QA media. HTTP smoke passed 22 checks: dated scoped discovery, both exact-unit galleries, direct/category quotes and integer consent totals, public SSR pages, local image serving, streamed auth redirects for Ops/calendar/owner/MC, and 401 responses for anonymous booking creation/recovery, personal trips, owner stays and PMS creation. The production server was stopped and its three temporary screenshot copies removed after verification. Reports are `night-http-smoke.json` and `.log` in the task directory.

Browser E2E was not run successfully. The in-app browser was unavailable; the Edge QA tab's DOM operations reported an unattached debugger. A subsequent screenshot-only attempt on the local QA tab timed out on `Emulation.setFocusEmulationEnabled`. Native screen/mouse/keyboard APIs are disabled in this environment. No browser security settings, foreign tabs or credentials were changed. HTTP smoke does not prove client hydration, user clicks or authenticated browser journeys.

## Owner stay capacity correction (CO21)

Baseline: nine new cases failed and three passed. The separate owner writer ignored maintenance/owner/OTA blocks, omitted active payment holds from its friendly conflict check, failed on elapsed holds still protected by the DB exclusion constraint, and raced calendar block creation. The deterministic concurrency case saved both an owner booking and a maintenance block for the same nights.

The owner writer now takes the same transaction-scoped unit advisory lock as guest booking, manual blocks and iCal import. It reads ownership under that lock, retires elapsed finite holds, checks the shared active-booking predicate and blocked-date table, then creates the confirmed owner stay. Conflicts return `DOUBLE_BOOK` with an actionable availability message. Notifications and turnover run only after a successful reservation commit. The existing owner pricing/cleaning policy, notice window, request-only-unit behavior and database source-authority guard are retained; this change does not claim to implement every contract-based owner-charge rule in CO21.

Passed: 46 tests across the 12 new availability cases, 20 existing owner experience/turnover/statement tests, and 14 public payment-policy compatibility cases. No schema or live inventory change.

## Truthful external notification outcomes

Baseline: seven failures and one pass. Registered WhatsApp/Telegram placeholders reported `success: true` and fake external IDs, console-only email was recorded as sent, `notify_delivered` fired before knowing channel outcomes, missing-recipient deliveries remained pending, and the unverified webhook stub acknowledged and logged private payloads.

Unavailable messenger adapters now return `MESSENGER_ADAPTER_UNAVAILABLE`, store an integration error and produce failed delivery rows without a provider reference or sent timestamp. An email without its configured provider returns failure rather than a console-only success marker. Delivery analytics now records each channel's actual outcome; the stored in-app notification is marked available independently of a failed external channel. Missing recipients fail explicitly. The unimplemented webhook returns false without logging its payload. Existing disabled flags remain off and template rendering is preserved. This does not implement a messenger provider, recipient binding, webhook verification, outbox retry, or send-time marketing consent.

Passed: 56 tests across new delivery truth (8), messenger routing/rendering (6), owner turnover/notifications (20), announcement and thread suites. Provider success is exercised only through an explicit local email test seam. No account credentials or live delivery were used. The prior messenger assertion that a `stub-*` reference meant sent was replaced with stricter failed/no-reference/no-sent-time assertions, as required by the user's no-fake-integration instruction.

## Independent review: late captured payment versus released inventory

The reviewer reproduced a missing lock/availability check in payment settlement. Baseline on `4935984c`: 9 new regression cases failed and 1 passed. An expired pending row could be confirmed after iCal had inserted an overlapping block; direct confirmation and manual money writers also bypassed blocked dates.

Settlement now takes unit inventory, booking and payment locks in that order, reads the booking after a row lock, and checks current expiry, blocked dates and active competing bookings. Direct, cash and bank-transfer initial confirmation share that guard. iCal retires elapsed rows under the unit lock. Refund writers use the same source-before-payment order.

A verified captured amount that cannot confirm the stay is persisted once as succeeded with a reconciliation reason and an append-only `payment_unallocated` receipt. It has no unit/project revenue attribution and does not restore the booking. The admin reconciliation query surfaces it; the guest checkout explicitly says the booking and refund are not confirmed and prevents another payment. Replays create no additional ledger entry or refund. A subsequent genuine refund of that receipt has no property/owner debit. Owner statement collected-payment totals exclude such receipts, including duplicate captures attached to confirmed stays.

The additive `20261008190000_payment_reconciliation` migration was applied only to the disposable loopback database. No production migration, provider request, refund, scheduler run or deployment was performed. Targeted verification: 146 passed across 7 files, including 10 new late-capture/direct/manual/concurrency cases. Production TypeScript passed. Further checkout recovery review is still in progress; final full-suite and database replay results are pending.

## Independent review: one durable checkout and response-loss recovery

Baseline on `ca0ee11c`: all seven initial checkout regression cases failed. A Prisma middleware barrier immediately before Payment insertion reproduced initial booking POST versus authenticated resume, and two simultaneous resumes, while the first Payment was not yet visible. The old writer created multiple provider sessions. Another barrier inside the synthetic provider demonstrated the in-progress state; lost booking/provider responses and historical pending sessions were also exercised. No provider request left the process.

The canonical finance writer now validates source/payer/amount and claims one Payment under source inventory locks, commits `created`, then calls the provider outside the transaction. Concurrent attempts return `CHECKOUT_PREPARING` or reuse the same session. Provider URL and expiry are persisted (URL encrypted using the existing encryption key). Lost successful booking responses can recover the same authorized URL. Ambiguous provider responses, stale claims, multiple/historical sessions without URLs and expired URLs require reconciliation and never start another charge automatically. The admin board surfaces stale claims even if the process died before recording an error. A hold that expires during provider preparation does not return a redirect to the guest.

Booking and service-order resume routes use that writer. Confirmation DTOs do not serialize the encrypted redirect. Trip and checkout screens distinguish pending creation, unresolved payment, verified receipt and a genuinely completed refund; expired/failed labels no longer infer that no charge occurred. Payer ownership remains enforced. Unallocated receipts are excluded from policy-based cancellation/date-change refund capacity and owner collected-rent totals. Verified Opn captures arriving after local created/failed/expired state remain accounted for, and succeeded refunds remain unit/project neutral.

The added `20261008193000_recoverable_checkout` columns were applied only to the disposable database. No credentials or security settings were added. Both payment migrations are additive but production rollout still requires separate approval: the new ledger enum value must remain available while unallocated ledger rows exist, so blindly rolling back to a client that does not know that value is not a safe data rollback.

Verification so far: initial checkout targets 51 passed/5 files; extended targets 77 passed/1 failed (a new fixture omitted `CurrentUser.roles`, then corrected without changing production authorization); rerun 48 passed/3 files, including 11 checkout and 13 late-payment cases. Production TypeScript passed. Final UI/refund, full lint, complete-suite and 81-migration replay results will be recorded after completion.

Final focused proof before the checkout commit: 56 passed/6 files (11 checkout recovery, 13 late-payment, 19 owner statement, 9 reconciliation/payout, 2 checkout UI and 2 trip UI). Completed refunds disappear from the unresolved queue while their unallocated audit reason and neutral ledger attribution remain intact; checkout renders the confirmed refund outcome instead of a booking confirmation. Full ESLint passed with zero warnings; production TypeScript passed. Complete-suite/build/81-migration replay are still pending at this checkpoint.

## Complete-suite checkpoint and cancellation concurrency

At `cc40c3042213734f852ca71274b080a4accf642f`, all 330 discovered test files passed: 2,759 passed, zero failed, skipped or todo. The original Vitest settings were preserved; the file list was split into six sequential groups of at most 60 files, each with one worker. Every group's reported file set was checked against its discovery manifest, and stale JSON reports were removed before a new group. All six runners exited zero. The complete report and the six logs/JSON reports are archived in the task directory under `validation-cc40c304`.

A subsequent deterministic regression exposed a separate cancellation race. Finance held the booking row immediately before committing a succeeded payment; cancellation read the older unpaid state, computed a zero refund and waited on its write. After capture committed, the old cancellation returned 200, replaced confirmed with cancelled and sent the no-refund notification. Baseline: the new regression failed.

Cancellation now takes the same inventory/booking locks and compares the server snapshot (status and updatedAt) used for authorization/refund calculation. A concurrent change returns 409 `BOOKING_CHANGED` without cancelling the stay, reserving a refund or notifying cancellation. The trip reloads the new payment/refund and requires another explicit cancellation confirmation. The next approved cancellation records the policy refund against the received payment; no provider refund is fabricated. Existing direct operator semantics and cancellation policies remain unchanged.

Passed: 77 targeted tests over booking service, existing cancellation policies, late-payment regressions and trip UI; then 4 tests including an explicit UI check for the refreshed refund amount and absence of automatic resubmission. The regression uses synthetic mock payment and a real database lock/middleware barrier, without external money movement. No schema change for this follow-up. A complete-suite rerun is planned after its commit.
