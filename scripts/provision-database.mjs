#!/usr/bin/env node
/**
 * Bring a database up to date: apply migrations, seed the registries, verify.
 *
 * This is the production-safe provisioning path. It runs `prisma migrate deploy`
 * (never `db push`), then seeds config and content only — never the demo
 * projects, units and identities in `prisma/seed.ts`, which must not appear on a
 * live domain.
 *
 *   DATABASE_URL="postgresql://..." node scripts/provision-database.mjs
 *
 * Both steps are idempotent, so running it twice is safe and is the normal way
 * to bring an environment back into line after a schema change.
 *
 * ── Supabase: any connection EXCEPT the transaction pooler ──────────────────
 *
 * `prisma migrate deploy` takes an advisory lock and issues DDL. Supabase's
 * *transaction* pooler (port 6543) supports neither, and fails with a confusing
 * prepared-statement error, so this script stops if it sees one.
 *
 * Both of the others are fine:
 *
 *   Session pooler   aws-0-<region>.pooler.supabase.com:5432   ← usually this one
 *   Direct           db.<ref>.supabase.co:5432
 *
 * Prefer the session pooler. Supabase now gives direct connections IPv6-only
 * addresses unless the IPv4 add-on is enabled, and most networks — including
 * plenty of CI runners — cannot reach those, which shows up as a connection
 * timeout with no error message.
 */

import { spawnSync } from 'node:child_process'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to guess which database to provision.')
  process.exit(1)
}

/** Host and database only — never print the password. */
function describeTarget(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  } catch {
    return '(unparseable DATABASE_URL)'
  }
}

const target = describeTarget(DATABASE_URL)
console.log(`\nProvisioning: ${target}\n`)

// Only the transaction pooler is a problem. The session pooler on 5432 is a
// normal Postgres connection and migrates fine — which matters, because it is
// often the only address reachable over IPv4.
if (/:6543/.test(DATABASE_URL) || /pgbouncer=true/.test(DATABASE_URL)) {
  console.error(
    'This is the Supabase transaction pooler (port 6543). It supports neither\n' +
      'the advisory lock nor the DDL that `prisma migrate deploy` needs.\n\n' +
      'Use the session pooler instead — same host, port 5432:\n' +
      '  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n' +
      'Supabase → Settings → Database → Connection string → Session pooler.'
  )
  process.exit(1)
}

function run(label, command, args) {
  console.log(`── ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env })
  if (result.status !== 0) {
    console.error(`\n${label} failed. Nothing further was attempted.`)
    process.exit(result.status ?? 1)
  }
  console.log('')
}

run('Applying migrations', 'npx', ['prisma', 'migrate', 'deploy'])
run('Seeding registries (config + content only)', 'npx', ['tsx', 'prisma/seed-registries.ts'])

// Verify rather than assume. An empty registry is the failure mode that renders
// a legible-but-wrong site: pages fall back to their English drafts and read as
// merely untranslated instead of as broken.
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()

try {
  const [configParameters, contentKeys, translations] = await Promise.all([
    db.configParameter.count(),
    db.contentKey.count(),
    db.translation.count(),
  ])

  console.log('── Verification')
  console.log(`   config parameters : ${configParameters}`)
  console.log(`   content keys      : ${contentKeys}`)
  console.log(`   translations      : ${translations}`)

  if (configParameters === 0 || contentKeys === 0) {
    console.error('\nRegistries are still empty — the seed did not take. Do not treat this as provisioned.')
    process.exit(1)
  }

  console.log(`\n✓ ${target} is migrated and seeded.`)
  console.log('  Inventory (projects, units, providers) is deliberately absent —')
  console.log('  add real inventory through the admin panel.\n')
} finally {
  await db.$disconnect()
}
