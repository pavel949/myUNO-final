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

**⛔ There is no privacy notice or terms.** `legal.terms.title` and `legal.privacy.title` exist as content keys; the **bodies do not** (Q36). Under the PDPA a privacy notice is what makes collecting a passport lawful, and the platform collects passports on day one for TM30. This is counsel's text, not an agent's.

**⚠️ Four tables were readable through the public API.** Supabase serves every table in `public` over PostgREST to anyone holding the anon key — a key that ships to browsers. `ownership_period`, `saved_unit`, `saved_search` and `area` had row-level security **off** and were flagged at ERROR level by Supabase's own linter. Two hold personal data: which homes a named person is watching, and the searches they saved.
**Root cause, which is the more important finding:** RLS was applied across the database in August 2026 **by hand in the dashboard** (doc 15 §2.3), so the decision never entered the repository. Every table created by a migration since was born exposed and nothing noticed for months.
**Fixed in this commit** by `20260824000021_rls_every_table`, which enables RLS on every table in `public` as a migration, plus `rls.integration.test.ts`, which fails the build if any table lacks it. **The migration still has to be deployed to production** — see §2.

**⚠️ No card payment is possible.** The provider seam has a mock adapter and no provider behind it (Q8). Cash is the intended loop-one rail and cash works, so this is only a blocker for card traffic — but everything downstream of a card is therefore untested against real money: deposits, refunds outside policy, and balance settlement on a date change.

---

## 2. Environment and secrets

| Item | State | Evidence / action |
|---|---|---|
| Production database provisioned | ✅ | `MyUno- final`, Postgres 17.6, `ACTIVE_HEALTHY`. |
| Migrations applied to production | ❓ | 23 migration rows were confirmed applied on 2026-08-19. The **new RLS migration is not among them** — run `prisma migrate deploy` against production, or paste the migration's SQL into the SQL editor, before launch. Verify afterwards with the linter: the four ERROR entries must be gone. |
| Migration chain replays onto an empty database | ✅ | `prisma migrate deploy` run against the test database during this pass; all migrations applied, including the new one, with no manual repair. |
| Database region matches the published privacy notice | ⛔ | **It does not.** Doc 15 §2 specifies Singapore; the project is in `ap-south-1` (**Mumbai**). This is a PDPA disclosure question before it is a latency one (Q45). Cheap to fix now — the fix is a dump-and-restore while the database is small, and it stops being cheap the moment there are real passports. Either move it or correct doc 15 and the notice. |
| `ENCRYPTION_KEY` generated, set identically everywhere, and written down offline | ❓ | Cannot be checked from here, and this is the one item with no second chance: change or lose it and **every stored passport becomes permanently unreadable** (doc 15 §4). Confirm it is set in Vercel production, matches staging, and exists in a physical vault — before any real guest data. |
| Whether production already holds encrypted data | ❓ | Could not query production row counts in this session. It decides whether the key can still be rotated at all. Check `tm30_filing` before touching the key. |
| Production connection string out of developer `.env` files | ⚠️ | Flagged earlier in this build and **not resolved**. A production credential in a developer file is a credential to rotate, not to tidy. Rotate it and set it only in Vercel. |
| Row-level security on every table | ✅ (code) / ❓ (production) | Migration + test in this commit; production pending the deploy above. |

## 3. Monitoring and operations

