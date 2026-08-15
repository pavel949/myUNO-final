-- Forcefully resolve stuck migration state on Prisma Cloud deployment
-- The remote database has a failed 1_add_analytics_tables migration from 2026-07-15
-- that's blocking all subsequent migrations. This migration marks it as failed-and-rolled-back.

-- Step 1: Mark any failed migration starting with '1_' as rolled back
UPDATE "_prisma_migrations"
SET "finished_at" = CURRENT_TIMESTAMP,
    "execution_time_ms" = 1,
    "rolled_back_at" = CURRENT_TIMESTAMP
WHERE "migration" LIKE '1_%'
  AND "finished_at" IS NULL
  AND "rolled_back_at" IS NULL;

-- Step 2: Ensure AnalyticsEventKey enum exists (required by AnalyticsEvent table)
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

-- Step 3: Ensure AnalyticsEvent table exists with proper schema
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
  "dimensions" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "analytics_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL,
  CONSTRAINT "analytics_event_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL,
  CONSTRAINT "analytics_event_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL,
  CONSTRAINT "analytics_event_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE SET NULL,
  CONSTRAINT "analytics_event_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE SET NULL,
  CONSTRAINT "analytics_event_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL
);

-- Step 4: Create indexes for AnalyticsEvent
CREATE INDEX IF NOT EXISTS "analytics_event_event_key_occurred_at_idx" ON "analytics_event"("event_key", "occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_event_project_id_occurred_at_idx" ON "analytics_event"("project_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_event_unit_id_occurred_at_idx" ON "analytics_event"("unit_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "analytics_event_identity_id_occurred_at_idx" ON "analytics_event"("identity_id", "occurred_at");

-- Step 5: Ensure MetricDaily table exists with proper schema
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
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "metric_daily_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  CONSTRAINT "metric_daily_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE,
  CONSTRAINT "metric_daily_unique_date_unit" UNIQUE ("date", "unit_id")
);

-- Step 6: Create indexes for MetricDaily
CREATE INDEX IF NOT EXISTS "metric_daily_date_idx" ON "metric_daily"("date");
CREATE INDEX IF NOT EXISTS "metric_daily_project_id_date_idx" ON "metric_daily"("project_id", "date");
CREATE INDEX IF NOT EXISTS "metric_daily_unit_id_date_idx" ON "metric_daily"("unit_id", "date");
