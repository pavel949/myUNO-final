-- Phase 1: Customer Lifecycle + Asset Status tracking

-- 1. Extend CrmProfile with lifecycle audit fields
ALTER TABLE "crm_profile"
ADD COLUMN "account_owner_identity_id" TEXT,
ADD COLUMN "lifecycle_changed_at" TIMESTAMP(3),
ADD COLUMN "lifecycle_change_reason" TEXT,
ADD COLUMN "lifecycle_change_approved_by" TEXT;

-- 2. Add asset_status to Unit table
ALTER TABLE "unit"
ADD COLUMN "asset_status" TEXT DEFAULT 'managed',
ADD COLUMN "asset_status_changed_at" TIMESTAMP(3),
ADD COLUMN "asset_status_reason" TEXT;

-- 3. Create lifecycle_transition_log table
CREATE TABLE "lifecycle_transition_log" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profile_id" TEXT NOT NULL,
  "from_stage" TEXT NOT NULL,
  "to_stage" TEXT NOT NULL,
  "reason" TEXT,
  "approved_by_identity_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lifecycle_transition_log_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "crm_profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Create indexes for performance
CREATE INDEX "lifecycle_transition_log_profile_id_idx" ON "lifecycle_transition_log"("profile_id");
CREATE INDEX "lifecycle_transition_log_created_at_idx" ON "lifecycle_transition_log"("created_at");
CREATE INDEX "unit_asset_status_idx" ON "unit"("asset_status");
CREATE INDEX "crm_profile_account_owner_idx" ON "crm_profile"("account_owner_identity_id");
