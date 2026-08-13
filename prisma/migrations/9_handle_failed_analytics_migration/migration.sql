-- Direct resolution of failed 1_add_analytics_tables migration
-- Updates Prisma's internal migration tracking to mark the failed migration as complete
-- This allows subsequent migrations to proceed

-- Mark the failed migration as successfully completed in Prisma's tracking table
-- This is a last-resort workaround for a database in an inconsistent migration state
UPDATE "_prisma_migrations" 
SET "finished_at" = NOW(), "logs" = 'Resolved via compensation migration - tables already exist in schema'
WHERE "migration" = '1_add_analytics_tables' AND "finished_at" IS NULL;

-- Ensure AnalyticsEventType enum exists (idempotent)
DO $$ BEGIN
  CREATE TYPE "AnalyticsEventType" AS ENUM ('page_view', 'click', 'form_submit', 'booking_start', 'booking_complete', 'search_filter', 'filter_apply', 'sort_apply', 'map_toggle', 'listing_favorite', 'review_submit', 'message_send', 'thread_open');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Ensure analytics_event table exists
CREATE TABLE IF NOT EXISTS "analytics_event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "event_type" "AnalyticsEventType" NOT NULL,
  "actor_identity_id" TEXT NOT NULL,
  "project_id" TEXT,
  "unit_id" TEXT,
  "properties" JSONB,
  
  CONSTRAINT "fk_analytics_event_actor" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_analytics_event_project" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_analytics_event_unit" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL
);

-- Ensure metric_daily table exists  
CREATE TABLE IF NOT EXISTS "metric_daily" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metric_date" DATE NOT NULL,
  "project_id" TEXT NOT NULL,
  "unit_id" TEXT,
  "metric_name" TEXT NOT NULL,
  "value_int" INTEGER,
  "value_float" DOUBLE PRECISION,
  "value_str" TEXT,
  
  CONSTRAINT "fk_metric_daily_project" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_metric_daily_unit" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "analytics_event_actor_id_idx" ON "analytics_event"("actor_identity_id");
CREATE INDEX IF NOT EXISTS "analytics_event_project_id_idx" ON "analytics_event"("project_id");
CREATE INDEX IF NOT EXISTS "analytics_event_unit_id_idx" ON "analytics_event"("unit_id");
CREATE INDEX IF NOT EXISTS "analytics_event_type_idx" ON "analytics_event"("event_type");
CREATE INDEX IF NOT EXISTS "analytics_event_created_at_idx" ON "analytics_event"("created_at");
CREATE INDEX IF NOT EXISTS "metric_daily_date_idx" ON "metric_daily"("metric_date");
CREATE INDEX IF NOT EXISTS "metric_daily_project_idx" ON "metric_daily"("project_id");
