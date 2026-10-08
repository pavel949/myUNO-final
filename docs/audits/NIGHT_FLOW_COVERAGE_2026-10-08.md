# Night execution coverage — 8/9 October 2026


Checked application commit: `fca678918b88edae5a43f69e90776adc7ece1271` on `codex/night-booking-integrity-20261008`. Base: `3e6fa8d5`, preserving nine earlier unpublished commits above remote-known main `c0627258`. Fourteen implementation commits are local only. This is a coverage report for the changed slices, not whole-platform production acceptance.

| Canonical flow | Evidence from this run | Remaining coverage / next step |
|---|---|---|
| Discovery, project/unit, actual versus representative media — CO05/07/24, AT16/18/20 | Public readiness, category allocation and gallery regressions; exact-unit requirement for villas/condos/townhouses; hotel-category fallback retains its label. | Real Layantara galleries, rights and unit mapping not imported or verified; Media Master untouched. Synthetic local production HTTP smoke passed 24/24 checks. |
| Dates, price, availability — CO06/07, AT05/18/19 | Accepted satang ceiling, server booking mode, direct/category quote, shared active occupancy, unit locks, blocked dates, finite and untimed holds, real local PostgreSQL exclusion/concurrency tests. | No live Reservations Improved reconciliation, canonical price import, outbound ARI or source-outage acceptance. |
| Request/instant booking and retry — CO07, AT06 | Durable guest-scoped intent, identical retry recovery, payload mismatch rejection, request versus instant capability, manual PMS compatibility; DB/API/component tests. | Authenticated registration→search→request/approval→Trip browser journey not run. Existing approval work preserved, not merged with unrelated PRs. |
| Payment and cancellation — CO07/16/19, AT06/09/14 | One durable provider checkout, encrypted URL recovery, duplicate-request barriers, late capture neutral ledger/reconciliation, no resurrected inventory, refund neutrality, displayed cancellation quote checked under inventory locks before cancellation and renewed guest consent. | All provider traffic synthetic. No real Opn charge/webhook/refund, bank statement, cash handover or production reconciliation. Ambiguous provider attempts require operator reconciliation. |
| Calendar/PMS and portfolio scope — CO07/22/27/28, AT27/28 | Current operating-space capability and unit assignment, effective MC mandate and actual project check; property-local Ops day; common iCal occupancy. Scoped/foreign-ID and DB regressions passed. | Authenticated multi-role calendar UI not exercised; no external PMS/OTA or production scheduler run. |
| Housekeeping / maintenance / readiness — CO08–12/15, AT24 | Existing Ops/readiness/turnover suites passed in the complete test run; owner-stay side effects run after commit; media activation uses the public validator. | No claimed end-to-end checkout→cleaning→inspection→maintenance-clearance operator walkthrough or real readiness proof. |
| Owner stay / statements — CO19/20/21/27, AT27/28 | Owner capacity competes under the same unit lock; ownership reread; blocks and active holds respected; statements exclude unallocated capture; refund attribution and isolation tests passed. | Existing zero-rent/cleaning policy retained; not all contract-based owner charges, capex approval, historical beneficiary transitions or payout operations were newly accepted. |
| CRM, intake and communications — CO01/02/26/29, AT21/22/25/26 | Existing tests passed; unavailable WhatsApp/Telegram/email paths now report failure without fabricated IDs, sent timestamps or delivery analytics. | UTM completeness, opportunity→booking handoff and send-time marketing consent remain incomplete/unverified. Messenger adapters, verified inbound webhook and reliable outbox are not implemented by this slice. |
| Provider, services, procurement, disputes, leadership — CO03/04/13/14/17/18/23/25/30, AT01–04/07–15 | Existing automated suites were included and passed; service checkout uses the same durable claim writer. | No fresh actor-by-actor end-to-end acceptance or real provider settlement, procurement approval, compliance evidence or leadership data reconciliation. |
| Restore / deployment / accessibility / locales — AT29/30 | Local migration replay and idempotency, closed Data API tables, RLS and schema drift gates passed. | Production backup/restore, external side-effect reconciliation, deployment, scheduler dispatch, RU/EN/TH mobile/keyboard/slow-network browser acceptance not run. |


## Final checks at the application commit

| Check | Result |
|---|---|
| Complete Vitest discovery | **PASS — 2,766 tests / 331 files, 0 failed, skipped or todo.** Six sequential batches, one worker; all reported file sets match their discovery manifests and all exit codes are 0. |
| Inventory generator's separate Node tests | **PASS — 4/4**, zero skipped/cancelled. |
| Full ESLint | **PASS — zero warnings.** |
| Production TypeScript, Prisma generation, Next build | **PASS.** One Next worker, no deployment. The build wrapper completed with exit 0. |
| Fresh migration chain and database gates | **PASS — 81 migrations, 5/5 gates:** replay, closed Data API tables, RLS, no drift, repeat no-op. Disposable scratch DB dropped. |
| Production HTTP smoke | **PASS — 24/24:** scoped discovery, both exact-unit galleries, direct/category prices/modes, SSR/security headers, local fixture media, protected Ops/calendar/owner/MC redirects, anonymous writes/reads denied, including private booking quote and cancellation endpoints. |
| Browser E2E | **NOT RUN — connection blocked.** Final retry at about 20:02 UTC again timed out on `Emulation.setFocusEmulationEnabled`. No click, hydration or authenticated browser assertions passed. |
| Real content review / production data / live integrations / restore / deployment | **NOT RUN.** `CONTENT_REVIEW_GATE_ENABLED=false` was used only for the local synthetic build, matching the CI setting; this does not prove property content approval. |

