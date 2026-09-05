# 15 · Deployment & Operations — how it runs, in plain language

**What this document is.** Where the platform lives, how changes reach it safely, what happens when something breaks, and the small routine that keeps it healthy. Written for a non-technical founder first; the builder-facing specifics are in the tables.

---

## 1. The shape

One application (the modular monolith), one PostgreSQL database, one object-storage bucket, one scheduler for background jobs. Three copies of the world:

| Environment | Purpose | Data |
|---|---|---|
| **Local** | Builders' machines | Seed/demo data only |
| **Staging** | The rehearsal stage — every change is seen here first; the mock payment adapter; safe to break | Realistic fake data; **never real passports or cards** |
| **Production** | The real thing at the real domain | Real data, real (licensed-provider) payments |

## 2. Hosting

A managed platform stack — recommended: **Vercel** (the Next.js app + cron jobs) + **a managed PostgreSQL** (e.g. Supabase/Neon/RDS — **used as plain Postgres**, our Prisma schema, no vendor lock in the code) + **S3-compatible storage** (with the Q6/passport encryption rules from doc 12). Region: **Mumbai, ap-south-1** (AWS infrastructure; named in the privacy notice per PDPA — data at rest in India). Everything the app needs arrives as environment variables from the platform's secret store — no secrets in code (doc 12 §4). DNS: the apex domain to the app; `staging.` subdomain gated by a simple access wall.

The choice is deliberately boring and reversible: the app is a standard Next.js + Postgres deployment, movable to any equivalent host without code changes.


### 2.1 What is actually provisioned

Vercel project `my-uno-final`; database on **Supabase**, project **`MyUno-final`** (ref `burcnghheyzbzffzgmjz`), region **ap-south-1 (Mumbai)**. Supabase is used as plain Postgres over Prisma — the Supabase client libraries are not used anywhere, which is why the platform's own auth and row-level security are not part of the access model. **Scoping is enforced server-side in every query (doc 03); that has not changed.**

✅ **Row-level security is now enabled on all tables** (verified 2026-08-19; was disabled on 57 tables when this section was written).** Supabase exposes an auto-generated REST API to the `anon` role, and its key is public by design, so with RLS off every row — passports, payments, the ledger, the audit log — is readable and writable by anyone holding it. This exists independently of the application code and none of the doc 03 scoping protects against it. See §2.3.

### 2.2 Connection strings — which one, and why it matters

Supabase offers three addresses for the same database, and they are not interchangeable:

| Address | Port | Migrations | Runtime | Notes |
|---|---|---|---|---|
| **Session pooler** `aws-0-<region>.pooler.supabase.com` | 5432 | ✅ | ✅ | **Use this.** IPv4, behaves as ordinary Postgres. Username must be `postgres.<project-ref>`, not `postgres`. Each Vercel isolate is capped at `connection_limit=1` so the pooler's 15 session slots are not exhausted. |
| Transaction pooler | 6543 | ❌ | ✅ | No prepared statements or advisory locks — `prisma migrate deploy` fails |
| Direct `db.<ref>.supabase.co` | 5432 | ✅ | ✅ | IPv6-only on new projects without the IPv4 add-on; frequently unreachable, and it fails as a silent timeout rather than an error |

The schema declares a single `url = env("DATABASE_URL")` and no `directUrl`, deliberately: one variable, one address, nothing to keep in sync. The session pooler serves both roles, so the extra complexity buys nothing here.

`scripts/provision-database.mjs` rejects a transaction-pooler URL up front and names the right one, because that failure otherwise surfaces as an unrelated-looking prepared-statement error.

### 2.3 Row-level security on Supabase

The application connects as the table owner, and **Postgres table owners bypass RLS by default** (they are subject to it only under `FORCE ROW LEVEL SECURITY`, which is not set). So enabling RLS with **no policies at all** closes the public REST surface while leaving the application untouched — the opposite of the usual Supabase advice, and correct precisely because the Supabase client libraries are unused here.

Verified on a scratch database with this schema: a non-owner role holding full table grants went from reading 76 rows to 0 once RLS was enabled, while the owner continued to read all 76 and the registry seed completed its reads and writes normally.

Remediation is `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` for every application table. **Applied — verified 2026-08-19:** every one of the 73 tables now reports `rls_enabled`, so the public REST surface is closed. The application is unaffected, exactly as the scratch-database test above predicted.

