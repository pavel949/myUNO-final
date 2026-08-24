-- ============================================================================
-- Run this once against the production Supabase database.
--
-- It does two things:
--   1. Closes the security hole — four tables (ownership_period, saved_unit,
--      saved_search, area) are readable right now through Supabase's public
--      REST endpoint by anyone holding the anon key, which ships to browsers.
--      Two of them hold personal data.
--   2. Adds `bank_transfer` as a payment method and provider, so money can be
--      taken by transfer into the company account.
--
-- It also registers both migrations in Prisma's bookkeeping table, so a later
-- `prisma migrate deploy` sees them as already applied and does not object.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste all of this → Run.
--
-- SAFE TO RUN TWICE, and this was tested rather than assumed. The RLS loop only
-- touches tables that do not already have it, the enum additions use
-- IF NOT EXISTS, and the bookkeeping rows are guarded with WHERE NOT EXISTS on
-- the migration name. (ON CONFLICT would NOT have worked here: the primary key
-- is a fresh uuid each run, so nothing would ever conflict and a second run
-- would have inserted duplicate rows for the same migration.)
--
-- THE BETTER PATH, if you have a terminal with the production connection
-- string: `npx prisma migrate deploy`. That applies both migrations and records
-- them properly, and you can ignore this file entirely.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Row-level security on every table
--
-- This does NOT break the application. It connects as the table owner, and an
-- owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set. Enabling it with
-- no policies closes the public REST surface and changes nothing else.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Bank transfer as a payment method
-- ---------------------------------------------------------------------------

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'bank_transfer';

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Tell Prisma both migrations have run
--
-- Separate from the transaction above on purpose: PostgreSQL will not let a new
-- enum value be used in the same transaction that added it, and keeping the
-- bookkeeping apart avoids any interaction with that rule.
--
-- The checksums are the SHA-256 of each migration.sql in the repository. Prisma
-- compares them, so they must match exactly — they are not decorative.
-- ---------------------------------------------------------------------------

INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
)
SELECT
  gen_random_uuid()::text,
  '36573f210965b5fb0fc50e2a4b89477e5940c8a2b4b64887ceedf58c0b155989',
  now(),
  '20260824000021_rls_every_table',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260824000021_rls_every_table'
);

INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
)
SELECT
  gen_random_uuid()::text,
  '6989754b353d729a2a519955eef236f6255ae46d5dbd65f78b50ffd9ce0b6597',
  now(),
  '20260824000022_bank_transfer_payments',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260824000022_bank_transfer_payments'
);

-- ---------------------------------------------------------------------------
-- 4. Check it worked
--
-- The first query must return zero rows. If it returns anything, those tables
-- are still readable and something above did not run.
-- ---------------------------------------------------------------------------

SELECT c.relname AS still_exposed
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;

SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 5;
