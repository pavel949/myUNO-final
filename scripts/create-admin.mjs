#!/usr/bin/env node
/**
 * Create (or promote) the founder/admin account.
 *
 * A freshly provisioned database has no human in it. Registration only ever
 * creates ordinary identities, no API grants admin, and the only account the
 * registry seed writes is `system@myuno.internal` — which has no password and
 * so cannot log in. Without this script the admin panel is unreachable, and
 * with it the ability to create the first project or unit.
 *
 *   $env:ADMIN_PASSWORD="..."                       # PowerShell
 *   node scripts/create-admin.mjs you@example.com
 *
 *   ADMIN_PASSWORD='...' node scripts/create-admin.mjs you@example.com   # bash
 *
 * Deliberately NOT part of the seed: an admin account is a credential, and
 * credentials are created on purpose by a person, never as a side effect of
 * provisioning. `prisma/seed.ts` does create `admin@ignatev.test` with a known
 * password, but that is the staging seed — running it on production would put
 * demo villas on a live domain and a published password on a real admin.
 *
 * If the email already exists, the account is promoted in place rather than
 * duplicated: useful when you registered through the site first. An existing
 * password is only replaced when ADMIN_PASSWORD is supplied.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Same cost the application uses (src/modules/auth/auth.ts). A hash written at
// a different cost still verifies, but keeping them equal means this account is
// indistinguishable from one created through the normal flow.
const BCRYPT_COST = 12

const email = process.argv[2]?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const firstName = process.env.ADMIN_FIRST_NAME || 'Founder'
const lastName = process.env.ADMIN_LAST_NAME || 'Admin'

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/create-admin.mjs <email>')
  console.error('With the password in ADMIN_PASSWORD, so it stays out of your shell history.')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Refusing to guess which database to write an admin into.')
  process.exit(1)
}

const db = new PrismaClient()

try {
  const existing = await db.identity.findUnique({
    where: { email },
    select: { id: true, isAdmin: true, hashedPassword: true, status: true },
  })

  if (!existing && !password) {
    console.error(`No account exists for ${email}, so a password is required to create one.`)
    console.error('Set ADMIN_PASSWORD and run again.')
    process.exit(1)
  }

  if (password && password.length < 8) {
    console.error('Password must be at least 8 characters — the application enforces the same rule,')
    console.error('so a shorter one would create an account that cannot be used to log in.')
    process.exit(1)
  }

  const hashedPassword = password ? await bcrypt.hash(password, BCRYPT_COST) : undefined

  const identity = await db.identity.upsert({
    where: { email },
    create: {
      email,
      firstName,
      lastName,
      hashedPassword,
      // Set so the account is usable immediately: an unverified admin would
      // meet the verification banner before reaching the panel, and the
      // verification email has nowhere to go on a fresh environment.
      emailVerifiedAt: new Date(),
      preferredLocale: 'ru',
      status: 'active',
      isAdmin: true,
    },
    update: {
      isAdmin: true,
      status: 'active',
      emailVerifiedAt: new Date(),
      // Only overwrite the password when a new one was supplied, so promoting
      // an existing account does not silently lock its owner out.
      ...(hashedPassword ? { hashedPassword } : {}),
    },
    select: { id: true, email: true, firstName: true, lastName: true, isAdmin: true },
  })

  const action = existing ? 'promoted' : 'created'
  const passwordNote = password
    ? 'password set'
    : 'existing password kept'

  console.log(`\n✓ Admin ${action}: ${identity.email}`)
  console.log(`  name      : ${identity.firstName} ${identity.lastName}`)
  console.log(`  isAdmin   : ${identity.isAdmin}`)
  console.log(`  password  : ${passwordNote}`)
  console.log(`\nLog in at /login, then open /app/admin.\n`)

  if (existing?.isAdmin) {
    console.log('(This account was already an admin — nothing was escalated.)\n')
  }
} catch (error) {
  console.error(`\nFailed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
} finally {
  await db.$disconnect()
}
