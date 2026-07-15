-- CreateEnum
CREATE TYPE "AnalyticsEventKey" AS ENUM ('page_landing_viewed', 'page_project_viewed', 'page_unit_viewed', 'page_audience_viewed', 'search_performed', 'search_no_results', 'stay_booking_started', 'stay_booking_requested', 'stay_request_approved', 'stay_request_declined', 'stay_payment_succeeded', 'stay_payment_failed', 'stay_hold_expired', 'stay_confirmed', 'stay_modified', 'stay_cancelled', 'stay_checked_in', 'stay_checked_out', 'stay_completed', 'stay_no_show', 'stay_extension_requested', 'service_catalog_viewed', 'service_service_viewed', 'service_order_placed', 'service_order_paid', 'service_order_accepted', 'service_order_declined', 'service_order_fulfilled', 'service_order_cancelled', 'service_order_no_show', 'review_submitted', 'message_thread_started', 'ticket_raised', 'ticket_resolved', 'ticket_sla_breached', 'announcement_published', 'announcement_read', 'owner_statement_viewed', 'owner_payout_recorded', 'owner_sell_interest', 'lead_submitted', 'signal_detected', 'signal_reviewed', 'signal_handed_to_capital', 'signal_dismissed', 'auth_registered', 'auth_claimed', 'notify_delivered', 'notify_failed');

-- CreateEnum
CREATE TYPE "BuyerSignalKey" AS ENUM ('repeat_stay', 'long_stay', 'purchase_question', 'listing_engagement', 'direct_inquiry');

-- CreateEnum
CREATE TYPE "BuyerSignalStatus" AS ENUM ('open', 'reviewed', 'handed_to_capital', 'dismissed');

-- CreateTable
CREATE TABLE "analytics_event" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_key" "AnalyticsEventKey" NOT NULL,
    "project_id" TEXT,
    "unit_id" TEXT,
    "booking_id" TEXT,
    "service_order_id" TEXT,
    "identity_id" TEXT,
    "actor_identity_id" TEXT,
    "dimensions" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "project_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "nights_available" INTEGER NOT NULL DEFAULT 0,
    "nights_occupied" INTEGER NOT NULL DEFAULT 0,
    "rental_revenue_cents" INTEGER NOT NULL DEFAULT 0,
    "service_order_count" INTEGER NOT NULL DEFAULT 0,
    "service_order_revenue_cents" INTEGER NOT NULL DEFAULT 0,
    "occupancy_pct" DOUBLE PRECISION,
    "adr_cents" INTEGER,
    "revpan_cents" INTEGER,

    CONSTRAINT "metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_signal" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "signal_key" "BuyerSignalKey" NOT NULL,
    "status" "BuyerSignalStatus" NOT NULL DEFAULT 'open',
    "strength" INTEGER NOT NULL DEFAULT 1,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "reviewed_by_identity_id" TEXT,

    CONSTRAINT "buyer_signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_event_event_key_occurred_at_idx" ON "analytics_event"("event_key", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_event_project_id_occurred_at_idx" ON "analytics_event"("project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_event_unit_id_occurred_at_idx" ON "analytics_event"("unit_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_event_identity_id_occurred_at_idx" ON "analytics_event"("identity_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "metric_daily_unit_id_date_key" ON "metric_daily"("unit_id", "date");

-- CreateIndex
CREATE INDEX "metric_daily_project_id_date_idx" ON "metric_daily"("project_id", "date");

-- CreateIndex
CREATE INDEX "metric_daily_date_idx" ON "metric_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_signal_identity_id_signal_key_key" ON "buyer_signal"("identity_id", "signal_key");

-- CreateIndex
CREATE INDEX "buyer_signal_status_created_at_idx" ON "buyer_signal"("status", "created_at");

-- CreateIndex
CREATE INDEX "buyer_signal_signal_key_status_idx" ON "buyer_signal"("signal_key", "status");

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_daily" ADD CONSTRAINT "metric_daily_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_daily" ADD CONSTRAINT "metric_daily_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_signal" ADD CONSTRAINT "buyer_signal_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_signal" ADD CONSTRAINT "buyer_signal_reviewed_by_identity_id_fkey" FOREIGN KEY ("reviewed_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
