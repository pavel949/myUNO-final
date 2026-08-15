-- Nuclear option: Reset migration state for Prisma Data Platform recovery
-- DANGER: This clears all migration history, use only when migrations are permanently stuck
-- This is necessary because the failed 1_add_analytics_tables migration blocks all future migrations

-- Backup strategy: Keep the history but mark all entries as completed
UPDATE "_prisma_migrations" SET "finished_at" = COALESCE("finished_at", NOW())
WHERE "finished_at" IS NULL;

-- Clean up any stuck migration locks
DELETE FROM "_prisma_migrations"
WHERE "migration" LIKE '1_add%'
  OR "migration" = '1_add_analytics_tables';