| Item | State | Evidence / action |
|---|---|---|
| Structured, PII-scrubbed logging | ✅ | `src/lib/observability.ts` — JSON to stdout with a correlation id, scrubbed. Lands in the Vercel log and is searchable by the reference shown on an error page. |
| Error alerting | ⚠️ | **Nothing pages anyone.** `reportError` is deliberately a seam with no transport, and its own comment says so rather than pretending. Attaching Sentry or a log drain is an ops decision with a cost; until it is made, a production error is discovered by a person noticing. |
| Uptime check on the public site and API | ❓ | Not configurable from the repository. `/api/health` exists to point a monitor at. |
| Scheduler jobs report last run and outcome | ⚠️ | Doc 15 §5 asks for an admin health panel showing each job's last run — "a silent scheduler is a visible red light, not a mystery". The jobs exist; the panel does not. |
| Backups and point-in-time recovery enabled | ❓ | Depends on the Supabase plan tier and is not exposed to this session. Confirm in the dashboard: daily backups on, PITR window 30 days. |
| Restore drill performed | ⚠️ | Doc 15 §5 requires a quarterly restore into staging to prove the backups are real. **Never done.** A backup nobody has restored is a belief, not a backup. |
| Incident playbook | ✅ | Doc 12 §7, and `incident_log` exists in the schema. |

## 4. Legal, compliance and content

| Item | State | Evidence / action |
|---|---|---|
| Terms of service body | ⛔ | Q36 — title key only, no prose. Counsel. |
| Privacy notice body | ⛔ | Q36 — same, and this one gates lawful collection of passports. Must also name the database's real country (§2). |
| Legal entity facts published | ✅ | Q16 answered; `legal.entity.*` keys carry the company, DBD number, director and contact, rendered in the footer. |
| Ombudsman credential presentation | ⛔ | Q15 open — `/trust/ombudsman` exists; how the credential is shown is a founder decision. |
| Permitted-use gate before a unit goes live | ✅ / ⛔ | The gate exists and blocks go-live. Whether it should **refuse** without a confirmed compliance record behind it is Q43(a), still open — today a bare timestamp satisfies it. |
| TM30 within 24 hours, with escalation | ✅ | Filing, SLA and escalation built; the config ceiling can only be tightened. |
| TM30 process rehearsed with staff | ❓ | A human rehearsal, not a code path (Q10). Nobody can tick this from a terminal — do a dry run with the on-site team before the first foreign arrival. |
| Retention jobs running | ✅ | `runRetentionJobs` with a cron route; passports purge on the configured window. |
| Audit trail readable and exportable | ✅ | `/app/admin/audit`, with a recorded CSV export for doc 12 §6's monthly review. |
| Content reviewed by the founder | ⚠️ | Most copy is seeded as `needs_review` drafts, by design — they render, but nobody has approved the tone or the Russian. Thai is largely absent. Walk the content editor before launch. |

## 5. The product itself

| Item | State | Evidence / action |
|---|---|---|
| Booking loop end to end | ✅ | Search → book → pay (cash) → stay → review, covered by the suite. |
| Card payments | ⚠️ | §1. Mock adapter only. |
| Deposits | ⚠️ | `booking.deposit.mode = preauth` has **never placed a hold** — neither implementation was called from the booking path, and where the hold is taken and released is a founder ruling (Q46). Deposits default to `off`, so nothing is broken today; the feature simply does not work if switched on. |
| Every role has a surface | ✅ | Guest, owner, resident, buyer, provider, MC, juristic, staff, admin — with `reachability.test.ts` failing the build if a page has nothing linking to it. |
| Money displayed correctly everywhere | ⚠️ | Q47 — amounts are satang; some finance screens hand satang to a baht formatter and may show figures 100× too large. Needs a sweep of every money field before anyone reads a statement. |
| Tests, build, lint | ✅ | Recorded in the commit that adds this file. |

---

## What "ready" means from here

**Ready to pilot on cash, in one building, with staff who know the product:** yes, once the privacy notice exists and the RLS migration is deployed.

**Ready for real owners' money and card payments:** no. §1 and the two ⚠️ money items in §5 stand between here and that.

**The items only the founder can close:** Q36 (terms and privacy prose), Q45 (Mumbai or Singapore), Q15 (ombudsman), Q43(a) (permitted-use gate), Q46 (when a deposit is taken and released), and the ENCRYPTION_KEY handling in §2.

---

*Nothing here is ticked without evidence, and nothing is waived — waiving is the founder's signature, not an agent's. Re-run this file's checks before launch and again after any environment change.*
