#!/usr/bin/env node
/**
 * Runs before `prisma migrate deploy` and clears a failed migration if one is
 * blocking the database (Prisma error P3009).
 *
 * A migration that starts and then fails leaves a row in _prisma_migrations
 * with no finish time. From that moment Prisma refuses to apply any further
 * migration, so every subsequent deploy fails on the same error until a human
 * intervenes. This script performs that intervention automatically, using the
 * DATABASE_URL the deploy is already pointed at.
 *
 * It never fails the install: without a reachable database it prints why and
 * exits 0, so local installs and CI runs without a database still work.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(repoRoot, 'prisma', 'schema.prisma')
const sqlPath = join(repoRoot, 'scripts', 'repair-failed-migrations.sql')

const localPrisma = join(repoRoot, 'node_modules', '.bin', 'prisma')
const prismaBin = existsSync(localPrisma) ? localPrisma : 'npx'
const prismaPrefix = prismaBin === 'npx' ? ['--no-install', 'prisma'] : []

function runPrisma(args) {
  return spawnSync(prismaBin, [...prismaPrefix, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[repair] DATABASE_URL is not set - skipping migration repair')
    return
  }

  if (!existsSync(schemaPath) || !existsSync(sqlPath)) {
    console.log('[repair] schema or repair script missing - skipping')
    return
  }

  console.log('[repair] migration state before repair:')
  const before = runPrisma(['migrate', 'status', '--schema', schemaPath])
  console.log(((before.stdout || '') + (before.stderr || '')).trim() || '[repair] (no output)')

  const repair = runPrisma(['db', 'execute', '--file', sqlPath, '--schema', schemaPath])
  const repairOutput = ((repair.stdout || '') + (repair.stderr || '')).trim()

  if (repair.status === 0) {
    console.log('[repair] repair statement applied')
    if (repairOutput) console.log(repairOutput)
  } else {
    // Unreachable database, missing permissions, wrong URL: all are conditions
    // the deploy itself will report far more clearly than we can here.
    console.log('[repair] could not run repair - leaving the database untouched')
    if (repairOutput) console.log(repairOutput)
  }
}

try {
  main()
} catch (error) {
  console.log(`[repair] skipped after an unexpected error: ${error?.message ?? error}`)
}

process.exit(0)
