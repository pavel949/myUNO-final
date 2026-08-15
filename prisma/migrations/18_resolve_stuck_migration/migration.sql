-- Emergency resolution of stuck migration state on Prisma Data Platform
-- The failed migration '1_add_analytics_tables' is blocking all deployments
-- This must be the first step to unblock the deployment pipeline

-- Delete the failed migration record from Prisma's migration tracking table
DELETE FROM "_prisma_migrations"
WHERE "migration" = '1_add_analytics_tables'
  OR "migration" LIKE '1_add%'
;
