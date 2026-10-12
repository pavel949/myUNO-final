-- Apply on production (Supabase SQL editor). Same SQL as prisma/migrations/20261012120000_secret_vault + the _prisma_migrations journal row. Additive: one new table, RLS on, API grants revoked.
BEGIN;
-- Founder's key register. Table and protection ship as ONE unit: created, row-level
-- security on and every Data API grant revoked in this file, so there is no moment
-- at which it is open. Additive only: a new table, no existing object touched.
CREATE TABLE "secret_vault_entry" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "value_encrypted" TEXT,
  "last4" VARCHAR(4),
  "notes" VARCHAR(500),
  "updated_by_identity_id" TEXT,
  CONSTRAINT "secret_vault_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "secret_vault_entry_name_check" CHECK ("name" ~ '^[A-Za-z0-9_.-]{1,100}$')
);

CREATE UNIQUE INDEX "secret_vault_entry_name_key" ON "secret_vault_entry"("name");

ALTER TABLE "secret_vault_entry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "secret_vault_entry" FROM PUBLIC, anon, authenticated;
INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'32bcd668b30463bce8432de604ba6c276f0e923a47fc0f69aa1cffa5e77d2d7d','20261012120000_secret_vault',now(),now(),1,'applied manually 2026-10-12, docs/delivery/PROD_APPLY_SECRET_VAULT_20261012.sql');
COMMIT;
select (select count(*) from secret_vault_entry) rows_in_vault, (select relrowsecurity from pg_class where relname='secret_vault_entry') rls_on, (select count(*) from "_prisma_migrations" where migration_name='20261012120000_secret_vault') journal_rows;
