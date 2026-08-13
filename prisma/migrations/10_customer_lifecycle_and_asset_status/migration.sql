-- Phase 1: Customer Lifecycle Management + Asset Status Tracking
-- Corporate Bible Integration: Foundation for guest→owner transitions and asset inventory management

-- 1. Lifecycle transition audit log (new table)
CREATE TABLE "crm_lifecycle_transition" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "profile_id" TEXT NOT NULL,
  "from_stage" TEXT NOT NULL,
  "to_stage" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approved_by_identity_id" TEXT,
  "notes" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "crm_lifecycle_transition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_lifecycle_transition_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "crm_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_lifecycle_transition_approved_by_identity_id_fkey" FOREIGN KEY ("approved_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 2. Extend crm_profile with lifecycle tracking fields
ALTER TABLE "crm_profile" ADD COLUMN "account_owner_identity_id" TEXT;
ALTER TABLE "crm_profile" ADD COLUMN "next_step_at" TIMESTAMP(3);
ALTER TABLE "crm_profile" ADD COLUMN "lifecycle_changed_at" TIMESTAMP(3);
ALTER TABLE "crm_profile" ADD COLUMN "lifecycle_change_reason" TEXT;
ALTER TABLE "crm_profile" ADD COLUMN "lifecycle_change_approved_by_identity_id" TEXT;

-- Add foreign key constraints for lifecycle fields
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_account_owner_identity_id_fkey"
  FOREIGN KEY ("account_owner_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_lifecycle_change_approved_by_identity_id_fkey"
  FOREIGN KEY ("lifecycle_change_approved_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Extend unit with asset status tracking
CREATE TYPE "UnitAssetStatus" AS ENUM ('managed', 'verified_partner', 'one_off_sourced', 'suspended');

ALTER TABLE "unit" ADD COLUMN "asset_status" "UnitAssetStatus" NOT NULL DEFAULT 'managed';
ALTER TABLE "unit" ADD COLUMN "asset_status_changed_at" TIMESTAMP(3);
ALTER TABLE "unit" ADD COLUMN "asset_status_reason" TEXT;

-- 4. Create indices for performance
CREATE INDEX "crm_lifecycle_transition_profile_id_created_at_idx" ON "crm_lifecycle_transition"("profile_id", "created_at");
CREATE INDEX "crm_lifecycle_transition_approved_by_identity_id_idx" ON "crm_lifecycle_transition"("approved_by_identity_id");

CREATE INDEX "crm_profile_account_owner_identity_id_lifecycle_stage_idx" ON "crm_profile"("account_owner_identity_id", "lifecycle_stage");
CREATE INDEX "crm_profile_next_step_at_lifecycle_stage_idx" ON "crm_profile"("next_step_at", "lifecycle_stage");
CREATE INDEX "crm_profile_lifecycle_changed_at_idx" ON "crm_profile"("lifecycle_changed_at");

CREATE INDEX "unit_asset_status_idx" ON "unit"("asset_status");
CREATE INDEX "unit_asset_status_changed_at_idx" ON "unit"("asset_status_changed_at");
