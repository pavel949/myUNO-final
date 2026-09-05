# Launch checklist (T-043)

**What this is.** Doc 16's last task: every box ticked, or explicitly waived by the founder, before production traffic. Its DoD is the checklist file committed — this file.

**How it was run.** Each item below was checked against the real environment where that was possible, and recorded as unverifiable where it was not. **Nothing is ticked on the strength of it looking likely.** Four states are used, and the difference between the last two matters:

| | Meaning |
|---|---|
| ✅ | Verified, with the evidence named |
| ⚠️ | Verified as **not** done — an action, with an owner |
| ⛔ | Blocked on a founder or counsel decision |
| ❓ | Could not be checked from here — needs someone with console access |

Run 2026-08-24 against Supabase project `MyUno- final` (`burcnghheyzbzffzgmjz`) and `main` at the commit that adds this file.

---

## 1. The blockers

Three things below make a production launch unsafe today. They are not ranked by effort.

**⚠️ The privacy notice is written; counsel has not read it.** `/legal/privacy` now carries a full PDPA notice — controller, what is collected and on what basis, who else sees it, where it is held, retention, rights, complaints — written from what the system actually does rather than from a template. Every statement is checkable against the code. It is seeded as `needs_review`, which is this project's existing gate for copy nobody has approved: **Thai counsel must read it before launch**, and their edits are content changes, not code. **Terms of service are still title-only** (Q36).

**⚠️ Four tables are readable through the public API — the fix is written and waiting to be run.** Supabase serves every table in `public` over PostgREST to anyone holding the anon key — a key that ships to browsers. `ownership_period`, `saved_unit`, `saved_search` and `area` had row-level security **off** and were flagged at ERROR level by Supabase's own linter. Two hold personal data: which homes a named person is watching, and the searches they saved.
**Root cause, which is the more important finding:** RLS was applied across the database in August 2026 **by hand in the dashboard** (doc 15 §2.3), so the decision never entered the repository. Every table created by a migration since was born exposed and nothing noticed for months.
**Fixed in the repository** by `20260824000021_rls_every_table`, which enables RLS on every table in `public` as a migration, plus `rls.integration.test.ts`, which fails the build if any table lacks it. Confirmed still live in production on 2026-08-24 by Supabase's linter, and the fix could not be applied from this session (Supabase writes need interactive approval). **Run `scripts/supabase-2026-08-24-rls-and-transfer.sql`, or `prisma migrate deploy`.** The script was tested twice against a database in the same state: no duplicate bookkeeping rows, zero exposed tables afterwards.

**⚠️ No card payment is possible yet, but the provider is chosen and the adapter is written.** Q8 is ruled: **Opn Payments (Omise)**, the Thai-licensed provider the specs already assumed. The adapter is built behind the seam and covered by tests. What is missing is the **merchant account** — a KYC application Ignatev Estate makes, and no amount of code creates one — that is a merchant account Ignatev Estate opens with a licensed acquirer and passes KYC for. **Bank transfer is built and works**: the payer sees the company's Krungsri account and a reference tied to their booking, staff confirm the credit against the bank statement, and the ledger records it in the same transaction. Cash and transfer together cover both a guest standing at the desk and one paying from Moscow. What is still untested against real money is everything downstream of a *card*: deposits, refunds outside policy, and balance settlement on a date change.

---

## 2. Environment and secrets

