-- Bring a database created by the ORIGINAL 0_init up to the squashed 0_init.
--
-- 0_init was rewritten on 16 July ("squash to a single schema-true 0_init")
-- AFTER it had already been applied to the deployed database on 14 July. Prisma
-- skips a migration it has already recorded, so the new content never reached
-- that database: it still holds the original 437-line schema, missing the tables
-- and enums the rest of the chain depends on. That is why deploys failed on
-- `type "NotificationType" does not exist` as soon as the P3009 block cleared.
--
-- Generated with `prisma migrate diff` between the two 0_init versions, then
-- made idempotent, so it is a no-op on a database that already has the full
-- schema (a fresh one, or CI) and creates exactly what is missing on the
-- deployed one. It only adds: nothing here drops a table, a column or a row.

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "AnalyticsEventKey" AS ENUM ('page_landing_viewed', 'page_project_viewed', 'page_unit_viewed', 'page_audience_viewed', 'search_performed', 'search_no_results', 'stay_booking_started', 'stay_booking_requested', 'stay_request_approved', 'stay_request_declined', 'stay_payment_succeeded', 'stay_payment_failed', 'stay_hold_expired', 'stay_confirmed', 'stay_modified', 'stay_cancelled', 'stay_checked_in', 'stay_checked_out', 'stay_completed', 'stay_no_show', 'stay_extension_requested', 'service_catalog_viewed', 'service_service_viewed', 'service_order_placed', 'service_order_paid', 'service_order_accepted', 'service_order_declined', 'service_order_fulfilled', 'service_order_cancelled', 'service_order_no_show', 'review_submitted', 'message_thread_started', 'ticket_raised', 'ticket_resolved', 'ticket_sla_breached', 'announcement_published', 'announcement_read', 'owner_statement_viewed', 'owner_payout_recorded', 'owner_sell_interest', 'lead_submitted', 'signal_detected', 'signal_reviewed', 'signal_handed_to_capital', 'signal_dismissed', 'auth_registered', 'auth_claimed', 'notify_delivered', 'notify_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "AnnouncementAudience" AS ENUM ('everyone', 'owners', 'residents', 'guests_in_stay', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "AnnouncementPostedAs" AS ENUM ('myuno', 'management_company', 'juristic_person');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "AnnouncementStatus" AS ENUM ('draft', 'published', 'unpublished');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BlockedDateReason" AS ENUM ('maintenance', 'owner_hold', 'ota_import', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BookingChangeType" AS ENUM ('dates', 'party', 'cancel', 'status', 'price');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BookingChannel" AS ENUM ('direct', 'airbnb', 'booking_com', 'agoda', 'agent', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('requested', 'pending_payment', 'confirmed', 'checked_in', 'checked_out', 'completed', 'declined', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BookingType" AS ENUM ('guest_stay', 'owner_stay', 'external_ota', 'internal_block');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BuyerSignalKey" AS ENUM ('repeat_stay', 'long_stay', 'purchase_question', 'listing_engagement', 'direct_inquiry');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "BuyerSignalStatus" AS ENUM ('open', 'reviewed', 'handed_to_capital', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ComplianceRecordStatus" AS ENUM ('pending', 'confirmed', 'expired', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ComplianceRecordType" AS ENUM ('permitted_use', 'insurance', 'license', 'title_audit', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ConditionReportType" AS ENUM ('baseline', 'check_in', 'check_out', 'incident');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "DepositClaimStatus" AS ENUM ('filed', 'approved', 'rejected', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "FulfilmentMode" AS ENUM ('referred', 'operated');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "IntegrationKey" AS ENUM ('ical_airbnb', 'ical_booking', 'ical_agoda', 'payment_provider', 'whatsapp', 'telegram', 'crm_hubspot');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "IntegrationScopeType" AS ENUM ('platform', 'project', 'unit');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('active', 'error', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('rental_revenue', 'service_commission', 'ota_commission_cost', 'cleaning_cost', 'maintenance_cost', 'consumables_cost', 'utilities_cost', 'mc_platform_fee', 'owner_direct_fee', 'setup_fee', 'tax_collected', 'payout_owner', 'payout_provider', 'refund_out', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "MessageKind" AS ENUM ('user', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "MobilizationChecklistItemStatus" AS ENUM ('pending', 'done', 'blocked', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "MobilizationChecklistItemStep" AS ENUM ('qualify', 'mandate', 'legal_audit', 'condition_survey', 'standards_uplift', 'pricing_setup', 'golive_checklist');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'whatsapp', 'telegram');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'read');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('auth_verify_email', 'auth_password_reset', 'auth_account_claim', 'stay_confirmed', 'stay_request_placed', 'stay_request_approved', 'stay_request_declined', 'stay_hold_expired', 'stay_prearrival_passports', 'stay_checkin_instructions', 'stay_checkout_reminder', 'stay_cancelled', 'stay_dates_modified', 'stay_review_prompt', 'stay_post_stay', 'stay_new_booking_ops', 'stay_request_received', 'stay_modified_ops', 'stay_verification_failed', 'stay_owner_stay_booked', 'ops_ical_conflict', 'compliance_tm30_escalation', 'order_new', 'order_accepted', 'order_declined', 'order_failed_no_show', 'order_review_prompt', 'provider_remittance', 'provider_approved', 'provider_rejected', 'provider_application_reminder', 'owner_statement_published', 'owner_payout_recorded', 'owner_unit_live', 'finance_refund_failed', 'stay_damage_claim', 'message_new', 'ticket_status_changed', 'ticket_assigned', 'ticket_sla_escalation', 'announcement_published', 'review_reply', 'lead_received');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "OwnerStatementStatus" AS ENUM ('draft', 'published', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card_provider');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('cash', 'mock', 'opn');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PaymentPurpose" AS ENUM ('stay', 'stay_balance', 'service_order', 'deposit_preauth');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('created', 'pending', 'succeeded', 'failed', 'expired', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PayoutMethod" AS ENUM ('bank_transfer_thb', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PayoutPayeeType" AS ENUM ('owner', 'provider');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('recorded', 'reconciled');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "PriceModel" AS ENUM ('fixed', 'per_hour', 'per_person', 'quote');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ProviderStatus" AS ENUM ('applied', 'vetting', 'active', 'suspended', 'offboarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "RefundMethod" AS ENUM ('cash', 'card_provider');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "RefundReason" AS ENUM ('cancellation', 'modification_decrease', 'provider_no_show', 'dispute_resolution', 'goodwill');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('requested', 'processing', 'succeeded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ReviewTargetType" AS ENUM ('stay', 'service_order');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ServiceOrderStatus" AS ENUM ('placed', 'paid', 'accepted', 'declined', 'expired', 'fulfilled', 'cancelled', 'failed', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ServiceStatus" AS ENUM ('draft', 'active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "ThreadContextType" AS ENUM ('booking', 'service_order', 'ticket', 'unit', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "TicketEventType" AS ENUM ('status_change', 'assignment', 'comment_added', 'sla_escalation');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('open', 'acknowledged', 'in_progress', 'waiting_reporter', 'resolved', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "Tm30FilingStatus" AS ENUM ('pending', 'filed', 'failed', 'escalated', 'not_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- CreateEnum
DO $do$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('not_required', 'pending', 'passports_received', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- DropForeignKey
ALTER TABLE "auth_account" DROP CONSTRAINT IF EXISTS "auth_account_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "config_change" DROP CONSTRAINT IF EXISTS "config_change_changed_by_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "content_key" DROP CONSTRAINT IF EXISTS "content_key_id_fkey";

-- DropForeignKey
ALTER TABLE "media_asset" DROP CONSTRAINT IF EXISTS "media_asset_uploaded_by_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "one_time_token" DROP CONSTRAINT IF EXISTS "one_time_token_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "project_media" DROP CONSTRAINT IF EXISTS "project_media_media_id_fkey";

-- DropForeignKey
ALTER TABLE "project_media" DROP CONSTRAINT IF EXISTS "project_media_project_id_fkey";

-- DropForeignKey
ALTER TABLE "role_assignment" DROP CONSTRAINT IF EXISTS "role_assignment_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "role_assignment" DROP CONSTRAINT IF EXISTS "role_assignment_project_id_fkey";

-- DropForeignKey
ALTER TABLE "role_assignment" DROP CONSTRAINT IF EXISTS "role_assignment_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "translation" DROP CONSTRAINT IF EXISTS "translation_content_key_id_fkey";

-- DropForeignKey
ALTER TABLE "translation" DROP CONSTRAINT IF EXISTS "translation_updated_by_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "unit" DROP CONSTRAINT IF EXISTS "unit_project_id_fkey";

-- DropForeignKey
ALTER TABLE "unit_engagement" DROP CONSTRAINT IF EXISTS "unit_engagement_owner_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "unit_engagement" DROP CONSTRAINT IF EXISTS "unit_engagement_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "unit_media" DROP CONSTRAINT IF EXISTS "unit_media_media_id_fkey";

-- DropForeignKey
ALTER TABLE "unit_media" DROP CONSTRAINT IF EXISTS "unit_media_unit_id_fkey";

-- CreateTable
CREATE TABLE IF NOT EXISTS "_claimEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "analytics_event" (
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
CREATE TABLE IF NOT EXISTS "announcement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_identity_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL,
    "posted_as" "AnnouncementPostedAs" NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'draft',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "announcement_read" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcement_id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,

    CONSTRAINT "announcement_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "blocked_date" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" "BlockedDateReason" NOT NULL,
    "note" TEXT,
    "created_by_identity_id" TEXT,
    "external_ref" TEXT,

    CONSTRAINT "blocked_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "booking" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "guest_identity_id" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "channel" "BookingChannel" NOT NULL,
    "external_ref" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "price_breakdown" JSONB,
    "total_thb" INTEGER NOT NULL,
    "balance_due_thb" INTEGER NOT NULL DEFAULT 0,
    "refund_accrued_thb" INTEGER NOT NULL DEFAULT 0,
    "cancellation_policy_snapshot" JSONB,
    "hold_expires_at" TIMESTAMP(3),
    "requested_expires_at" TIMESTAMP(3),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'not_required',
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_identity_id" TEXT,
    "cancellation_reason" TEXT,
    "guest_note" TEXT,
    "internal_note" TEXT,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "booking_change" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booking_id" TEXT NOT NULL,
    "change_type" "BookingChangeType" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "price_delta_thb" INTEGER NOT NULL DEFAULT 0,
    "actor_identity_id" TEXT NOT NULL,

    CONSTRAINT "booking_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "booking_guest" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "booking_id" TEXT NOT NULL,
    "identity_id" TEXT,
    "full_name" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "passport_number" TEXT NOT NULL,
    "date_of_birth" DATE,
    "passport_media_id" TEXT,
    "isLead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "booking_guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "buyer_signal" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "compliance_record" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "record_type" "ComplianceRecordType" NOT NULL,
    "status" "ComplianceRecordStatus" NOT NULL DEFAULT 'pending',
    "label" TEXT,
    "expires_on" DATE,
    "media_id" TEXT,
    "notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_identity_id" TEXT,

    CONSTRAINT "compliance_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "condition_report" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "report_type" "ConditionReportType" NOT NULL,
    "notes" TEXT,
    "created_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "condition_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "condition_report_media" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,

    CONSTRAINT "condition_report_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "deposit_claim" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "booking_id" TEXT NOT NULL,
    "claimant_identity_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "claimed_amount_thb" INTEGER NOT NULL,
    "status" "DepositClaimStatus" NOT NULL DEFAULT 'filed',
    "evidence_media_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filed_at" TIMESTAMP(3) NOT NULL,
    "resolution_at" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "deposit_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_account" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "integration_key" "IntegrationKey" NOT NULL,
    "scope_type" "IntegrationScopeType" NOT NULL,
    "platform_id" TEXT,
    "project_id" TEXT,
    "unit_id" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'active',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "integration_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ledger_entry" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount_thb" INTEGER NOT NULL,
    "unit_id" TEXT,
    "project_id" TEXT,
    "booking_id" TEXT,
    "service_order_id" TEXT,
    "payment_id" TEXT,
    "refund_id" TEXT,
    "statement_id" TEXT,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "created_by_identity_id" TEXT,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "message" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thread_id" TEXT NOT NULL,
    "sender_identity_id" TEXT,
    "body" TEXT,
    "message_kind" "MessageKind" NOT NULL DEFAULT 'user',

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "metric_daily" (
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
CREATE TABLE IF NOT EXISTS "mobilization_checklist_item" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "step" "MobilizationChecklistItemStep" NOT NULL,
    "status" "MobilizationChecklistItemStatus" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "completed_by_identity_id" TEXT,
    "notes" TEXT,
    "requirement_label" TEXT,

    CONSTRAINT "mobilization_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identity_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "params" JSONB NOT NULL,
    "title_key" TEXT NOT NULL,
    "body_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_delivery" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "external_ref" TEXT,

    CONSTRAINT "notification_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preference" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "owner_statement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "owner_identity_id" TEXT NOT NULL,
    "engagement_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_revenue_thb" INTEGER NOT NULL,
    "total_costs_thb" INTEGER NOT NULL,
    "noi_thb" INTEGER NOT NULL,
    "owner_share_thb" INTEGER NOT NULL,
    "estate_share_thb" INTEGER NOT NULL,
    "cap_applied" BOOLEAN NOT NULL DEFAULT false,
    "status" "OwnerStatementStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "published_by_identity_id" TEXT,
    "pdf_media_id" TEXT,

    CONSTRAINT "owner_statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" "PaymentPurpose" NOT NULL,
    "booking_id" TEXT,
    "service_order_id" TEXT,
    "payer_identity_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_session_id" TEXT,
    "amount_thb" INTEGER NOT NULL,
    "received_by_identity_id" TEXT,
    "received_at" TIMESTAMP(3),
    "receipt_ref" TEXT,
    "receipt_media_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'created',
    "succeeded_at" TIMESTAMP(3),
    "failure_reason" TEXT,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payout" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payee_type" "PayoutPayeeType" NOT NULL,
    "owner_statement_id" TEXT,
    "provider_id" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "amount_thb" INTEGER NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "executed_on" DATE NOT NULL,
    "recorded_by_identity_id" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'recorded',

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pricing_rule" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "nightly_thb" INTEGER NOT NULL,
    "label" TEXT,
    "min_nights_override" INTEGER,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "provider" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "category_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProviderStatus" NOT NULL DEFAULT 'applied',
    "vetted_at" TIMESTAMP(3),
    "vetted_by_identity_id" TEXT,
    "payout_method" JSONB,
    "logo_media_id" TEXT,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "provider_project" (
    "provider_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "provider_project_pkey" PRIMARY KEY ("provider_id","project_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refund" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_id" TEXT NOT NULL,
    "method" "RefundMethod" NOT NULL,
    "amount_thb" INTEGER NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'requested',
    "provider_refund_id" TEXT,
    "paid_back_by_identity_id" TEXT,
    "initiated_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "review" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "author_identity_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "replier_identity_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "title_ru" TEXT,
    "title_en" TEXT,
    "title_th" TEXT,
    "description_ru" TEXT,
    "description_en" TEXT,
    "description_th" TEXT,
    "price_model" "PriceModel" NOT NULL,
    "base_price_thb" INTEGER,
    "duration_min" INTEGER,
    "fulfilment_mode" "FulfilmentMode" NOT NULL DEFAULT 'referred',
    "advance_notice_hours" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'draft',
    "cover_media_id" TEXT,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_media" (
    "service_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_media_pkey" PRIMARY KEY ("service_id","media_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_order" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "service_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "booking_id" TEXT,
    "orderer_identity_id" TEXT NOT NULL,
    "orderer_role" "RoleType" NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_breakdown" JSONB NOT NULL,
    "total_thb" INTEGER NOT NULL,
    "take_rate_pct_snapshot" DECIMAL(65,30) NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'placed',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_identity_id" TEXT,
    "cancellation_reason" TEXT,
    "refund_accrued_thb" INTEGER NOT NULL DEFAULT 0,
    "note_to_provider" TEXT,
    "address_note" TEXT,

    CONSTRAINT "service_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_project" (
    "service_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "service_project_pkey" PRIMARY KEY ("service_id","project_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "thread" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "context_type" "ThreadContextType" NOT NULL,
    "context_id" TEXT,
    "project_id" TEXT,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "thread_participant" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "thread_id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "participant_role" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "thread_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "raised_by_identity_id" TEXT NOT NULL,
    "raised_by_role" "RoleType" NOT NULL,
    "assignee_identity_id" TEXT,
    "category_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "sla_due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "thread_id" TEXT,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_event" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" TEXT NOT NULL,
    "event_type" "TicketEventType" NOT NULL,
    "actor_identity_id" TEXT,
    "data" JSONB,

    CONSTRAINT "ticket_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_media" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tm30_filing" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_guest_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "Tm30FilingStatus" NOT NULL DEFAULT 'pending',
    "filed_at" TIMESTAMP(3),
    "filed_by_identity_id" TEXT,
    "receipt_media_id" TEXT,
    "failure_note" TEXT,
    "escalated_at" TIMESTAMP(3),

    CONSTRAINT "tm30_filing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_claimEvidence_AB_unique" ON "_claimEvidence"("A" ASC, "B" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_claimEvidence_B_index" ON "_claimEvidence"("B" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_event_event_key_occurred_at_idx" ON "analytics_event"("event_key" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_event_identity_id_occurred_at_idx" ON "analytics_event"("identity_id" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_event_project_id_occurred_at_idx" ON "analytics_event"("project_id" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_event_unit_id_occurred_at_idx" ON "analytics_event"("unit_id" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_posted_as_organization_id_idx" ON "announcement"("posted_as" ASC, "organization_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_project_id_status_created_at_idx" ON "announcement"("project_id" ASC, "status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_read_announcement_id_identity_id_key" ON "announcement_read"("announcement_id" ASC, "identity_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_read_identity_id_created_at_idx" ON "announcement_read"("identity_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blocked_date_unit_id_start_date_end_date_idx" ON "blocked_date"("unit_id" ASC, "start_date" ASC, "end_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "booking_external_ref_channel_key" ON "booking"("external_ref" ASC, "channel" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_guest_identity_id_idx" ON "booking"("guest_identity_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_project_id_idx" ON "booking"("project_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_status_idx" ON "booking"("status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_unit_id_status_start_date_end_date_idx" ON "booking"("unit_id" ASC, "status" ASC, "start_date" ASC, "end_date" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_change_booking_id_idx" ON "booking_change"("booking_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "booking_guest_booking_id_idx" ON "booking_guest"("booking_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_signal_identity_id_signal_key_key" ON "buyer_signal"("identity_id" ASC, "signal_key" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "buyer_signal_signal_key_status_idx" ON "buyer_signal"("signal_key" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "buyer_signal_status_created_at_idx" ON "buyer_signal"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compliance_record_unit_id_record_type_idx" ON "compliance_record"("unit_id" ASC, "record_type" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compliance_record_unit_id_status_idx" ON "compliance_record"("unit_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "condition_report_booking_id_idx" ON "condition_report"("booking_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "condition_report_unit_id_report_type_created_at_idx" ON "condition_report"("unit_id" ASC, "report_type" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "condition_report_media_report_id_media_id_key" ON "condition_report_media"("report_id" ASC, "media_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "condition_report_media_report_id_sort_idx" ON "condition_report_media"("report_id" ASC, "sort" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deposit_claim_booking_id_status_idx" ON "deposit_claim"("booking_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deposit_claim_claimant_identity_id_filed_at_idx" ON "deposit_claim"("claimant_identity_id" ASC, "filed_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_account_integration_key_scope_type_project_id_u_key" ON "integration_account"("integration_key" ASC, "scope_type" ASC, "project_id" ASC, "unit_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_account_scope_type_project_id_idx" ON "integration_account"("scope_type" ASC, "project_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_account_scope_type_unit_id_idx" ON "integration_account"("scope_type" ASC, "unit_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_account_status_last_sync_at_idx" ON "integration_account"("status" ASC, "last_sync_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ledger_entry_booking_id_idx" ON "ledger_entry"("booking_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ledger_entry_payment_id_idx" ON "ledger_entry"("payment_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ledger_entry_project_id_occurred_on_idx" ON "ledger_entry"("project_id" ASC, "occurred_on" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ledger_entry_refund_id_idx" ON "ledger_entry"("refund_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ledger_entry_unit_id_occurred_on_idx" ON "ledger_entry"("unit_id" ASC, "occurred_on" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_thread_id_created_at_idx" ON "message"("thread_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "metric_daily_date_idx" ON "metric_daily"("date" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "metric_daily_project_id_date_idx" ON "metric_daily"("project_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "metric_daily_unit_id_date_key" ON "metric_daily"("unit_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobilization_checklist_item_unit_id_status_idx" ON "mobilization_checklist_item"("unit_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mobilization_checklist_item_unit_id_step_key" ON "mobilization_checklist_item"("unit_id" ASC, "step" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_identity_id_created_at_idx" ON "notification"("identity_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_delivery_notification_id_channel_idx" ON "notification_delivery"("notification_id" ASC, "channel" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preference_identity_id_type_channel_key" ON "notification_preference"("identity_id" ASC, "type" ASC, "channel" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "owner_statement_owner_identity_id_status_idx" ON "owner_statement"("owner_identity_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "owner_statement_status_published_at_idx" ON "owner_statement"("status" ASC, "published_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "owner_statement_unit_id_period_start_period_end_idx" ON "owner_statement"("unit_id" ASC, "period_start" ASC, "period_end" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_booking_id_idx" ON "payment"("booking_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_payer_identity_id_idx" ON "payment"("payer_identity_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_session_id_provider_key" ON "payment"("provider_session_id" ASC, "provider" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_status_idx" ON "payment"("status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_executed_on_idx" ON "payout"("executed_on" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_owner_statement_id_idx" ON "payout"("owner_statement_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_payee_type_status_idx" ON "payout"("payee_type" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payout_provider_id_period_start_period_end_idx" ON "payout"("provider_id" ASC, "period_start" ASC, "period_end" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pricing_rule_unit_id_start_date_end_date_idx" ON "pricing_rule"("unit_id" ASC, "start_date" ASC, "end_date" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "provider_status_vetted_at_idx" ON "provider"("status" ASC, "vetted_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refund_payment_id_idx" ON "refund"("payment_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refund_status_idx" ON "refund"("status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "review_author_identity_id_idx" ON "review"("author_identity_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "review_target_type_target_id_author_identity_id_key" ON "review"("target_type" ASC, "target_id" ASC, "author_identity_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "review_target_type_target_id_idx" ON "review"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_provider_id_status_idx" ON "service"("provider_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_order_orderer_identity_id_created_at_idx" ON "service_order"("orderer_identity_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_order_project_id_status_created_at_idx" ON "service_order"("project_id" ASC, "status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_order_provider_id_status_idx" ON "service_order"("provider_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_context_type_context_id_idx" ON "thread"("context_type" ASC, "context_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_project_id_last_message_at_idx" ON "thread"("project_id" ASC, "last_message_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_participant_identity_id_idx" ON "thread_participant"("identity_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "thread_participant_thread_id_identity_id_key" ON "thread_participant"("thread_id" ASC, "identity_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_assignee_identity_id_sla_due_at_idx" ON "ticket"("assignee_identity_id" ASC, "sla_due_at" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_project_id_status_idx" ON "ticket"("project_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_event_ticket_id_created_at_idx" ON "ticket_event"("ticket_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_media_ticket_id_media_id_key" ON "ticket_media"("ticket_id" ASC, "media_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_media_ticket_id_position_idx" ON "ticket_media"("ticket_id" ASC, "position" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tm30_filing_booking_guest_id_key" ON "tm30_filing"("booking_guest_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tm30_filing_booking_id_status_idx" ON "tm30_filing"("booking_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tm30_filing_due_at_status_idx" ON "tm30_filing"("due_at" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tm30_filing_filed_by_identity_id_idx" ON "tm30_filing"("filed_by_identity_id" ASC);

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "_claimEvidence" ADD CONSTRAINT "_claimEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "deposit_claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "_claimEvidence" ADD CONSTRAINT "_claimEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "announcement" ADD CONSTRAINT "announcement_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "announcement" ADD CONSTRAINT "announcement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "announcement_read" ADD CONSTRAINT "announcement_read_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "announcement_read" ADD CONSTRAINT "announcement_read_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "blocked_date" ADD CONSTRAINT "blocked_date_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "blocked_date" ADD CONSTRAINT "blocked_date_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking" ADD CONSTRAINT "booking_cancelled_by_identity_id_fkey" FOREIGN KEY ("cancelled_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking" ADD CONSTRAINT "booking_guest_identity_id_fkey" FOREIGN KEY ("guest_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking" ADD CONSTRAINT "booking_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking" ADD CONSTRAINT "booking_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking_change" ADD CONSTRAINT "booking_change_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking_change" ADD CONSTRAINT "booking_change_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking_guest" ADD CONSTRAINT "booking_guest_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking_guest" ADD CONSTRAINT "booking_guest_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "booking_guest" ADD CONSTRAINT "booking_guest_passport_media_id_fkey" FOREIGN KEY ("passport_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "buyer_signal" ADD CONSTRAINT "buyer_signal_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "buyer_signal" ADD CONSTRAINT "buyer_signal_reviewed_by_identity_id_fkey" FOREIGN KEY ("reviewed_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "compliance_record" ADD CONSTRAINT "compliance_record_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "compliance_record" ADD CONSTRAINT "compliance_record_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "compliance_record" ADD CONSTRAINT "compliance_record_verified_by_identity_id_fkey" FOREIGN KEY ("verified_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "condition_report" ADD CONSTRAINT "condition_report_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "condition_report" ADD CONSTRAINT "condition_report_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "condition_report" ADD CONSTRAINT "condition_report_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "condition_report_media" ADD CONSTRAINT "condition_report_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "condition_report_media" ADD CONSTRAINT "condition_report_media_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "condition_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "config_change" ADD CONSTRAINT "config_change_changed_by_identity_id_fkey" FOREIGN KEY ("changed_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "deposit_claim" ADD CONSTRAINT "deposit_claim_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "deposit_claim" ADD CONSTRAINT "deposit_claim_claimant_identity_id_fkey" FOREIGN KEY ("claimant_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "integration_account" ADD CONSTRAINT "integration_account_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "integration_account" ADD CONSTRAINT "integration_account_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "owner_statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaded_by_identity_id_fkey" FOREIGN KEY ("uploaded_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "message" ADD CONSTRAINT "message_sender_identity_id_fkey" FOREIGN KEY ("sender_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "metric_daily" ADD CONSTRAINT "metric_daily_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "metric_daily" ADD CONSTRAINT "metric_daily_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "mobilization_checklist_item" ADD CONSTRAINT "mobilization_checklist_item_completed_by_identity_id_fkey" FOREIGN KEY ("completed_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "mobilization_checklist_item" ADD CONSTRAINT "mobilization_checklist_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "notification" ADD CONSTRAINT "notification_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "one_time_token" ADD CONSTRAINT "one_time_token_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "owner_statement" ADD CONSTRAINT "owner_statement_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "unit_engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "owner_statement" ADD CONSTRAINT "owner_statement_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "owner_statement" ADD CONSTRAINT "owner_statement_pdf_media_id_fkey" FOREIGN KEY ("pdf_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "owner_statement" ADD CONSTRAINT "owner_statement_published_by_identity_id_fkey" FOREIGN KEY ("published_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "owner_statement" ADD CONSTRAINT "owner_statement_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_payer_identity_id_fkey" FOREIGN KEY ("payer_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_receipt_media_id_fkey" FOREIGN KEY ("receipt_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_received_by_identity_id_fkey" FOREIGN KEY ("received_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payout" ADD CONSTRAINT "payout_owner_statement_id_fkey" FOREIGN KEY ("owner_statement_id") REFERENCES "owner_statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payout" ADD CONSTRAINT "payout_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "payout" ADD CONSTRAINT "payout_recorded_by_identity_id_fkey" FOREIGN KEY ("recorded_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "project_media" ADD CONSTRAINT "project_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "provider" ADD CONSTRAINT "provider_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "provider" ADD CONSTRAINT "provider_vetted_by_identity_id_fkey" FOREIGN KEY ("vetted_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "provider_project" ADD CONSTRAINT "provider_project_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "provider_project" ADD CONSTRAINT "provider_project_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "refund" ADD CONSTRAINT "refund_initiated_by_identity_id_fkey" FOREIGN KEY ("initiated_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "refund" ADD CONSTRAINT "refund_paid_back_by_identity_id_fkey" FOREIGN KEY ("paid_back_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "review" ADD CONSTRAINT "review_author_identity_id_fkey" FOREIGN KEY ("author_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "review" ADD CONSTRAINT "review_replier_identity_id_fkey" FOREIGN KEY ("replier_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service" ADD CONSTRAINT "service_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service" ADD CONSTRAINT "service_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_media" ADD CONSTRAINT "service_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_media" ADD CONSTRAINT "service_media_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_cancelled_by_identity_id_fkey" FOREIGN KEY ("cancelled_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_orderer_identity_id_fkey" FOREIGN KEY ("orderer_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_order" ADD CONSTRAINT "service_order_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_project" ADD CONSTRAINT "service_project_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "service_project" ADD CONSTRAINT "service_project_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "thread" ADD CONSTRAINT "thread_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "thread_participant" ADD CONSTRAINT "thread_participant_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "thread_participant" ADD CONSTRAINT "thread_participant_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assignee_identity_id_fkey" FOREIGN KEY ("assignee_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket" ADD CONSTRAINT "ticket_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket" ADD CONSTRAINT "ticket_raised_by_identity_id_fkey" FOREIGN KEY ("raised_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket" ADD CONSTRAINT "ticket_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket" ADD CONSTRAINT "ticket_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket_media" ADD CONSTRAINT "ticket_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "ticket_media" ADD CONSTRAINT "ticket_media_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "tm30_filing" ADD CONSTRAINT "tm30_filing_booking_guest_id_fkey" FOREIGN KEY ("booking_guest_id") REFERENCES "booking_guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "tm30_filing" ADD CONSTRAINT "tm30_filing_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "tm30_filing" ADD CONSTRAINT "tm30_filing_filed_by_identity_id_fkey" FOREIGN KEY ("filed_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "tm30_filing" ADD CONSTRAINT "tm30_filing_receipt_media_id_fkey" FOREIGN KEY ("receipt_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "translation" ADD CONSTRAINT "translation_content_key_id_fkey" FOREIGN KEY ("content_key_id") REFERENCES "content_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "translation" ADD CONSTRAINT "translation_updated_by_identity_id_fkey" FOREIGN KEY ("updated_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "unit" ADD CONSTRAINT "unit_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "unit_media" ADD CONSTRAINT "unit_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- AddForeignKey
DO $do$ BEGIN
  ALTER TABLE "unit_media" ADD CONSTRAINT "unit_media_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
