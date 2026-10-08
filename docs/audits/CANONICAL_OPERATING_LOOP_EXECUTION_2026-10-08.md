# Canonical operating loop execution ledger — 2026-10-08

This is a working evidence ledger for the 66-section `MYUNO_CANONICAL_OPERATING_LOOP_CODEX.md` assignment. Its supplied §66 ends after `reason`; no omitted requirement is inferred. A static source path, test name, or successful build is not a completed operating flow. Recheck every status at the next main HEAD.

## Baseline and authority

- Audited GitHub `main` at `c0627258c80714257ca7b851282dba2c3bb3d834`. The isolated implementation branch started at that commit. The existing OneDrive checkout contained unrelated work and was not edited.
- Vercel reported `my-uno-final` production deployment `dpl_6mCL78NGwjYRRRW5DTsZ6sJoPEEn` as `READY` for the same SHA. This is deployment metadata, not a live flow or data check. The linked myUNO app was absent from the available browser surfaces.
- The repaired Windows inventory CLI found 160 pages, 227 handlers (224 API), 22 modules, 311 test files, 115 Prisma models, 77 migration directories, and no normalized route collision. Counts are discovery only.
- Open work was reconciled before editing: PR #194 touches booking service and the respond route for other behavior; #189/#191/#192 cover agent/distribution surfaces; #231 supersedes #224 on founder governance. Re-review the actual diffs before any merge.
- Canonical writer boundaries retained: `Booking` in `src/modules/booking`, `BlockedDate` through availability and iCal writers, category price through the existing pricing service, Layantara source authority through `source-authority.ts`. No migration, authority switch, inventory activation, payment, statement, or production data write was performed.

## Execution queue and traceability

The current change set is a bounded CO07 / AT18–AT19 slice. Rows below describe the next business transitions; `not checked` means the full path has not been exercised. CO and AT IDs refer to the canonical process and acceptance documents.

| Outcome / actor and asset | Entry → API → canonical writer and state | Scope, money, event and handoff | Evidence / status / next action |
| --- | --- | --- | --- |
| CO07 request response; reservations staff or manager; exact physical unit | `/ops/requests`, `/mc/requests` → `POST /api/bookings/[id]/respond` → `approveBookingRequest`; `requested` → `pending_payment` | Route calls `can(stays:approve_decline_booking_requests)` with project and unit; staff department check. Per-unit advisory lock, booking and block conflict checks, existing Layantara guard. Category replacement reprices and cannot exceed the accepted total. Audit, notification and analytics follow the update. | **Fix in local branch.** New block, replacement, price and race tests authored. Production build/typecheck passed. Database tests could not start: no isolated PostgreSQL at `127.0.0.1:5433`. Run them with migrations and actual role/UI tests before merge. |
| CO07 decline competing with approval; same staff and request | Same UI/API → `declineBookingRequest`; `requested` → `declined` | Conditional status update makes approval and decline mutually exclusive. API returns 409 on a stale decision; UI displays the response error. Successful decision audit records actor, before/after state and decline reason. | **Fix in local branch.** Concurrent test authored, not executed against PostgreSQL. Confirm notification behavior under retry and timeout. |
| CO06–CO07 quote → booking; guest and channel | Public search/unit/review → pricing and booking services → quote snapshot and `Booking` | Existing category/unit/date price service and accepted amount are preserved. New fallback refuses a higher replacement price. | **Partial source trace.** Full search→quote→request→payment parity and snapshot acceptance require DB and browser evidence. |
| CO05 / AT16–AT20 onboarding and capacity; team, owner, manager | Property onboarding/readiness → `Project`, `InventoryCategory`, physical `Unit`, offerings | One physical unit per asset, capability gates and source authority; no duplicate category capacity. | **Not checked end to end.** Inspect current main and overlapping PRs, run distinct property fixtures and role tests before expanding supply. |
| CO08–CO16 / AT24 stay operations; guest and frontline team | Trip/Home Space, Today, Calendar, operations, checkout → booking/ops/finance writers | Check-in, TM30, service, cleaning, inspection, maintenance, deposit and turnover need ordered state transitions and next owner. | **Source footprint only.** Follow route→writer→event→screen with live non-production fixtures and negative tests. |
| CO14 / AT01–AT15 services; guest, provider, finance | Service pages/orders/provider → service-order and finance services | Standalone and stay-linked contexts; accepted terms, fulfillment, dispute and settlement are separate facts. | **Not checked end to end.** Reconcile existing services and finance integration tests before changes. |
| CO19 / AT30 daily close and recovery; finance/operator | Statements, payout, reconciliation, backup job | Ledger and accepted snapshots are financial authority; restore and replay need independent evidence. | **External blocker.** Backup workflow stopped at required configuration: `BACKUP_DATABASE_URL` and `BACKUP_PASSPHRASE` absent. No dump or restore proof. |
| CO29 / AT30 scheduled jobs; platform operator | GitHub scheduler → deployed myUNO `/api/cron/*` | GitHub `APP_BASE_URL` must be the deployed app origin, and `CRON_SECRET` must match server configuration. Supabase project URL is not the Next.js origin. | **External blocker with local guard fix.** Scheduler stopped at required configuration because GitHub variable `APP_BASE_URL` and secret `CRON_SECRET` were absent. The workflow now rejects Supabase and malformed origins. Verify the chosen app domain is reachable despite Vercel SSO before enabling. |
| CO01–CO04, CO22, CO26–CO30 CRM, sales, ownership and control plane | Role workspaces → CRM, property, finance and audit writers | Effective role/organization/asset scope; ownership and legal milestones cannot be inferred from CRM stages. | **Not checked end to end.** Reconcile open agent and founder PRs, then test cross-tenant reads/writes and actual handoffs. |
| Layantara / AT25–AT26 source protection | Source mapping and cutover gate → guarded myUNO booking writer | Current source authority remains protected until signed writer freeze, parity, migration, restore and runtime evidence. | **Preserve.** No cutover or activation. Live record counts and signed evidence were not accessed. |

