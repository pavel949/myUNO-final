#!/usr/bin/env node
/**
 * db:verify — prove the repository can build its own database, and that the
 * committed datamodel still describes it.
 *
 * The migration/datamodel split this guards against was not hypothetical. In
 * September 2026 the canonical v3 application layer was reverted while its
 * migrations were restored, leaving `schema.prisma` describing nine fewer
 * tables than the migration chain creates. Nothing failed: the build was
 * green, the tests passed, production stayed up. The repository had simply
 * stopped being able to describe its own database, and no check noticed.
 *
 * Four gates, each of which was failing at the time this was written:
 *
 *   1. REPLAY   — the full chain applies to an empty database. Not just the
 *                 newest migration: the whole history, the way a new
 *                 environment or a restore drill would.
 *   2. SECURITY — the canonical v3 operational tables are not reachable by
 *                 `anon` or `authenticated` afterwards. Supabase exposes new
 *                 public tables through the Data API by default, so this is
 *                 the assertion that the closing migration actually closed
 *                 them.
 *   3. DRIFT    — `schema.prisma` matches what the chain produced. This is the
 *                 gate that was absent.
 *   4. NO-OP    — re-running the chain changes nothing, so deploys stay
 *                 idempotent.
 *
 * Usage:  npm run db:verify
 *
 * Needs a PostgreSQL server it may create and drop a scratch database on,
 * taken from DATABASE_URL (the scratch database is a sibling of it, never the
 * database named in it). Production credentials are neither needed nor
 * appropriate: this only ever talks to a throwaway database.
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROLES_SQL = join(root, 'scripts', 'sql', 'supabase-compat-roles.sql');

/** Tables the security gate asserts are closed to the Data API. */
const OPERATIONAL_TABLES = [
  'service_quote_request',
  'service_quote_version',
  'booking_reschedule',
  'external_system',
  'external_mapping',
  'external_event_inbox',
  'external_aggregate_checkpoint',
  'property_onboarding_template',
  'project_onboarding_draft',
];

function loadDotEnv() {
  const f = join(root, '.env');
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] === undefined) process.env[k] = raw.replace(/^["']|["']$/g, '');
  }
}

function run(cmd, args, env) {
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function psql(url, sql) {
  return run('psql', [url, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]).trim();
}

const results = [];
function gate(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function main() {
  loadDotEnv();

  const base = process.env.DATABASE_URL;
  if (!base) {
    console.error('db:verify needs DATABASE_URL pointing at a PostgreSQL server it may use for a scratch database.');
    process.exit(2);
  }

  // Derive a sibling scratch database. The URL in DATABASE_URL is only used to
  // reach the server; its own database is never touched.
  const parsed = new URL(base);
  const scratch = `p0_verify_${randomBytes(4).toString('hex')}`;
  const adminUrl = new URL(base);
  adminUrl.pathname = '/postgres';
  const scratchUrl = new URL(base);
  scratchUrl.pathname = `/${scratch}`;

  const admin = adminUrl.toString();
  const target = scratchUrl.toString();

  console.log(`\ndb:verify — scratch database ${scratch} on ${parsed.host}\n`);

  let created = false;
  try {
    run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${scratch}"`]);
    created = true;

    // Supabase-compatible roles, so the chain's REVOKE has both a subject and
    // something to remove. See scripts/sql/supabase-compat-roles.sql.
    run('psql', [target, '-v', 'ON_ERROR_STOP=1', '-f', ROLES_SQL]);

    // Gate 1 — the whole chain, from empty.
    try {
      const out = run('npx', ['prisma', 'migrate', 'deploy'], {
        DATABASE_URL: target,
        DIRECT_URL: target,
      });
      const applied = (out.match(/Applying migration/g) || []).length;
      gate('migration replay', true, `${applied} migrations applied to an empty database`);
    } catch (e) {
      gate('migration replay', false, (e.stdout || '') + (e.stderr || e.message));
      throw new Error('replay failed');
    }

    // Gate 2 — the Data API surface is closed.
    const leaked = psql(
      target,
      `SELECT coalesce(string_agg(DISTINCT table_name || ':' || grantee, ', '), '')
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee IN ('anon','authenticated')
          AND table_name IN (${OPERATIONAL_TABLES.map((t) => `'${t}'`).join(',')})`,
    );
    gate(
      'data api closed on operational tables',
      leaked === '',
      leaked === '' ? `${OPERATIONAL_TABLES.length} tables unreachable by anon/authenticated` : `still granted: ${leaked}`,
    );

    const rlsOff = psql(
      target,
      `SELECT coalesce(string_agg(relname, ', '), '')
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
          AND c.relname IN (${OPERATIONAL_TABLES.map((t) => `'${t}'`).join(',')})`,
    );
    gate('row level security enabled', rlsOff === '', rlsOff === '' ? 'all operational tables' : `missing on: ${rlsOff}`);

    // Gate 3 — the datamodel still describes the database the chain built.
    const diff = run('npx', [
      'prisma', 'migrate', 'diff',
      '--from-url', target,
      '--to-schema-datamodel', 'prisma/schema.prisma',
      '--script',
    ]);
    const statements = diff
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('--'))
      .length;
    gate(
      'schema.prisma matches migrations',
      statements === 0,
      statements === 0 ? 'no drift' : `${statements} statements of drift — run the reconciliation in docs/runbooks/database-recovery.md`,
    );
    if (statements > 0) {
      console.log('\n--- drift ---\n' + diff.trim() + '\n-------------\n');
    }

    // Gate 4 — deploys are idempotent.
    const again = run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: target, DIRECT_URL: target });
    gate('replay is idempotent', /No pending migrations/.test(again), 'second deploy applied nothing');
  } finally {
    if (created) {
      try {
        run('psql', [admin, '-c', `DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`]);
      } catch {
        console.warn(`\n(could not drop scratch database ${scratch}; drop it by hand)`);
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} gates passed\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\ndb:verify aborted: ${e.message}\n`);
  process.exit(1);
});