### 2.4 Bringing a database up to date

One command, idempotent, safe to re-run:

```bash
DATABASE_URL="<session pooler URL>" node scripts/provision-database.mjs
```

It applies migrations (`prisma migrate deploy` — never `db push`), seeds **config and content only**, then verifies the registry counts and exits non-zero if they are empty. It never writes the demo projects, units and identities from `prisma/seed.ts`; those are for local and staging, and on a live domain they are indistinguishable from real listings.

Step-by-step, including the Vercel side: **`docs/DATABASE_SETUP.md`**.

Note that deployments do **not** run migrations. The build runs `repair-failed-migrations.mjs` then `prisma generate`, and nothing more — so a schema change reaches an environment only when someone runs the command above against it. An earlier attempt to add `prisma migrate deploy` to the build was reverted: it made every deploy depend on the database being reachable at build time, and the deploy failed the first time it was not.

### 2.5 Prisma Cloud — disconnected 2026-08-18

**Prisma stays; Prisma Cloud does not.** The distinction caused real confusion, so it is written down. **Prisma is the ORM** — the schema, the migration files, the client, used in every query — and is not going anywhere. **Prisma Cloud / Prisma Postgres** was a *hosted database* at `db.prisma.io` plus a GitHub deploy check: never the database this document specifies, and it failed seven consecutive PR checks with `P1001: can't reach database server`.

Nothing in this repository ever referenced it — `schema.prisma` reads `env("DATABASE_URL")` and the integration lived entirely in the Prisma console and the GitHub App — so removing it required no code change, only the two console actions. Confirmed gone: pushes after the disconnection carry one check (Supabase Preview) where they previously carried two.

### 2.6 State of the hosted database (2026-08-19)

`_prisma_migrations` holds **30 rows, 0 unfinished**: the repository's 22 migrations, plus 8 orphans left from before the migrations were renamed to timestamped names. The orphans are cosmetic — they make `prisma migrate status` warn about migrations "not found locally" — and are removable with `DELETE FROM _prisma_migrations WHERE migration_name ~ '^[1-8]_';`.

The seven migrations added on 2026-08-18 were applied through `scripts/supabase-catchup.sql`, generated for a founder working from a phone with no terminal. That script is a one-off record of that catch-up, not a mechanism: §2.4's `provision-database.mjs` remains the way a database is brought up to date.



## 3. How changes ship

1. A builder finishes a doc-16 task on a branch; CI runs the full gate (tests, typecheck, lints — doc 14 §8).
2. Merge to `main` → **staging deploys automatically**, including database migrations (Prisma migrate, forward-only; every migration reviewed). *Correction (2026-08-19): deploys do **not** run migrations — see §2.4. A database is brought up to date by running `scripts/provision-database.mjs` against it.*
3. The founder (or Fable) checks the change on staging — the affected flow, in a browser.
4. A manual **"promote to production"** step deploys the same build + migrations to production. No Friday-evening promotions; migrations that touch money/compliance tables get a pre-promotion backup point (§5).
5. Rollback = redeploy the previous build (one click); a migration that must be undone gets a new forward migration — never editing history.

Seeds (config registry, content keys, catalogs — docs 04/05) ship as idempotent seed scripts run with migrations, so a fresh environment stands up complete.

### 2.7 The region question — ANSWERED: Mumbai (2026-09-05)

**The ruling.** The founder ruled on 2026-09-05 that the database **stays in `ap-south-1` (Mumbai)**. Q45 is closed on that basis. Earlier drafts of this document specified Singapore; §2 above now names Mumbai, and this section records why the mismatch was resolved in that direction rather than the other.

**What made it safe to rule this way.** Under the PDPA the privacy notice tells people where their personal data rests. The notice published at `/legal/privacy` already names Mumbai, through the content key `legal.privacy.location_body` — so the platform has been *accurate* throughout, and the ruling changes no published statement. Nothing was ever misrepresented; the gap was between two internal documents, not between the product and its users.

**The one outstanding action, and it is counsel's.** Accuracy is not the same as adequacy. A cross-border transfer disclosure has to read correctly, not merely name the right country. When counsel reviews the privacy notice (Q36, the D-2 decision), the location and cross-border wording goes in front of them **as a specific question**, not as part of a general read-through. Their edits are content changes to `legal.privacy.location_body`, not code.

