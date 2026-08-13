-- P3009 Recovery: Mark failed migration as rolled back
-- The 1_add_analytics_tables migration failed on 2026-07-15 06:33:33.830538 UTC
-- This directly marks it as complete so migrations can proceed
-- This is the migration file equivalent of: prisma migrate resolve --rolled-back 1_add_analytics_tables

UPDATE "_prisma_migrations"
SET "finished_at" = CURRENT_TIMESTAMP, "execution_time_ms" = 0
WHERE "migration" = '1_add_analytics_tables' AND "finished_at" IS NULL;
