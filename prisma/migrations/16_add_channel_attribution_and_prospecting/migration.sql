-- Phase 4: Channel Attribution & Go-to-Market
-- Add channel master data, source tracking, and prospecting pipeline

-- Create channel_category enum
CREATE TYPE "ChannelCategory" AS ENUM('owned', 'earned', 'paid');

-- Create channel master data table
CREATE TABLE "channel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" "ChannelCategory" NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extend crm_profile with source tracking
ALTER TABLE "crm_profile" ADD COLUMN "source_channel_id" TEXT;
ALTER TABLE "crm_profile" ADD COLUMN "source_medium" TEXT;
ALTER TABLE "crm_profile" ADD COLUMN "source_campaign" TEXT;
ALTER TABLE "crm_profile" ADD COLUMN "referrer_identity_id" TEXT;

-- Add foreign key for source_channel_id
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_source_channel_id_fkey"
  FOREIGN KEY ("source_channel_id") REFERENCES "channel"("id") ON DELETE SET NULL;

-- Add foreign key for referrer_identity_id
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_referrer_identity_id_fkey"
  FOREIGN KEY ("referrer_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL;

-- Create prospecting_account table
CREATE TABLE "prospecting_account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identity_id" TEXT NOT NULL,
  "account_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "reason_for_contact" TEXT,
  "priority" INT NOT NULL DEFAULT 1,
  "assigned_to_identity_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_contacted_at" TIMESTAMP(3),
  "expected_close_at" TIMESTAMP(3)
);

-- Add foreign keys for prospecting_account
ALTER TABLE "prospecting_account" ADD CONSTRAINT "prospecting_account_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

ALTER TABLE "prospecting_account" ADD CONSTRAINT "prospecting_account_assigned_to_identity_id_fkey"
  FOREIGN KEY ("assigned_to_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL;

-- Create indices for query performance
CREATE INDEX "channel_category_idx" ON "channel"("category");
CREATE INDEX "crm_profile_source_channel_id_idx" ON "crm_profile"("source_channel_id");
CREATE INDEX "crm_profile_referrer_identity_id_idx" ON "crm_profile"("referrer_identity_id");
CREATE INDEX "prospecting_account_identity_id_idx" ON "prospecting_account"("identity_id");
CREATE INDEX "prospecting_account_status_idx" ON "prospecting_account"("status");
CREATE INDEX "prospecting_account_assigned_to_idx" ON "prospecting_account"("assigned_to_identity_id");
CREATE INDEX "prospecting_account_expected_close_at_idx" ON "prospecting_account"("expected_close_at");

-- Seed default channels
INSERT INTO "channel" ("id", "name", "category", "description", "created_at", "updated_at") VALUES
('ch_direct', 'Direct', 'owned', 'Direct contact or website', NOW(), NOW()),
('ch_referral', 'Referral', 'earned', 'Customer or partner referral', NOW(), NOW()),
('ch_developer', 'Developer', 'earned', 'Sourced through developer', NOW(), NOW()),
('ch_linkedin', 'LinkedIn', 'paid', 'LinkedIn outreach or advertising', NOW(), NOW()),
('ch_organic_search', 'Organic Search', 'earned', 'Organic search engine results', NOW(), NOW()),
('ch_paid_search', 'Paid Search', 'paid', 'Google Ads or similar', NOW(), NOW()),
('ch_event', 'Event', 'owned', 'Real estate event or conference', NOW(), NOW()),
('ch_broker', 'Broker', 'earned', 'Real estate broker referral', NOW(), NOW()),
('ch_other', 'Other', 'owned', 'Other or unclassified', NOW(), NOW());
