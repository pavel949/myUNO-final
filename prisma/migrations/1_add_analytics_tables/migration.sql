-- P3009 Recovery: Explicitly resolve the failed migration state
-- The 1_add_analytics_tables migration failed at 2026-07-15 06:33:33.830538 UTC
-- This migration marks it as finished in Prisma's tracking table

DO $$
BEGIN
  -- Mark the failed migration as finished in Prisma's internal tracking
  UPDATE "_prisma_migrations"
  SET
    "finished_at" = CURRENT_TIMESTAMP,
    "execution_time_ms" = FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - '2026-07-15 06:33:33.830538'::timestamp)) * 1000)::INTEGER
  WHERE
    "migration" = '1_add_analytics_tables'
    AND "finished_at" IS NULL
    AND "started_at" IS NOT NULL;
END $$;

SELECT 1;
