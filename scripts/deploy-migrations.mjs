#!/usr/bin/env node
/**
 * Applies the migration chain at deploy time.
 *
 * This was the missing half of the deploy. `scripts/repair-failed-migrations.mjs`
 * says in its own docstring that it "runs before `prisma migrate deploy`" — but
 * nothing in this repository ever ran `prisma migrate deploy` outside CI's
 * throwaway test database. So the unsticking step existed while the step it
 * unsticks *for* did not, and the schema reached no real database from the
 * pipeline at all. A hosted Postgres sat eight migrations behind while every
 * build went green.
 *
 * Three behaviours, chosen so this can sit in the build without becoming a new
 * way for deploys to break:
 *
 * 1. **No DATABASE_URL** — skip, exit 0. Local installs, CI steps that only
 *    typecheck, and preview builds without a database must still work.
 * 2. **DATABASE_URL set but unreachable** — skip, exit 0, and say so loudly.
 *    A database that is merely asleep should not fail a build; that is what the
 *    repair script already decided for the same situation, and one policy is
 *    better than two.
 * 3. **Reachable, and a migration genuinely fails** — exit non-zero. Shipping
 *    code against a schema that refused to move is the failure worth stopping
 *    for: the app would start and then break at the first query.
 *
 * Set `SKIP_MIGRATE_DEPLOY=1` to opt out entirely.
 *
 * **Migrating is opt-in, never a side effect of building.** It runs on a Vercel
 * production deploy, or when `MIGRATE_ON_BUILD=1` says so, and skips otherwise.
 * Two things make that necessary: a Vercel environment variable covers every
 * environment unless scoped, so one `DATABASE_URL` would let a preview build of
 * any branch migrate production; and this repository's own `.env` points
 * `DATABASE_URL` at the production Supabase instance, so a developer running
 * `npm run build` would migrate production without ever asking to.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(repoRoot, 'prisma', 'schema.prisma')

const say = (message) => console.log(`[migrate-deploy] ${message}`)

if (process.env.SKIP_MIGRATE_DEPLOY === '1') {
  say('SKIP_MIGRATE_DEPLOY=1 — skipping.')
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  say('No DATABASE_URL — nothing to migrate. Skipping.')
  process.exit(0)
}

// Migrating is opt-in, never a side effect of building.
//
// Two ways this bites otherwise. A Vercel environment variable covers every
// environment unless scoped, so one DATABASE_URL would let a preview build of
// any branch migrate production. And this repository's own .env points
// DATABASE_URL at the production Supabase instance, so a developer running
// `npm run build` would migrate production without ever asking to.
//
// So: run on a real production deploy, or when someone says so explicitly.
const isVercelProduction = process.env.VERCEL_ENV === 'production'
const explicitlyAsked = process.env.MIGRATE_ON_BUILD === '1'
if (!isVercelProduction && !explicitlyAsked) {
  say(
    process.env.VERCEL_ENV
      ? `VERCEL_ENV=${process.env.VERCEL_ENV} — only production deployments migrate. Skipping.`
      : 'Not a production deploy. Set MIGRATE_ON_BUILD=1 to migrate. Skipping.'
  )
  process.exit(0)
}

if (!existsSync(schemaPath)) {
  say(`No schema at ${schemaPath} — skipping.`)
  process.exit(0)
}

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy', '--schema', schemaPath],
  { stdio: 'pipe', encoding: 'utf8', cwd: repoRoot }
)

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
if (output.trim()) console.log(output.trim())

if (result.status === 0) {
  say('Migrations are up to date.')
  process.exit(0)
}

// P1001 is "cannot reach the database server". That is an environment fact, not
// a broken migration, and it is the one failure this step forgives — matching
// what the repair script already does rather than inventing a second policy.
if (output.includes('P1001')) {
  say('Database unreachable (P1001) — skipping migrations. The schema was NOT updated.')
  process.exit(0)
}

say('A migration failed to apply. Refusing to continue: the code would ship against a schema that did not move.')
process.exit(result.status ?? 1)
