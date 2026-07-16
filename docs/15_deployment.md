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

A managed platform stack — recommended: **Vercel** (the Next.js app + cron jobs) + **a managed PostgreSQL** (e.g. Supabase/Neon/RDS — **used as plain Postgres**, our Prisma schema, no vendor lock in the code) + **S3-compatible storage** (with the Q6/passport encryption rules from doc 12). Region: **Singapore** (closest to Phuket users; named in the privacy notice per PDPA). Everything the app needs arrives as environment variables from the platform's secret store — no secrets in code (doc 12 §4). DNS: the apex domain to the app; `staging.` subdomain gated by a simple access wall.

The choice is deliberately boring and reversible: the app is a standard Next.js + Postgres deployment, movable to any equivalent host without code changes.

## 3. How changes ship

1. A builder finishes a doc-16 task on a branch; CI runs the full gate (tests, typecheck, lints — doc 14 §8).
2. Merge to `main` → **staging deploys automatically**, including database migrations (Prisma migrate, forward-only; every migration reviewed).
3. The founder (or Fable) checks the change on staging — the affected flow, in a browser.
4. A manual **"promote to production"** step deploys the same build + migrations to production. No Friday-evening promotions; migrations that touch money/compliance tables get a pre-promotion backup point (§5).
5. Rollback = redeploy the previous build (one click); a migration that must be undone gets a new forward migration — never editing history.

Seeds (config registry, content keys, catalogs — docs 04/05) ship as idempotent seed scripts run with migrations, so a fresh environment stands up complete.

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
- **Monitoring & alerts:** uptime check on the public site and the API; error tracking (e.g. Sentry) with alerts to the founder/ops channel; job-failure and webhook-failure alerts; the in-app admin dashboard already surfaces business-level red flags (TM30 at risk, refund failures, iCal conflicts).
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