**The accepted costs, recorded so they are not rediscovered as surprises:**

- **Cross-region latency.** `vercel.json` pins the functions to `regions: ["sin1"]` (Singapore) while the database is in Mumbai — roughly 2,800km per query. The session pooler runs `connection_limit=1` per isolate, so that round trip is **not** amortised across the several queries a single request makes. This is invisible at pilot volume and is the first thing that will show up under load. It is monitored, not fixed: if search or booking latency becomes a complaint, this is the first place to look, and the fix is either the move below or moving the functions to `bom1`.
- **The explanation.** A Russian-speaking buyer asking where their passport is held gets "India" rather than "Singapore". That is a positioning cost the founder has accepted, not an oversight.

**If this is ever revisited.** The move gets materially more expensive the moment real encrypted guest data lands — it becomes a migration with downtime rather than a dump-and-restore, and the `ENCRYPTION_KEY` must travel with it *intact*, because a different key makes every stored passport permanently unreadable (§4). The runbook is preserved here so a future decision does not have to reconstruct it:

1. Create a new Supabase project in `ap-southeast-1`. (Provisioning billable infrastructure is a founder action, not an agent one.)
2. Set `ENCRYPTION_KEY` on the new environment to **exactly** the existing value, before any data is written. Verify it matches before continuing; there is no recovery from getting this wrong.
3. `prisma migrate deploy` against the new database, then confirm `prisma migrate status` reports it up to date.
4. `pg_dump --data-only` from Mumbai, restore into Singapore. Confirm row counts match on `identity`, `booking`, `payment`, `ledger_entry` and `tm30_filing`.
5. Re-run the RLS check from `scripts/supabase-2026-08-24-rls-and-transfer.sql` §4 — a new project starts with RLS off on everything.
6. Swap `DATABASE_URL` in Vercel production, redeploy, and confirm a booking round-trip works.
7. Edit the content key `legal.privacy.location_body` to name Singapore. **This is the step that keeps the privacy notice true, and it is a content edit, not a deployment.**
8. Drop the `regions: ["sin1"]` note above — functions and database would then be co-located.
9. Correct this section and re-open Q45 with the new ruling.
10. Keep the Mumbai project paused but not deleted for a fortnight, then delete it.

## 4. Encryption key handling (before production go-live)

**The non-negotiable:** The `ENCRYPTION_KEY` (AES-256-GCM, 64-hex) encrypts sensitive PII — chiefly TM30 passports (doc 12 §3). Once this key has encrypted any data in the database, **it can never be changed or lost** — a different key causes permanent decryption failure (GCM auth-tag mismatch) and the data becomes unrecoverable.

**Before any production traffic:**

1. **Generate the key once** — `openssl rand -hex 32` in a secure context.
2. **Set it identically** in all environments (local `.env`, staging Vercel env vars, production Vercel env vars) and **write it down in a secure, physical location** (e.g., a hardware-secured vault, never in a shared file or chat).
3. **Before database swaps** (e.g., migrating from Neon to Supabase): verify the key is set identically in the new environment **before** any data writes. Staging → production swap: same key both places.
4. **Never rotate this key** once it contains encrypted data. If the key is suspected compromised, encrypt new data with a new key and migrate old encrypted fields individually — a migration is the only safe path.
5. **Access control:** only the deployment system (Vercel) and local dev machines should have read access; log every decryption attempt (doc 12 §5).

**What happens if the key is lost or changed:** All existing passports (every TM30 filing row) becomes unreadable. No recovery. Plan accordingly — ops must guard this value as carefully as a database password.

## 5. Day-to-day operation

