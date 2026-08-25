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
| Database region matches the published privacy notice | ✅ (notice) / ⛔ (decision) | **The notice is now true**: it names Mumbai, which is where the data actually is, so nothing is misrepresented today. The *decision* is still open (Q45) — doc 15 §2 wants Singapore, and the recommendation is to move while the database is small. Runbook in doc 15 §2.7; the location is a content key, so correcting the notice after a move is an edit, not a deployment. |
| `ENCRYPTION_KEY` generated, set identically everywhere, and written down offline | ❓ | Cannot be checked from here, and this is the one item with no second chance: change or lose it and **every stored passport becomes permanently unreadable** (doc 15 §4). Confirm it is set in Vercel production, matches staging, and exists in a physical vault — before any real guest data. |
| Whether production already holds encrypted data | ❓ | Could not query production row counts in this session. It decides whether the key can still be rotated at all. Check `tm30_filing` before touching the key. |
| Production connection string out of developer `.env` files | ⚠️ | Flagged earlier in this build and **not resolved**. A production credential in a developer file is a credential to rotate, not to tidy. Rotate it and set it only in Vercel. |
| Row-level security on every table | ✅ (code) / ❓ (production) | Migration + test in this commit; production pending the deploy above. |
| `.env.example` lists every variable the app reads | ⚠️ | Nine are missing (Q56) — most importantly the **entire Opn/Omise card-payment surface** (`OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`, `OMISE_WEBHOOK_SECRET`, `PAYMENT_PROVIDER`), plus `BLOB_READ_WRITE_TOKEN`, `ICAL_FEED_SECRET`, `NEXT_PUBLIC_APP_URL`, `ALERT_WEBHOOK_URL`, `LOG_SILENT`. Nothing breaks today (all degrade gracefully); the Opn ones become load-bearing the day the merchant account is approved. |

## 3. Monitoring and operations

