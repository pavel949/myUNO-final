-- Force resolution of stuck migration state
-- The remote database has a failed migration that blocks all new deployments
-- This migration forcefully resets the state by deleting the failed migration record

-- DANGER: This deletes the failed migration record from Prisma's tracking table
-- Only safe because the migration is from July and already failed
DELETE FROM "_prisma_migrations"
WHERE "migration" = '1_add_analytics_tables'
  AND "finished_at" IS NULL;

-- Fallback: Delete any migration record that starts with '1_add' and has no finish time
DELETE FROM "_prisma_migrations"
WHERE "migration" LIKE '1_add%'
  AND "finished_at" IS NULL;

-- Now ensure all baseline tables exist with correct schemas
-- Create AnalyticsEventKey enum if missing
DO $$ BEGIN
  CREATE TYPE "AnalyticsEventKey" AS ENUM (
    'page_landing_viewed',
    'page_project_viewed',
    'page_unit_viewed',
    'page_audience_viewed',
    'search_performed',
    'search_no_results',
    'stay_booking_started',
    'stay_booking_requested',
    'stay_request_approved',
    'stay_request_declined',
    'stay_payment_succeeded',
    'stay_payment_failed',
    'stay_hold_expired',
    'stay_confirmed',
    'stay_modified',
    'stay_cancelled',
    'stay_checked_in',
    'stay_checked_out',
    'stay_completed',
    'stay_no_show',
    'stay_extension_requested',
    'service_catalog_viewed',
    'service_service_viewed',
    'service_order_placed',
    'service_order_paid',
    'service_order_accepted',
    'service_order_declined',
    'service_order_fulfilled',
    'service_order_cancelled',
    'service_order_no_show',
    'review_submitted',
    'review_replied',
    'message_thread_started',
    'ticket_raised',
    'ticket_resolved',
    'ticket_sla_breached',
    'announcement_published',
    'announcement_read',
    'owner_statement_viewed',
    'owner_payout_recorded',
    'owner_sell_interest',
    'lead_submitted',
    'signal_detected',
    'signal_reviewed',
    'signal_handed_to_capital',
    'signal_dismissed',
    'auth_registered',
    'auth_claimed',
    'notify_delivered',
    'notify_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create analytics_event table if it doesn't exist
-- This is the table the failed migration should have created
CREATE TABLE IF NOT EXISTS "analytics_event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "event_key" "AnalyticsEventKey" NOT NULL,
  "project_id" TEXT,
  "unit_id" TEXT,
  "booking_id" TEXT,
  "service_order_id" TEXT,
  "identity_id" TEXT,
  "actor_identity_id" TEXT,
  "dimensions" JSONB NOT NULL DEFAULT '{}'
);

-- Create metric_daily table if it doesn't exist
CREATE TABLE IF NOT EXISTS "metric_daily" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATE NOT NULL,
  "project_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "nights_available" INTEGER NOT NULL DEFAULT 0,
  "nights_occupied" INTEGER NOT NULL DEFAULT 0,
  "owner_stay_nights" INTEGER NOT NULL DEFAULT 0,
  "rental_revenue_cents" INTEGER NOT NULL DEFAULT 0,
  "service_order_count" INTEGER NOT NULL DEFAULT 0,
  "service_order_revenue_cents" INTEGER NOT NULL DEFAULT 0,
  "occupancy_pct" DOUBLE PRECISION,
  "adr_cents" INTEGER,
  "revpan_cents" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS "analytics_event_event_key_occurred_at_idx" ON "analytics_event"("event_key", "occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_event_project_id_idx" ON "analytics_event"("project_id");
CREATE INDEX IF NOT EXISTS "analytics_event_unit_id_idx" ON "analytics_event"("unit_id");
CREATE INDEX IF NOT EXISTS "metric_daily_date_idx" ON "metric_daily"("date");
CREATE INDEX IF NOT EXISTS "metric_daily_project_id_idx" ON "metric_daily"("project_id");
CREATE INDEX IF NOT EXISTS "metric_daily_unit_id_idx" ON "metric_daily"("unit_id");