- **The scheduler** runs the jobs registry (`src/jobs/`, doc 14 §1) from **two sources, deliberately**. Vercel Hobby **refuses any cron that would fire more than once per day** — a 15-minute expression fails the deploy — so `vercel.json` carries two daily slots: `/api/cron/run-frequent` at 07:00 UTC (14:00 ICT — holds, TM30, iCal) and `/api/cron/run-all` at 19:00 UTC (02:00 ICT — verification, retention, rollup, guest messages, service-order expiry, plus a defensive extra pass of hold expiry). iCal is the daytime slot only: each feed may block for 15 seconds, and putting it on the nightly run would starve PDPA retention and verification.

  Daily was never the design. This document asks for **hold expiry every 5 minutes and iCal import every 15**, and running them daily meant holds sitting expired for up to 24 hours — inventory nobody can book — and OTA calendars up to 24 hours stale, which is how double bookings happen. **That gap is closed without a plan upgrade (T-047):** `/api/cron/*` is an ordinary authenticated route (`CRON_SECRET`), so `.github/workflows/scheduler.yml` drives it from GitHub Actions on the real cadence, for free. The Vercel crons stay as a **backstop** — if GitHub Actions is unavailable the schedule degrades to daily rather than stopping.

  Two honest caveats about that scheduler, which is why the thresholds were not simply tightened: GitHub's scheduled workflows are **best-effort** — they queue behind the platform's own load, routinely fire minutes late and can be skipped under peak load — and GitHub **disables scheduled workflows in a repository with no activity for 60 days**. On a quiet repo, check the Actions tab before trusting the cadence. `SCHEDULER_MODE` (`external` | `vercel-daily`, defaulting to the latter) tells the health panel which source is live: on `external` the frequent jobs are judged against the real cadence with six intervals of slack for jitter; unset, the two-day window stands, because a threshold tighter than the schedule would report a working system as broken. Set it to `external` **only once the workflow is confirmed firing**.

  Required for the workflow: repository secret `CRON_SECRET` (matching Vercel) and repository variable `APP_BASE_URL`. Notification digests and monthly statement generation are still admin- or event-driven, not cron jobs — they are not in the registry until they are. Every registered job writes an append-only `job_run` row (last run + outcome). The admin panel at `/app/admin/scheduler` lists the whole registry even when a job has never run — a silent scheduler is a visible red light, not a mystery.
- **Monitoring & alerts:** `reportError` (`src/lib/observability.ts`) pushes every unexpected error (5xx, not the caller's own 4xx mistakes) to `ALERT_WEBHOOK_URL` — a Slack incoming-webhook URL, or any endpoint that accepts a JSON POST with a `text` field (Discord, PagerDuty's generic webhook, etc.). Set that one env var in Vercel and errors start paging the ops channel with no code change; unset, it stays a correct no-op (same seam pattern as the payment and email providers). Scheduler job failures now go through the same seam (`runRegisteredJob`), so a crashed cron pages the channel the same way a 5xx request does. This is a first version — no retry, no queue, no dedup, so a genuine incident storm can still flood the channel; that is a known limitation, not a silent gap. Still needed beyond the webhook: an uptime check on the public site and API (not configurable from the repository — set up in whatever monitor the founder picks and point it at `/api/health`). The in-app admin dashboard already surfaces business-level red flags (TM30 at risk, refund failures, iCal conflicts); the scheduler panel is the red light for the jobs themselves.
- **Logs:** structured, PII-scrubbed (doc 12), searchable on the hosting platform, 30-day retention.
- **Support path:** users hit "something's wrong" → ticket (doc 09); technical incidents follow the doc 12 §7 playbook.

## 5. Backups & the sleep-at-night rules

- **Database:** the managed Postgres's automated daily backups + point-in-time recovery, 30-day window; a **quarterly restore drill** into staging proves backups are real (calendar reminder; result noted in the repo).
- **Object storage:** versioning on; passport-kind objects excluded from any replication outside the region.
- **Before risky changes:** manual snapshot before money/compliance migrations (§3.4).
- **The one rule:** production data never leaves production — staging is fake data by policy, enforced by the seed scripts and by nobody ever restoring prod dumps into staging with 🔒 fields unscrubbed (a scrub script is part of the doc-16 ops tasks).

## 6. Costs (order of magnitude)

Loop one runs comfortably on the hobby-to-team tiers of the pieces above — roughly the price of a nice dinner per month, scaling with traffic. The expensive things (payment provider fees, the WhatsApp Business line) are per-use commercial choices already flagged in `open_questions.md` (Q8, Q9).

## 7. What phase 2 changes

Multi-instance (Redis for the SSE/pub-sub buses — the seams exist), a real channel manager for OTAs, possibly a dedicated analytics store. None of it requires re-architecture; that is what the seams are for.
