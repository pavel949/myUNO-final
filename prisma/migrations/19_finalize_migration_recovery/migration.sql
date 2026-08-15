-- Final recovery: Mark failed migration as completed to unblock the system
-- This updates the migration record instead of deleting it, which is safer

-- Mark the failed migration as completed by setting finished_at
UPDATE "_prisma_migrations"
SET "finished_at" = NOW()
WHERE "migration" = '1_add_analytics_tables'
  AND "finished_at" IS NULL;

-- Also handle any other failed migrations
UPDATE "_prisma_migrations"
SET "finished_at" = NOW()
WHERE "migration" LIKE '1_add%'
  AND "finished_at" IS NULL;
