-- Recovery migration for orphaned failed migration state
-- The 1_add_analytics_tables migration failed at 2026-07-15 06:33:33.830538 UTC
-- This recovery marks the migration as complete so subsequent migrations can run
-- Actual analytics tables are created in migrations 9 and 12

-- This migration serves as a placeholder to resolve the failed state
-- It allows Prisma's migration queue to proceed
-- No schema changes here - only marking the migration as resolved

SELECT 1;