| Item | State | Evidence / action |
|---|---|---|
| Structured, PII-scrubbed logging | ✅ | `src/lib/observability.ts` — JSON to stdout with a correlation id, scrubbed. Lands in the Vercel log and is searchable by the reference shown on an error page. |
| Error alerting | ⚠️ | **The transport now exists; it needs one env var to go live.** `reportError` (`src/lib/observability.ts`) pushes every unexpected error (5xx, never the caller's own 4xx mistakes) to `ALERT_WEBHOOK_URL` — a Slack incoming-webhook URL, or anything that accepts a JSON POST with a `text` field. Unset, it stays a correct no-op (same seam pattern as payments and email); tested in `observability.test.ts`. **Set `ALERT_WEBHOOK_URL` in Vercel** (a Slack incoming webhook takes minutes to create) and production errors start paging the ops channel with no further code change. First version only: no retry, no queue, no dedup — a genuine incident storm can still flood the channel, and job-failure alerts (the scheduler, below) don't push to it yet, only request-path errors do. |
| Uptime check on the public site and API | ❓ | Not configurable from the repository. `/api/health` exists to point a monitor at. |
| Scheduler jobs report last run and outcome | ⚠️ | Doc 15 §5 asks for an admin health panel showing each job's last run — "a silent scheduler is a visible red light, not a mystery". The jobs exist; the panel does not. |
| Backups and point-in-time recovery enabled | ❓ | Depends on the Supabase plan tier and is not exposed to this session. Confirm in the dashboard: daily backups on, PITR window 30 days. |
| Restore drill performed | ⚠️ | Doc 15 §5 requires a quarterly restore into staging to prove the backups are real. **Never done.** A backup nobody has restored is a belief, not a backup. |
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
| `no-literal-ui-text` lint actually enforced | ⚠️ | **It isn't.** The rule exists on disk but the root `.eslintrc.json` never loads it (Q54) — `npx eslint . --max-warnings 0` has been passing clean all session because the rule is inert, not because the codebase complies. Confirmed at least one live page bypasses the content system entirely while lint stays green. Wire the rule in, then see the real backlog. |

## 5. The product itself

| Item | State | Evidence / action |
|---|---|---|
| Booking loop end to end | ✅ | Search → book → pay (cash) → stay → review, covered by the suite. |
| Card payments | ⚠️ | Provider chosen and adapter built (Opn, Q8 ruled 2026-08-24). **Blocked on the merchant account**, which is a KYC application Ignatev Estate makes. The adapter is unit-tested against a stubbed transport and has **never touched a live Opn account** — not "proven" until a test-key charge runs end to end. |
| Bank transfer | ✅ | Payer sees the company's Krungsri account and a booking-derived reference; staff confirm against the statement; payment and ledger entry are written in one transaction. Twelve tests, including that the corporate tax number appears and the director's personal one never does. |
| Who money is paid to | ✅ | `merchant.*` configuration (doc 04 §11) — legal name, tax number, bank, account, SWIFT. Editable in the admin panel; there is exactly one of it. |
| Deposits | ⚠️ | `booking.deposit.mode = preauth` has **never placed a hold** — neither implementation was called from the booking path, and where the hold is taken and released is a founder ruling (Q46). Deposits default to `off`, so nothing is broken today; the feature simply does not work if switched on. |
| Owner and provider payouts | ⚠️ | **No screen anywhere lets staff actually pay someone** (Q51). `POST /api/admin/payouts/{owner,provider}` exist, are tested, and have zero callers — the admin payouts page only lists and reconciles payouts already recorded. The provider route also imports the older, disputed remittance formula (Q34) — wiring a "pay provider" button before that's resolved would pay the wrong amount. |
| Disputes (F-DIS-2) | ⚠️ | Fully specified in doc 07; nothing built (Q52). CLAUDE.md's own fee-transparency promise ("owner can dispute any fee within 30 days") has no mechanism behind it today. |
| Manual pricing / availability overrides | ⚠️ | Staff cannot block a unit for maintenance or set a one-off rate by hand (Q53) — the only writer to availability/pricing today is the automatic iCal-sync job. |
| Every role has a surface | ✅ | Guest, owner, resident, buyer, provider, MC, juristic, staff, admin — with `reachability.test.ts` failing the build if a page has nothing linking to it. **Known blind spot (Q57): this only checks `page.tsx` files, never that an API route (`route.ts`) has any caller — exactly how the payout routes above went unnoticed.** |
| Money displayed correctly everywhere | ✅ | Q47 — the full sweep is done: every producer that handed satang to a baht-expecting formatter across owner, MC, admin, guest, provider and public screens is fixed at the producer boundary, with a regression test at each. **Q49 and Q50 — the two write-path mirrors of the same bug (a provider's own price edit, an admin's NOI-cap entry) are also fixed**, both now round-trip baht-in/baht-out correctly. 1683 tests / 134 files green, build clean, lint clean. **One thing this session cannot do: audit existing `Service`/`UnitEngagement` rows for a price or cap set through either form before the fix, which may already be 100× too low** — a one-time data check, not a code task. |
| Design system followed consistently | ⚠️ | The core product (booking, owner, tickets, admin ledger) shows real discipline. The CRM and buyer-marketplace screens (~30 files) were built entirely outside it — hardcoded colors, inert dark-mode classes — and two spec'd shared components (`MoneyAmount`, wider `EmptyState` adoption) were never built, so duplication persists. The booking widget is also missing its spec'd mobile behavior (bottom sheet, swipeable gallery). Full detail in Q55. Not blocking a pilot; blocking "looks like one finished product." |
| Tests, build, lint | ✅ | Recorded in the commit that adds this file. |

---

## What "ready" means from here

**Ready to pilot on cash, in one building, with staff who know the product:** yes, once the privacy notice exists and the RLS migration is deployed.

**Ready to actually pay anyone afterward:** no. Owners and providers can be *owed* money correctly now (the display fix), but nothing in the product can *pay* one — see the new Owner and provider payouts row in §5 (Q51), which also surfaces an unresolved disagreement (Q34) about how much a provider is even owed.

**Ready for real owners' money and card payments:** no. §1, the Deposits row, and the payouts row in §5 stand between here and that. Money display and the Q49/Q50 write-path bugs are now fixed and verified.

**Ready to look and feel like one finished product:** not quite — the core booking/owner/admin surfaces are disciplined, but the CRM and marketplace screens (~30 files) were built outside the design system, and the booking widget is missing its spec'd mobile behavior. See the Design system row in §5 (Q55). This doesn't block a pilot.

**The items only the founder can close:** Q36 (terms and privacy prose), Q45 (Mumbai or Singapore), Q15 (ombudsman), Q43(a) (permitted-use gate), Q46 (when a deposit is taken and released), Q34 (which provider-remittance formula is right — now blocking Q51 too), and the ENCRYPTION_KEY handling in §2. **Ops has two outstanding actions**: the one-time data check on `Service`/`UnitEngagement` rows possibly priced 100× too low from before the Q49/Q50 fix, and adding the nine missing lines to `.env.example` (Q56) before the Opn merchant account lands.

---

*Nothing here is ticked without evidence, and nothing is waived — waiving is the founder's signature, not an agent's. Re-run this file's checks before launch and again after any environment change.*