The first final `db:verify` invocation aborted before creating its scratch DB because the local runner passed Prisma's `connection_limit` URL option to libpq. The runner was corrected to a plain loopback PostgreSQL URL; the complete rerun passed. No application or security gate was relaxed. Build logs contain expected unauthenticated-handler 401 entries; the build exited 0.

The temporary local Next server (PID 32032) was stopped after checking its exact task-local entry point and loopback port. Exactly three task-created QA screenshot copies were removed from `public/__night_fixture__`; checkout was clean before the evidence-only documentation update. These screenshots were never presented as real property photographs.

## Readiness dimensions for the changed slices

| Dimension | Result | Boundary |
|---|---|---|
| specification_complete | partial | Relevant canonical CO/AT requirements traced; whole CO01–CO30 acceptance remains open. |
| code_present | verified | Fourteen local implementation commits and their regression tests. |
| migration_applied | verified locally | 81 migrations on disposable PostgreSQL; production not checked or changed. |
| data_config_ready | not checked | No production credentials, inventory, photo assignments, prices or payment settings changed. |
| permission_verified | partial | Automated negative and scope tests passed; authenticated browser matrix not run. |
| ui_reachable | partial | Component tests and production HTTP smoke passed; no successful browser E2E. |
| critical_test_passed | verified for tested cases | 2,766/2,766 Vitest tests, 331 files, zero failed/skipped/todo; all six runners exited zero and their manifests matched. |
| deployed | not checked | Push, merge, preview and production deployment were not authorized. |
| runtime_checked | partial | 24 local production HTTP checks passed; no deployed runtime claim. |

## Required access and manual decisions

- Browser: the local QA Edge tab reports an unattached debugger; screenshot attempt also timed out on `Emulation.setFocusEmulationEnabled`; in-app browser unavailable and native APIs disabled. Need a working supported browser connection or a human-run authenticated guest/manager/owner walkthrough. HTTP smoke is not click/hydration/authenticated E2E evidence.
- Production changes: parent must approve rollout scope after review. Four additive migrations are pending production approval. Keep `payment_unallocated` available while any such ledger rows exist; an older client that does not understand the enum is not a safe rollback. No schema/data rollback was attempted.
- Canonical data: read-only authoritative Reservations Improved availability, Claude price artifact and Drive descriptions are needed for actual inventory reconciliation. V7 = 2BR Garden Retreat / SPA; B23 = 3BR Superior per supplied evidence; A13 = AA remains unconfirmed. Do not delete inventory or infer photo assignments. A12/V2 New AI-origin PNGs do not prove real-property photography.
- Integrations: a separately approved sandbox merchant setup is required for Opn charge/webhook/refund smoke. The deployed scheduler's `CRON_SECRET` and `APP_BASE_URL` must be configured by an authorized owner and dispatch verified separately; none were generated or exposed here. WhatsApp/Telegram require real adapter and identity/webhook work before any delivery claim.

## Specification / coverage caveats

The September 29 route crosswalk is an investigation index, not an acceptance result; current static discovery was regenerated (160 pages, 227 handlers, 115 models, 81 migrations, zero route collisions). It counts 330 tests under `src`; complete Vitest discovery includes the additional repository-level test, hence 331 files. Older cash-only wording in `docs/07_flows.md` must be read with the configured cash/bank-transfer rails in `docs/04_configuration.md` and current canonical pack; the overnight change did not rewrite business policy.

Additional static follow-up before card rollout: public booking creation checks project payment-method configuration, but `POST /api/bookings/[id]/checkout` and the finance checkout writer do not currently recheck that configuration. A cash/transfer reservation may therefore be offered a fresh card checkout while card is disabled. This was found in final code tracing, has not been reproduced in this run, and is not claimed fixed by the three reviewed payment commits. Any correction must preserve recovery of an already-created provider session and separately cover balance/service-order entry points.

## Implementation commits

```text
91015fd1 fix: enforce booking mode and reviewed price consent
12d4cfe5 fix: preserve manual payment reservations across availability readers
e1fc301f fix: recover booking creation retries without duplicate stays or payments
b24a77f5 fix: enforce calendar capabilities and current management mandates
20b36fb2 fix: align commercial activation with truthful media readiness
c8ce7400 fix: enforce project payment methods for public bookings
69e54bcf fix: share active booking occupancy across iCal readers
c7465a1c fix: resolve ops arrivals by property day and verify databases on Windows
fd88b6ef fix: serialize owner stays with the shared inventory calendar
4935984c fix: report unavailable notification providers without fake delivery
ca0ee11c fix: reconcile late captures without resurrecting released inventory
cc40c304 fix: claim one recoverable provider checkout per payment source
b4a985af fix: revalidate cancellation refunds after concurrent payment changes
fca67891 fix: bind cancellation to the guest accepted refund quote
```

Raw logs, the complete test manifest/JSON, six batch reports, HTTP report and review exports are preserved in the task directory. The final evidence-only commit does not alter the checked application, tests or migrations.

## Reviewer consent follow-up result

The capture-before-first-POST-read regression failed at the previous checkpoint and now passes. A fresh server read no longer substitutes for the guest's displayed agreement. The request carries the displayed booking ID/version/status and exact satang refund; the canonical writer computes the same quote under locks and checks equality. Changed refund capacity without a Booking.updatedAt change is also rejected. Missing/malformed quotes cannot cancel. After 409 the UI reloads, does not automatically resubmit, and posts the refreshed quote only after another explicit confirmation. Both capture orders, fractional amounts and unchanged authorized owner/direct-operator semantics are covered by the complete run.

All full gates above were rerun on this application commit after the reviewer follow-up. The local PostgreSQL process was stopped after final verification, preserving its disposable data and logs. No new migration was needed by the consent correction.
