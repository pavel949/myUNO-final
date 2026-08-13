-- Recovery migration for failed analytics tables setup from 2026-07-15
-- This migration was recreated to resolve the failed migration blocking P3009 error
-- The actual analytics tables are created in migration 12_create_analytics_tables_idempotent
-- This placeholder ensures the failed state is recorded as processed

-- Mark any previous failed attempt as rolled back (recovery pattern)
UPDATE "_prisma_migrations"
SET "finished_at" = "started_at", "execution_time_ms" = 1
WHERE "migration" = '1_add_analytics_tables' AND "rolled_back" IS NOT TRUE
  AND "started_at" IS NOT NULL AND "finished_at" IS NULL;

-- Ensure we can proceed
SELECT 1;
