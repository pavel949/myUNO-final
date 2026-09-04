# Connecting the database — the short version

Everything the platform stores lives in one PostgreSQL database. Connecting it is
two things: give the app a connection string, and bring the database up to date.

Written to be followed start to finish without reading the rest of the docs.

---

## 1. Copy the connection string

**Supabase → your project → Settings → Database → Connection string → Session pooler**

It looks like this:

```
postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

The username is `postgres.` plus the project ref — not `postgres` alone. The
session pooler rejects a bare `postgres` user even when the password is correct.

Replace `YOUR-PASSWORD` with the database password. If you don't have it, use
**Reset database password** on that page — the password is not recoverable, only
replaceable.

> **Pick the Session pooler, not the Transaction pooler.**
>
> | Option | Port | Use it? |
> |---|---|---|
> | **Session pooler** | 5432 | ✅ Works for everything |
> | Transaction pooler | 6543 | ❌ Migrations fail on it |
> | Direct connection | 5432 | ⚠️ IPv6-only on new projects — often unreachable |
>
> The setup command below stops with an explanation if you paste the wrong one,
> so a mistake here costs seconds, not an afternoon.

---

## 2. Bring the database up to date

From the project folder, with your string in place of the example:

```bash
DATABASE_URL="postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  node scripts/provision-database.mjs
```

That one command creates every table, loads the business rules and all the
RU/EN/TH text, then checks its own work. Expect roughly:

```
   config parameters : 76
   content keys      : 1123
   translations      : 2585

✓ ... is migrated and seeded.
```

**If the counts are zero it tells you and exits non-zero.** That matters: with an
empty content table every page silently falls back to its English draft, so the
site looks merely untranslated rather than broken.

No properties, owners or bookings are created. Real inventory is added through
the admin panel — the demo data in `prisma/seed.ts` is for local and staging only
and must never touch a live domain.

---

## 3. Give the connection string to the app

**Vercel → your project → Settings → Environment Variables**

| Name | Value | Environments |
|---|---|---|
| `DATABASE_URL` | the same string from step 1 | Production, Preview, Development |

Then **Deployments → ⋯ → Redeploy**. Environment variables are read at build and
boot, so an existing deployment will not pick up a new value on its own.

While you're there, confirm these are also set — the app needs them to run:

| Name | What it is |
|---|---|
| `NEXTAUTH_SECRET` | signs session cookies — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | the public base URL, e.g. `https://myuno.co` |
| `ENCRYPTION_KEY` | encrypts passports — see the warning below |
| `CRON_SECRET` | protects the scheduled-job endpoints |

> ### `ENCRYPTION_KEY` is the one you cannot get wrong
>
> Generate it **once** with `openssl rand -hex 32`, set it identically
> everywhere, and store it somewhere durable and private.
>
> Once it has encrypted a single passport it can never be changed or lost. A
> different key does not mean "re-enter the data" — it means every encrypted
> record is permanently unreadable. Treat it like the key to a safe whose lock
> cannot be replaced. Full rules: `docs/15_deployment.md` §4.

---

## 4. Check it worked

Open:

```
https://your-domain/api/health
```

| Response | Meaning |
|---|---|
| `{"status":"ok","db":"ok"}` | Connected. |
| `503 {"status":"degraded","db":"pool_exhausted"}` | The session pooler has no free clients. Runtime now caps each Vercel isolate at one connection; wait for warm isolates to recycle, then redeploy this build. |
| `503 {"status":"degraded","db":"unreachable"}` | The app cannot reach the database — wrong `DATABASE_URL`, a paused project, or no redeploy after changing it. |

Then load the site itself. If pages render in **Russian**, the content layer is
live. If everything is in **English**, the app is reaching the database but the
registries are empty — re-run step 2.

That difference is the quickest real check you have: English text is not a
missing-translation problem, it's a missing-database problem.

---

## Running it again later

`scripts/provision-database.mjs` is safe to re-run. Both steps are idempotent —
migrations already applied are skipped, and seeding updates existing rows rather
than duplicating them. After any schema change, run it again against each
environment.

## If something goes wrong

| Symptom | Cause |
|---|---|
| Connection times out, no error text | IPv6-only direct connection, or a paused Supabase project — check the project is **ACTIVE**, and use the session pooler |
| `prepared statement ... already exists` | You used the transaction pooler (6543). Switch to 5432 |
| `P3009: migration failed` | A previous migration failed partway. `scripts/repair-failed-migrations.mjs` clears the blocking row; it runs automatically at build |
| Site renders in English | Registries empty — re-run step 2 |
| `503` from `/api/health` | Wrong or missing `DATABASE_URL`, or no redeploy since setting it |

---

## Related

- `docs/15_deployment.md` — the full picture: environments, backups, secrets, rollback
- `CONTRIBUTING.md` — local development, and the two different seed commands
- `SECURITY.md` — reporting a vulnerability, and secret handling
