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
| **Session pooler** `aws-0-<region>.pooler.supabase.com` | 5432 | ✅ | ✅ | **Use this.** IPv4, behaves as ordinary Postgres. Username must be `postgres.<project-ref>`, not `postgres`. |
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

### 2.7 The region question — Mumbai today, Singapore recommended (2026-08-24)

Doc 15 §2 has always specified **Singapore**. The provisioned project `MyUno- final` is in **`ap-south-1` (Mumbai)**, and that mismatch is Q45.

**Why it is not merely cosmetic.** Under the PDPA the privacy notice tells people where their personal data rests. The notice now published at `/legal/privacy` names Mumbai, so the platform is *accurate* today — but "accurate" and "what we intended" are different things, and passports for every foreign guest will rest wherever this lands.

**The recommendation: move to Singapore (`ap-southeast-1`).** Closest to Phuket users, matches every other document, and removes an explanation nobody wants to give a Russian-speaking buyer about why their passport is in India.

**Why now.** The database is small. Moving is a dump-and-restore that takes minutes. Once there are real guests, bookings and encrypted passports it becomes a migration with downtime — and the `ENCRYPTION_KEY` must travel with it *intact*, because a different key makes every stored passport permanently unreadable (§4).

**Runbook, when the founder decides to move:**

1. Create a new Supabase project in `ap-southeast-1`. (Provisioning billable infrastructure is a founder action, not an agent one — which is why this is a runbook and not a completed step.)
2. Set `ENCRYPTION_KEY` on the new environment to **exactly** the existing value, before any data is written. Verify it matches before continuing; there is no recovery from getting this wrong.
3. `prisma migrate deploy` against the new database, then confirm `prisma migrate status` reports it up to date.
4. `pg_dump --data-only` from Mumbai, restore into Singapore. Confirm row counts match on `identity`, `booking`, `payment`, `ledger_entry` and `tm30_filing`.
5. Re-run the RLS check from `scripts/supabase-2026-08-24-rls-and-transfer.sql` §4 — the new project starts with RLS off on everything.
6. Swap `DATABASE_URL` in Vercel production, redeploy, and confirm a booking round-trip works.
7. Edit the content key `legal.privacy.location_body` to name Singapore. **This is the step that keeps the privacy notice true, and it is a content edit, not a deployment.**
8. Correct this document, and mark Q45 answered.
9. Keep the Mumbai project paused but not deleted for a fortnight, then delete it.

**If the founder decides to stay in Mumbai instead:** nothing needs to change technically — the notice already names it. Correct §2 of this document to say India, and have counsel confirm the cross-border wording reads correctly. Then mark Q45 answered that way.

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

- **The scheduler** runs the jobs registry (doc 14 §1): hold expiry & request auto-decline (every 5 min), iCal sync (15 min), notification digests, nightly metric rollups + retention deletions, monthly statement generation. Every job reports its last run + outcome to an admin health panel — a silent scheduler is a visible red light, not a mystery.
- **Monitoring & alerts:** `reportError` (`src/lib/observability.ts`) pushes every unexpected error (5xx, not the caller's own 4xx mistakes) to `ALERT_WEBHOOK_URL` — a Slack incoming-webhook URL, or any endpoint that accepts a JSON POST with a `text` field (Discord, PagerDuty's generic webhook, etc.). Set that one env var in Vercel and errors start paging the ops channel with no code change; unset, it stays a correct no-op (same seam pattern as the payment and email providers). This is a first version — no retry, no queue, no dedup, so a genuine incident storm can still flood the channel; that is a known limitation, not a silent gap. Still needed beyond the webhook: an uptime check on the public site and API (not configurable from the repository — set up in whatever monitor the founder picks and point it at `/api/health`), and job-failure alerts specifically (the scheduler jobs below don't yet push to the webhook, only request-path errors do). The in-app admin dashboard already surfaces business-level red flags (TM30 at risk, refund failures, iCal conflicts).
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
