# myUNO Deployment Checklist

Production URL: **https://my-uno-final.vercel.app**

Production git branch: **`main`**. All product work merges here. Do not treat
`claude/project-repo-clarification-bavpp0` as production.

---

## 0. GitHub + Vercel + Supabase (do this once)

### GitHub
1. Repo **Settings → General → Default branch** → set to `main`.
2. Protect `main` (required CI check `ci`).

### Vercel (`my-uno-final` in team `pavel949s-projects`)
1. **Settings → Git**
   - Connected repo: `pavel949/myUNO-final`
   - **Production Branch = `main`**
   - Disconnect any extra Vercel project still pointing at this repo. A second
     required project is why GitHub shows “1 required project failed to deploy”
     even when this site is up.
2. **Settings → Environment Variables** — see §1. **Do not set `NODE_ENV`.**
   Next sets it. `NODE_ENV=development` on Vercel breaks `next build`
   (React dual-instance, prerender failures on `/404`, `/legal`, `/design`).
3. After changing env vars: **Deployments → ⋯ → Redeploy** the `main` build.

### Supabase (`MyUno- final`, ref `burcnghheyzbzffzgmjz`)
This app uses Supabase as **plain Postgres**. There is no Supabase JS client.

1. Confirm the project is **ACTIVE** (not paused).
2. **Settings → Database → Connection string → Session pooler** (port **5432**).
   Username must be `postgres.burcnghheyzbzffzgmjz`, not `postgres`.
3. Put that string in Vercel as `DATABASE_URL` for Production, Preview, and
   Development. Never paste the IPv6-only `db.<ref>.supabase.co` host.
4. Optional but preferred: **Vercel Marketplace → Supabase** (or Supabase
   dashboard **Integrations → Vercel**) so `DATABASE_URL` is owned by the
   integration, not a hand-copied secret. After linking, confirm the injected
   URL is still the **session** pooler on 5432.
5. GitHub **Supabase Preview** should run on `main` (it already does). It will
   stay skipped on leftover `claude/**` default-branch PRs until GitHub’s
   default branch is `main`.
6. Deploys do **not** migrate. After schema changes run, from a trusted
   machine:
   `DATABASE_URL="<session pooler URL>" node scripts/provision-database.mjs`

If a database password was ever committed (older copies of this file),
**reset it in Supabase** and update Vercel. Do not put the new password in git.

---

## 1. Vercel Environment Variables

**Vercel → my-uno-final → Settings → Environment Variables**

| Name | Notes |
|---|---|
| `DATABASE_URL` | Session pooler, port 5432, user `postgres.<ref>` |
| `SESSION_SECRET` / `NEXTAUTH_SECRET` | Cookie signing — keep existing |
| `NEXTAUTH_URL` | `https://my-uno-final.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same public origin |
| `ENCRYPTION_KEY` | Keep existing. Never rotate once passports are stored. |
| `CRON_SECRET` | Must match Vercel cron bearer |
| `RESEND_API_KEY` | Set in Vercel only |
| `EMAIL_FROM` | `onboarding@resend.dev` until the domain is verified |
| `CONTENT_REVIEW_GATE_ENABLED` | `true` in production; `false` only to unblock a known review queue |

Do **not** set `NODE_ENV`.

---

## 2. Trigger a production deploy

Push or merge to `main`. Or **Deployments → Redeploy** the latest `main`
deployment, with “use existing build cache” off if env vars just changed.

---

## 3. Verify

```bash
curl -sS https://my-uno-final.vercel.app/api/health
# expect: {"status":"ok","db":"ok"}
```

Then open `/`, `/login`, `/register`, `/projects`.

---

## Troubleshooting

### Vercel build fails with `<Html> should not be imported outside of pages/_document`
`NODE_ENV` is set to `development` on the Vercel project. Delete that variable
and redeploy.

### Vercel build fails: content pending founder review
The content-review gate connected to the database and found `needs_review`
rows. Review them in admin, or temporarily set
`CONTENT_REVIEW_GATE_ENABLED=false` (Production) and redeploy.

### `503 {"status":"degraded","db":"unreachable"}`
Wrong `DATABASE_URL`, paused Supabase project, or no redeploy after changing
the URL. Use the session pooler.

### `503 {"status":"degraded","db":"pool_exhausted"}`
Too many session-pooler clients. Runtime caps each isolate at
`connection_limit=1`. Wait for isolates to recycle, then redeploy this build.

### GitHub “1 required project failed to deploy”
A second Vercel project (or an old Production Git integration) is required
and red. Open
https://vercel.com/pavel949s-projects/~/deployments?repo=github%2Fpavel949%2FmyUNO-final
and disconnect the extra project.

### Email not arriving
`RESEND_API_KEY` missing. Function logs show `[EMAIL - DEV/MISSING_KEY]`.
