-- Phase 5: Business Model Tracking
-- Add management contract schema and earned fee audit trail

-- Create enums for contract and fee management
CREATE TYPE "ManagementFeeBasis" AS ENUM('percentage_gop', 'percentage_noi', 'percentage_gross_booking', 'fixed');
CREATE TYPE "FeeType" AS ENUM('management', 'performance', 'transaction', 'distribution');
CREATE TYPE "FeeStatus" AS ENUM('accrued', 'invoiced', 'paid');
CREATE TYPE "ContractStatus" AS ENUM('active', 'pending_signature', 'expired', 'terminated');

-- Create management_contract table
CREATE TABLE "management_contract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unit_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "owner_identity_id" TEXT NOT NULL,

  "management_fee_basis" "ManagementFeeBasis" NOT NULL,
  "management_fee_rate" NUMERIC,
  "management_fee_fixed_amount" INTEGER,

  "performance_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
  "performance_fee_basis" TEXT,
  "performance_fee_rate" NUMERIC,
  "performance_fee_baseline" INTEGER,

  "contract_start_date" DATE NOT NULL,
  "contract_end_date" DATE,
  "status" "ContractStatus" NOT NULL DEFAULT 'active',
  "signed_at" TIMESTAMP(3),
  "signed_by_owner_identity_id" TEXT,

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign keys for management_contract
ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;

ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;

ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_owner_identity_id_fkey"
  FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_signed_by_owner_identity_id_fkey"
  FOREIGN KEY ("signed_by_owner_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL;

-- Create earned_fee table (immutable audit trail)
CREATE TABLE "earned_fee" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "management_contract_id" TEXT NOT NULL,
  "fee_type" "FeeType" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "calculation_basis" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "FeeStatus" NOT NULL DEFAULT 'accrued',
  "invoice_id" TEXT,
  "paid_at" TIMESTAMP(3),

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for earned_fee
ALTER TABLE "earned_fee" ADD CONSTRAINT "earned_fee_management_contract_id_fkey"
  FOREIGN KEY ("management_contract_id") REFERENCES "management_contract"("id") ON DELETE CASCADE;

-- Create indices for query performance
CREATE INDEX "management_contract_unit_id_idx" ON "management_contract"("unit_id");
CREATE INDEX "management_contract_project_id_idx" ON "management_contract"("project_id");
CREATE INDEX "management_contract_owner_identity_id_idx" ON "management_contract"("owner_identity_id");
CREATE INDEX "management_contract_status_idx" ON "management_contract"("status");
CREATE INDEX "management_contract_start_date_idx" ON "management_contract"("contract_start_date");

CREATE INDEX "earned_fee_management_contract_id_idx" ON "earned_fee"("management_contract_id");
CREATE INDEX "earned_fee_period_idx" ON "earned_fee"("period_start", "period_end");
CREATE INDEX "earned_fee_status_idx" ON "earned_fee"("status");
CREATE INDEX "earned_fee_fee_type_idx" ON "earned_fee"("fee_type");