| Item | State | Evidence / action |
|---|---|---|
| Production database provisioned | ✅ | `MyUno- final`, Postgres 17.6, `ACTIVE_HEALTHY`. |
| Migrations applied to production | ⚠️ | 23 rows applied as of 2026-08-19; the **two new migrations are not among them**. Run `scripts/supabase-2026-08-24-rls-and-transfer.sql` or `prisma migrate deploy`, then re-run Supabase's linter — the four ERROR entries must be gone. |
| Migration chain replays onto an empty database | ✅ | `prisma migrate deploy` run against the test database during this pass; all migrations applied, including the new one, with no manual repair. |
| Database region matches the published privacy notice | ✅ | **Ruled 2026-09-05: Mumbai stays** (Q45 answered). The notice already names Mumbai, so nothing was ever misrepresented and no published statement changes. Doc 15 §2.7 records the ruling, the accepted cross-region latency cost (functions in `sin1`, data in `ap-south-1`), and preserves the Singapore runbook in case it is ever revisited. **One action remains and it belongs to counsel**: the cross-border transfer wording goes to them as a specific question during the Q36 review — naming the right country is not the same as disclosing the transfer adequately. |
| `ENCRYPTION_KEY` generated, set identically everywhere, and written down offline | ❓ | Cannot be checked from here, and this is the one item with no second chance: change or lose it and **every stored passport becomes permanently unreadable** (doc 15 §4). Confirm it is set in Vercel production, matches staging, and exists in a physical vault — before any real guest data. |
| Whether production already holds encrypted data | ❓ | Could not query production row counts in this session. It decides whether the key can still be rotated at all. Check `tm30_filing` before touching the key. |
| Production connection string out of developer `.env` files | ⚠️ | Flagged earlier in this build and **not resolved**. A production credential in a developer file is a credential to rotate, not to tidy. Rotate it and set it only in Vercel. |
| Row-level security on every table | ✅ (code) / ❓ (production) | Migration + test in this commit; production pending the deploy above. |
| `.env.example` lists every variable the app reads | ✅ | Fixed (Q56) — the nine missing lines are added, each with a one-sentence note: the **entire Opn/Omise card-payment surface** (`OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`, `OMISE_WEBHOOK_SECRET`, `PAYMENT_PROVIDER`), plus `BLOB_READ_WRITE_TOKEN`, `ICAL_FEED_SECRET`, `NEXT_PUBLIC_APP_URL`, `ALERT_WEBHOOK_URL`, `LOG_SILENT`. |

## 3. Monitoring and operations

