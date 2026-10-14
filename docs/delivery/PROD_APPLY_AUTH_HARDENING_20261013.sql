-- Apply on production (Supabase SQL editor). Two additive migrations, one transaction.
--   20261013100000_session_revocation : identity.sessions_valid_from (nullable; NULL = nothing revoked)
--   20261013101000_rate_limit_bucket  : new table, RLS on, API grants revoked
-- ORDER MATTERS: run this SQL BEFORE the code that reads identity.sessions_valid_from is deployed,
-- otherwise every signed-in request fails on a column that does not exist yet.
-- Journal rows carry the sha256 of each prisma/migrations/<name>/migration.sql so `migrate status` stays clean.
BEGIN;
-- If another query is holding `identity`, fail fast and cleanly (nothing changes; just re-run)
-- instead of queueing every login behind the ALTER.
SET LOCAL lock_timeout = '5s';
-- ===== 20261013100000_session_revocation =====
-- Revocable sessions. Additive and nullable: NULL means "no revocation has ever happened",
-- so every existing session stays valid. A token issued before this instant is refused
-- (src/lib/session.ts). No index: it is read by primary key with the identity row.
ALTER TABLE "identity" ADD COLUMN "sessions_valid_from" TIMESTAMP(3);
INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'6d0c49c63cbdc6a84d24e04d92229ff806070bb8260bf3efb1b1a5a1147ff06a','20261013100000_session_revocation',now(),now(),1,'applied manually 2026-10-13, docs/delivery/PROD_APPLY_AUTH_HARDENING_20261013.sql');
-- ===== 20261013101000_rate_limit_bucket =====
-- Shared rate-limit counters (replaces per-instance memory on serverless). Additive: one new
-- table. Created, locked down and revoked in this file so it is never open.
CREATE TABLE "rate_limit_bucket" (
  "key" VARCHAR(200) NOT NULL,
  "attempts" INTEGER NOT NULL,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "backoff_multiplier" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_bucket_reset_at_idx" ON "rate_limit_bucket"("reset_at");

ALTER TABLE "rate_limit_bucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "rate_limit_bucket" FROM PUBLIC, anon, authenticated;
INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'03ce7a4f9d2cbf0794c90df6c216d7bb7c7e7ef8ba434ee57a9c456bde7f5edd','20261013101000_rate_limit_bucket',now(),now(),1,'applied manually 2026-10-13, docs/delivery/PROD_APPLY_AUTH_HARDENING_20261013.sql');
COMMIT;
select (select count(*) from information_schema.columns where table_name='identity' and column_name='sessions_valid_from') sessions_valid_from_col, (select relrowsecurity from pg_class where relname='rate_limit_bucket') rate_limit_rls, (select count(*) from "_prisma_migrations" where migration_name in ('20261013100000_session_revocation','20261013101000_rate_limit_bucket')) journal_rows;
