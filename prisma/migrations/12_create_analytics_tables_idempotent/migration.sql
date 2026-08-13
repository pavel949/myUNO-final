-- Idempotent analytics tables (bypasses failed migration blocking)
-- Resolve the failed 1_add_analytics_tables migration by marking it as rolled back
UPDATE "_prisma_migrations"
SET "finished_at" = NOW(), "execution_time_ms" = 0, "rolled_back" = TRUE
WHERE "migration" = '1_add_analytics_tables' AND "finished_at" IS NULL;

DO $$ BEGIN
  CREATE TYPE "AnalyticsEventKey" AS ENUM (
    'page_landing_viewed','page_project_viewed','page_unit_viewed','page_audience_viewed','search_performed','search_no_results',
    'stay_booking_started','stay_booking_requested','stay_request_approved','stay_request_declined','stay_payment_succeeded','stay_payment_failed','stay_hold_expired',
    'stay_confirmed','stay_modified','stay_cancelled','stay_checked_in','stay_checked_out','stay_completed','stay_no_show','stay_extension_requested',
    'service_catalog_viewed','service_service_viewed','service_order_placed','service_order_paid','service_order_accepted','service_order_declined','service_order_fulfilled','service_order_cancelled','service_order_no_show',
    'review_submitted','review_replied','message_thread_started','ticket_raised','ticket_resolved','ticket_sla_breached','announcement_published','announcement_read',
    'owner_statement_viewed','owner_payout_recorded','owner_sell_interest','lead_submitted','signal_detected','signal_reviewed','signal_handed_to_capital','signal_dismissed',
    'auth_registered','auth_claimed','notify_delivered','notify_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,"eventKey" "AnalyticsEventKey","projectId" TEXT,"unitId" TEXT,"bookingId" TEXT,"serviceOrderId" TEXT,"identityId" TEXT,"actorIdentityId" TEXT,"dimensions" JSONB,"occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MetricDaily" (
  "id" TEXT PRIMARY KEY,"metricDate" DATE,"projectId" TEXT,"unitId" TEXT,"metricName" TEXT,"metricValue" DOUBLE PRECISION,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventKey_idx" ON "AnalyticsEvent"("eventKey");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_projectId_idx" ON "AnalyticsEvent"("projectId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_unitId_idx" ON "AnalyticsEvent"("unitId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "MetricDaily_metricDate_idx" ON "MetricDaily"("metricDate");
CREATE INDEX IF NOT EXISTS "MetricDaily_projectId_idx" ON "MetricDaily"("projectId");