| Item | State | Evidence / action |
|---|---|---|
| Structured, PII-scrubbed logging | ✅ | `src/lib/observability.ts` — JSON to stdout with a correlation id, scrubbed. Lands in the Vercel log and is searchable by the reference shown on an error page. |
| Error alerting | ⚠️ | **The transport now exists; it needs one env var to go live.** `reportError` (`src/lib/observability.ts`) pushes every unexpected error (5xx, never the caller's own 4xx mistakes) **and every scheduler job failure** to `ALERT_WEBHOOK_URL` — a Slack incoming-webhook URL, or anything that accepts a JSON POST with a `text` field. Unset, it stays a correct no-op (same seam pattern as payments and email); tested in `observability.test.ts` and `src/jobs/record.integration.test.ts`. **Set `ALERT_WEBHOOK_URL` in Vercel** (a Slack incoming webhook takes minutes to create) and production errors start paging the ops channel with no further code change. First version only: no retry, no queue, no dedup — a genuine incident storm can still flood the channel. |
| Uptime check on the public site and API | ❓ | Not configurable from the repository. `/api/health` exists to point a monitor at. |
| Scheduler jobs report last run and outcome | ✅ | Doc 15 §5. Registry in `src/jobs/`; each run writes an append-only `job_run` row (outcome + short count summary, never error text). Admin panel `/app/admin/scheduler` lists every registered job even when it has never run — never/failed/silent are red or amber; on-schedule is green. Vercel Hobby: two **daily** crons (Hobby refuses anything more frequent — a 15-minute expression fails the deploy). `/api/cron/run-frequent` at 14:00 ICT (holds, TM30, iCal), `/api/cron/run-all` at 02:00 ICT (verification, retention, rollup, guest messages, service-order expiry). 5-minute hold expiry needs Pro. Notification digests and monthly statement generation are not cron jobs yet and are not in the registry. |
| Backups and point-in-time recovery enabled | ✅ (own) / ❓ (provider) | **Ruled 2026-09-05: no paid tier for now**, so the provider's own tier-dependent backups are not what this platform relies on. `.github/workflows/backup.yml` (T-048) takes a nightly dump, **restores it into a scratch Postgres and asserts it is intact before storing it**, encrypted, with a 30-day retention window. Two limits written into doc 15 §5 rather than left to be discovered: the dumps live in the same GitHub account as the code (a shared failure domain), and artifact retention caps at 90 days. **Add the offsite destination before real owner money or title records land** — the S3 step is in the workflow, commented. Still ❓ on the provider side: confirm in the dashboard what the current tier actually gives. |
| Restore drill performed | ✅ (automated) | Was ⚠️ "never done" — a quarterly drill on a calendar reminder, in a quarter when nothing is on fire, is a drill that does not happen. **The drill is now the backup**: every nightly run restores the dump it just took and fails if the restore or the integrity assertions fail, so it cannot silently lapse. Visible in the Actions tab, not in somebody's memory. The human-facing recovery runbook — including the two steps most easily forgotten under pressure, carrying `ENCRYPTION_KEY` across unchanged and re-enabling RLS on the new database — is doc 15 §5. **Outstanding**: one operator walk-through of that runbook against a real downloaded artifact, so the first time anyone runs it is not during an incident. |
| Incident playbook | ✅ | Doc 12 §7, and `incident_log` exists in the schema. |

## 4. Legal, compliance and content

| Item | State | Evidence / action |
|---|---|---|
| Terms of service body | ⛔ | Q36 — title key only, no prose. Counsel. |
| Privacy notice body | ⚠️ | **Written** (`/legal/privacy`): controller, categories and lawful bases, recipients, cross-border transfer, retention, security, rights, complaints — each statement traceable to something the code does. Seeded `needs_review`, which is the counsel gate. Names Mumbai, correctly, via a content key. |
| Legal entity facts published | ✅ | Q16 answered; `legal.entity.*` keys carry the company, DBD number, director and contact, rendered in the footer. |
| Ombudsman credential presentation | ⛔ | Q15 open — `/trust/ombudsman` exists; how the credential is shown is a founder decision. |
| Permitted-use gate before a unit goes live | ✅ / ⛔ | The gate exists and blocks go-live. Whether it should **refuse** without a confirmed compliance record behind it is Q43(a), still open — today a bare timestamp satisfies it. |
| TM30 within 24 hours, with escalation | ✅ | Filing, SLA and escalation built; the config ceiling can only be tightened. |
| TM30 process rehearsed with staff | ❓ | A human rehearsal, not a code path (Q10). Nobody can tick this from a terminal — do a dry run with the on-site team before the first foreign arrival. |
| Retention jobs running | ✅ | `runRetentionJobs` with a cron route; passports purge on the configured window. |
| Audit trail readable and exportable | ✅ | `/app/admin/audit`, with a recorded CSV export for doc 12 §6's monthly review. |
| Content reviewed by the founder | ⚠️ | Most copy is seeded as `needs_review` drafts, by design — they render, but nobody has approved the tone or the Russian. **Counted precisely (2026-08-25): 1,309 of 1,508 keys (87%) are still `needs_review`.** RU is 100% present, EN 99.7% — completeness was never the gap, review is. Thai has a real row for only 272 keys (18%) — Q19. Walk the content editor before launch, starting with what a guest actually sees. |
| `no-literal-ui-text` lint actually enforced | ✅ (with tracked debt) | Fixed (Q54) — the plugin is now registered in `.eslintrc.json` and runs for real. Wiring it in surfaced 371 genuine pre-existing violations, listed by exact file in a documented `overrides` exclusion (62 files) so the rule stays a hard error everywhere else, including all new code. The duplicate reconciliation page that bypassed the content system entirely is fixed, not on the debt list. Working down the 371-file list is separate follow-up work. |

## 5. The product itself

| Item | State | Evidence / action |
|---|---|---|
| Booking loop end to end | ⚠️ | Search → book → pay (cash) → stay is solid end to end (real code at every step, no stubs — confirmed by a fresh journey audit). **"→ review" does not actually exist for a stay**: see the Guest stay reviews row below (Q62) — the checklist previously claimed this without verifying it. |
| Card payments | ⚠️ | Provider chosen and adapter built (Opn, Q8 ruled 2026-08-24). **Blocked on the merchant account**, which is a KYC application Ignatev Estate makes. The adapter is unit-tested against a stubbed transport and has **never touched a live Opn account** — not "proven" until a test-key charge runs end to end. |
| Bank transfer | ✅ | Payer sees the company's Krungsri account and a booking-derived reference; staff confirm against the statement; payment and ledger entry are written in one transaction. Twelve tests, including that the corporate tax number appears and the director's personal one never does. |
| Who money is paid to | ✅ | `merchant.*` configuration (doc 04 §11) — legal name, tax number, bank, account, SWIFT. Editable in the admin panel; there is exactly one of it. |
| Deposits | ⚠️ | `booking.deposit.mode = preauth` has **never placed a hold** — neither implementation was called from the booking path, and where the hold is taken and released is a founder ruling (Q46). Deposits default to `off`, so nothing is broken today; the feature simply does not work if switched on. |
| Owner and provider payouts | ✅ | Built (Q51) — `/app/admin/payouts` now has a form for both flows: owner amount locked to the statement's `ownerShareThb`, provider amount computed via a new read-only preview route before submitting, both against the routes' existing server-side validation (Q34's fixed remittance math). |
| Disputes (F-DIS-2) | ✅ | Built (Q52) — `raiseDispute`/`decideDispute` (`src/modules/comms/dispute.service.ts`), reusing the existing ticket and finance/refund seams rather than inventing a new one. `POST /api/disputes` to raise one (wired into `/trips/[id]`); `/app/admin/disputes` to resolve one (in the admin nav). 11 integration tests. CLAUDE.md's fee-transparency promise ("owner can dispute any fee within 30 days") now has a mechanism behind it. |
| Manual pricing / availability overrides | ✅ | Built (Q53, F-OPS-4) — `createManualBlock`/`createPricingRule` etc. (`src/modules/core/availability.service.ts`), concurrency-safe via advisory locks, wired into `/app/admin/units/[id]` (`AvailabilityPricingPanel`). 9 integration tests. Surfaced a real latent permission bug along the way (Q58, still open) that this fix works around narrowly rather than papering over. |
| Every role has a surface | ✅ | Guest, owner, resident, buyer, provider, MC, juristic, staff, admin — with `reachability.test.ts` failing the build if a page has nothing linking to it. **Blind spot closed (Q57)**: the test now also checks every `route.ts` API handler for a caller. |
| Every API route has a caller | ⚠️ | Running the check above for the first time found ~40 built API routes (of 166) with no caller anywhere — mostly admin screens whose backend exists but was never wired to a UI, plus two SSE endpoints (notifications, thread messages) built and never adopted in favor of polling. Listed by route with a grouped reason in `reachability.test.ts`'s `API_DEBT` set so the test passes without hiding the gap. Full list and reasoning in Q59. Not blocking a cash pilot — none of these are on the booking/payment path — but real product surface with no door in. **The two highest-severity items on that list — statement generation and admin sign-off — turned out to be the whole owner-statement/payout chain and are now fixed; see the Statement generation row below (Q61).** |
| Statement generation & operator sign-off | ✅ | Fixed (Q61) — this was the actual severity behind two entries on the API-debt list above: no `OwnerStatement` could ever be created through the product, and even a hand-made one could never leave `draft` (no UI called the operator sign-off route). `/app/admin/statements` now has both actions. A second, orphaned implementation of statement generation (computing revenue from a ledger write path nothing in production calls) was found and deleted in the same pass — same "two disagreeing implementations, one of them dead" shape as Q34. 17 tests (5 new golden-number tests ported from the deleted module). |
| Services marketplace has listings | ✅ | Fixed (Q60) — the category grid (transfer, cleaning, chef, flowers, etc.) was always real; there were simply zero `active` `Service` rows, since the only creation path was a provider's own portal landing in `draft`. Staff can now add a service directly for an existing vetted provider (`/app/admin/services`, English+Russian required) and it goes live immediately. Also fixed: service titles/descriptions weren't locale-resolved anywhere on read — RU/EN/TH fields existed on the model but nothing used them. Someone still has to actually type in real services — that's a content task, not a further build. |
| Guest stay reviews | ⚠️ | Found during the Q61 audit (Q62): the `Review` model and every reader of it (search-card ratings, project testimonials) already assume `target_type: 'stay'` rows exist — **nothing anywhere ever writes one**. Every villa reads as unrated forever as shipped. Needs a founder call on the prompting flow (when/how a guest is asked, mandatory or not) before it can be built — doc 07/08 don't specify one. Smaller, no-decision-needed follow-up found in the same pass: `POST /api/service-orders/[id]/rate` already exists and works, but no button anywhere calls it. |
| Money displayed correctly everywhere | ✅ | Q47 — the full sweep is done: every producer that handed satang to a baht-expecting formatter across owner, MC, admin, guest, provider and public screens is fixed at the producer boundary, with a regression test at each. **Q49 and Q50 — the two write-path mirrors of the same bug (a provider's own price edit, an admin's NOI-cap entry) are also fixed**, both now round-trip baht-in/baht-out correctly. **One thing this session cannot do: audit existing `Service`/`UnitEngagement` rows for a price or cap set through either form before the fix, which may already be 100× too low** — a one-time data check, not a code task. |
| Design system followed consistently | ⚠️ | The core product (booking, owner, tickets, admin ledger) shows real discipline. **`MoneyAmount` is now built** (Q55, doc 06 §3.1) and adopted in the owner dashboard and statement-detail screens, replacing local `formatCurrency` helpers — the other ~12 files with a local helper, and wider `EmptyState` adoption, are still outstanding. The CRM and buyer-marketplace screens (~30 files) remain entirely outside the design system — hardcoded colors, inert dark-mode classes. The booking widget is also missing its spec'd mobile behavior (bottom sheet, swipeable gallery). Full detail in Q55. Not blocking a pilot; blocking "looks like one finished product." |
| Tests, build, lint | ✅ | Recorded in the commit that adds this file. |

---

## What "ready" means from here

**Ready to pilot on cash, in one building, with staff who know the product:** yes, once the privacy notice exists and the RLS migration is deployed.

**Ready to actually pay anyone afterward:** yes, mechanically, and now genuinely end to end. Owners and providers can be *owed* money correctly (the display fix), the remittance math is correct and single-sourced (Q34, fixed), a statement can actually be generated and signed off (Q61, fixed — this was the missing first step the payout UI depended on), and staff have a screen to record a payout against the result (Q51, built).

**Ready for real owners' money and card payments:** no. §1, the Deposits row, and the payouts row in §5 stand between here and that. Money display and the Q49/Q50 write-path bugs are now fixed and verified.

**Ready to look and feel like one finished product:** not quite — the core booking/owner/admin surfaces are disciplined, and `MoneyAmount` now exists and is adopted in two of them, but the CRM and marketplace screens (~30 files) were built outside the design system, and the booking widget is missing its spec'd mobile behavior. See the Design system row in §5 (Q55). This doesn't block a pilot.

**Disputes and manual pricing/availability overrides (Q52, Q53) are now built and tested** — both were complete product gaps at the last pass, closed this session by reusing existing seams (tickets/refunds/ledger; the availability-block/pricing-rule writer) rather than inventing new ones.

**The items only the founder can close:** Q36 (terms and privacy prose), Q15 (ombudsman), Q43(a) (permitted-use gate), Q46 (when a deposit is taken and released), Q37 (which of the two management-revenue records — `OwnerStatement.estate_share_thb` or `EarnedFee` — is the accrual vs. the settlement), the SSE-vs-polling call in Q59 (adopt the built real-time stream, or delete the unused route), the guest stay-review prompting flow (Q62 — when/how a guest is asked, mandatory or not), and the ENCRYPTION_KEY handling in §2. **Ops has one outstanding action**: the one-time data check on `Service`/`UnitEngagement` rows possibly priced 100× too low from before the Q49/Q50 fix, plus actually typing real services into the now-working marketplace (Q60). **Still open, no founder input needed**: the remaining 42 unwired API routes from the reachability test (Q59 — statement generation and sign-off already removed from that list as Q61), the service-order rating button (Q62), the remaining design-system retrofit (Q55), the 371-file lint debt list (Q54), the MC common-area-services tab (Q57), and `can()`'s permission-level gap (Q58).

---

*Nothing here is ticked without evidence, and nothing is waived — waiving is the founder's signature, not an agent's. Re-run this file's checks before launch and again after any environment change.*