## Readiness for the changed CO07 request-response slice

| Dimension | Verdict and evidence |
| --- | --- |
| specification_complete | Partial: §12–14, §19 and §66 give the required principles, but the uploaded §66 is truncated. |
| code_present | Verified in the isolated branch by diff and successful production compile. |
| migration_applied | Not applicable: this change adds no migration. Existing database migration state was not checked. |
| data_config_ready | Not checked: no safe test or production database inspection. |
| permission_verified | Partial: server-side scoped guard traced; foreign-scope runtime test not run. |
| ui_reachable | Partial source trace from `/ops/requests` and `/mc/requests`; browser session unavailable. |
| critical_test_passed | Not checked: new PostgreSQL integration tests failed in setup because localhost test DB is absent. Inventory CLI test passed; it is a separate concern. |
| deployed | Not checked: branch has not been deployed. |
| runtime_checked | Not checked: no executed request-response flow. |

## Verification and release gate

- `npx next build` passed with a deliberately unreachable localhost `DATABASE_URL`; production type checking passed. Its content-review gate could not validate data without a database. `npm run lint`, `npx tsc -p tsconfig.production.json --noEmit`, and four inventory CLI tests passed.
- `npx tsc --noEmit` reported 137 test-scope diagnostics and none in the changed files at the time it ran; investigate separately before treating full-repo type checking as green.
- Focused booking integration suite loaded 12 cases but all stopped in `resetDb` because `127.0.0.1:5433` refused connections. A thirteenth unpublished-villa regression was added afterward. No test reached the booking assertions. A database-backed concurrency result is still required for this P0 change.
- GitHub main CI was green at the audited SHA, while scheduler and backup workflows failed configuration checks before their operations. This does not validate the local patch or production operations.
- Manual availability-block routes already call the shared audit writer. Booking response now uses that writer for successful approvals and declines without guest PII. `logAudit` is deliberately best-effort and reports failures through observability; exact audit durability remains a release question.
- No preview, production migration, production test data, deployment, source-writer cutover, or release claim. Before merge: run the focused suite on an isolated PostgreSQL with migrations, recheck #194 overlap, run broader critical tests and role/browser flows, verify deployed cron/backup/recovery, then assess all nine dimensions.
