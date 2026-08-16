-- Reconcile the database with prisma/schema.prisma.
--
-- Replaces three hand-written migrations whose columns used TEXT where the
-- schema declares enums, and whose index and foreign-key names did not match
-- the names Prisma derives from the schema. Generated with `prisma migrate diff`
-- so every type, index and constraint name matches the schema exactly.
--
-- Deliberately NOT included: the drops of "statement_line_item" and of the
-- owner_statement reporting columns. Those exist in the database but not in
-- schema.prisma; see docs/open_questions.md. Prisma ignores columns it does not
-- declare, and every one of them is nullable, so leaving them costs nothing
-- while dropping them would destroy owner-reporting data.

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('managed', 'verified_partner', 'one_off_sourced', 'suspended');

-- CreateEnum
CREATE TYPE "KPIStatus" AS ENUM ('on_track', 'at_risk', 'below_target');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('maintenance', 'complaint', 'violation');

-- CreateEnum
CREATE TYPE "ComplianceChecklistFrequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "ChannelCategory" AS ENUM ('owned', 'earned', 'paid');

-- CreateEnum
CREATE TYPE "ProspectingAccountType" AS ENUM ('owner', 'developer', 'institutional_partner');

-- CreateEnum
CREATE TYPE "ProspectingAccountStatus" AS ENUM ('new', 'contacted', 'interested', 'pitched', 'closed');

-- CreateEnum
CREATE TYPE "ManagementFeeBasis" AS ENUM ('percentage_gop', 'percentage_noi', 'percentage_gross_booking', 'fixed');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('management', 'performance', 'transaction', 'distribution');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('accrued', 'invoiced', 'paid');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'pending_signature', 'expired', 'terminated');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "CrmLifecycleStage" ADD VALUE 'repeat';
ALTER TYPE "CrmLifecycleStage" ADD VALUE 'investor';
ALTER TYPE "CrmLifecycleStage" ADD VALUE 'managed';

-- AlterEnum
BEGIN;
CREATE TYPE "OwnerStatementStatus_new" AS ENUM ('draft', 'published', 'superseded');
ALTER TABLE "owner_statement" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "owner_statement" ALTER COLUMN "status" TYPE "OwnerStatementStatus_new" USING ("status"::text::"OwnerStatementStatus_new");
ALTER TYPE "OwnerStatementStatus" RENAME TO "OwnerStatementStatus_old";
ALTER TYPE "OwnerStatementStatus_new" RENAME TO "OwnerStatementStatus";
DROP TYPE "OwnerStatementStatus_old";
ALTER TABLE "owner_statement" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- DropIndex
DROP INDEX "unit_owner_identity_id_idx";

-- AlterTable
ALTER TABLE "crm_profile" ADD COLUMN     "account_owner_identity_id" TEXT,
ADD COLUMN     "lifecycle_change_approved_by" TEXT,
ADD COLUMN     "lifecycle_change_reason" TEXT,
ADD COLUMN     "lifecycle_changed_at" TIMESTAMP(3),
ADD COLUMN     "referrer_identity_id" TEXT,
ADD COLUMN     "source_campaign" TEXT,
ADD COLUMN     "source_channel_id" TEXT,
ADD COLUMN     "source_medium" TEXT;

-- AlterTable
ALTER TABLE "unit" ADD COLUMN     "asset_status" "AssetStatus" NOT NULL DEFAULT 'managed',
ADD COLUMN     "asset_status_changed_at" TIMESTAMP(3),
ADD COLUMN     "asset_status_reason" TEXT;

-- CreateTable
CREATE TABLE "operational_kpi" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "target_value" DECIMAL(10,2),
    "actual_value" DECIMAL(10,2),
    "status" "KPIStatus" NOT NULL DEFAULT 'on_track',

    CONSTRAINT "operational_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_log" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "incident_type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "reported_by_identity_id" TEXT NOT NULL,
    "assigned_to_identity_id" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,

    CONSTRAINT "incident_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checklist_template" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "ComplianceChecklistFrequency" NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "compliance_checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checklist_instance" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "completed_date" DATE,
    "checked_by_identity_id" TEXT,
    "passed" BOOLEAN,
    "notes" TEXT,

    CONSTRAINT "compliance_checklist_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_transition_log" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile_id" TEXT NOT NULL,
    "from_stage" "CrmLifecycleStage" NOT NULL,
    "to_stage" "CrmLifecycleStage" NOT NULL,
    "reason" TEXT,
    "approved_by_identity_id" TEXT,

    CONSTRAINT "lifecycle_transition_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ChannelCategory" NOT NULL,
    "description" TEXT,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_account" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "account_type" "ProspectingAccountType" NOT NULL,
    "status" "ProspectingAccountStatus" NOT NULL DEFAULT 'new',
    "reason_for_contact" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "assigned_to_identity_id" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "expected_close_at" TIMESTAMP(3),

    CONSTRAINT "prospecting_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_contract" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "owner_identity_id" TEXT NOT NULL,
    "management_fee_basis" "ManagementFeeBasis" NOT NULL,
    "management_fee_rate" DECIMAL(5,4),
    "management_fee_fixed_amount" INTEGER,
    "performance_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "performance_fee_basis" TEXT,
    "performance_fee_rate" DECIMAL(5,4),
    "performance_fee_baseline" INTEGER,
    "contract_start_date" DATE NOT NULL,
    "contract_end_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "signed_at" TIMESTAMP(3),
    "signed_by_owner_identity_id" TEXT,

    CONSTRAINT "management_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earned_fee" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "management_contract_id" TEXT NOT NULL,
    "fee_type" "FeeType" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "calculation_basis" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'accrued',
    "invoice_id" TEXT,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "earned_fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_kpi_unit_id_period_start_period_end_idx" ON "operational_kpi"("unit_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "operational_kpi_metric_name_status_idx" ON "operational_kpi"("metric_name", "status");

-- CreateIndex
CREATE INDEX "incident_log_unit_id_status_idx" ON "incident_log"("unit_id", "status");

-- CreateIndex
CREATE INDEX "incident_log_severity_idx" ON "incident_log"("severity");

-- CreateIndex
CREATE INDEX "incident_log_created_at_idx" ON "incident_log"("created_at");

-- CreateIndex
CREATE INDEX "compliance_checklist_instance_unit_id_due_date_idx" ON "compliance_checklist_instance"("unit_id", "due_date");

-- CreateIndex
CREATE INDEX "compliance_checklist_instance_passed_idx" ON "compliance_checklist_instance"("passed");

-- CreateIndex
CREATE INDEX "lifecycle_transition_log_profile_id_idx" ON "lifecycle_transition_log"("profile_id");

-- CreateIndex
CREATE INDEX "lifecycle_transition_log_created_at_idx" ON "lifecycle_transition_log"("created_at");

-- CreateIndex
CREATE INDEX "channel_category_idx" ON "channel"("category");

-- CreateIndex
CREATE INDEX "prospecting_account_identity_id_idx" ON "prospecting_account"("identity_id");

-- CreateIndex
CREATE INDEX "prospecting_account_status_idx" ON "prospecting_account"("status");

-- CreateIndex
CREATE INDEX "prospecting_account_assigned_to_identity_id_idx" ON "prospecting_account"("assigned_to_identity_id");

-- CreateIndex
CREATE INDEX "prospecting_account_expected_close_at_idx" ON "prospecting_account"("expected_close_at");

-- CreateIndex
CREATE INDEX "management_contract_unit_id_idx" ON "management_contract"("unit_id");

-- CreateIndex
CREATE INDEX "management_contract_project_id_idx" ON "management_contract"("project_id");

-- CreateIndex
CREATE INDEX "management_contract_owner_identity_id_idx" ON "management_contract"("owner_identity_id");

-- CreateIndex
CREATE INDEX "management_contract_status_idx" ON "management_contract"("status");

-- CreateIndex
CREATE INDEX "management_contract_contract_start_date_idx" ON "management_contract"("contract_start_date");

-- CreateIndex
CREATE INDEX "earned_fee_management_contract_id_idx" ON "earned_fee"("management_contract_id");

-- CreateIndex
CREATE INDEX "earned_fee_period_start_period_end_idx" ON "earned_fee"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "earned_fee_status_idx" ON "earned_fee"("status");

-- CreateIndex
CREATE INDEX "earned_fee_fee_type_idx" ON "earned_fee"("fee_type");

-- CreateIndex
CREATE INDEX "crm_profile_account_owner_identity_id_idx" ON "crm_profile"("account_owner_identity_id");

-- CreateIndex
CREATE INDEX "crm_profile_source_channel_id_idx" ON "crm_profile"("source_channel_id");

-- CreateIndex
CREATE INDEX "crm_profile_referrer_identity_id_idx" ON "crm_profile"("referrer_identity_id");

-- CreateIndex
CREATE INDEX "unit_asset_status_idx" ON "unit"("asset_status");

-- AddForeignKey
ALTER TABLE "operational_kpi" ADD CONSTRAINT "operational_kpi_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_reported_by_identity_id_fkey" FOREIGN KEY ("reported_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_assigned_to_identity_id_fkey" FOREIGN KEY ("assigned_to_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist_instance" ADD CONSTRAINT "compliance_checklist_instance_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist_instance" ADD CONSTRAINT "compliance_checklist_instance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "compliance_checklist_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist_instance" ADD CONSTRAINT "compliance_checklist_instance_checked_by_identity_id_fkey" FOREIGN KEY ("checked_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_account_owner_identity_id_fkey" FOREIGN KEY ("account_owner_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_source_channel_id_fkey" FOREIGN KEY ("source_channel_id") REFERENCES "channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_referrer_identity_id_fkey" FOREIGN KEY ("referrer_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_transition_log" ADD CONSTRAINT "lifecycle_transition_log_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "crm_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_transition_log" ADD CONSTRAINT "lifecycle_transition_log_approved_by_identity_id_fkey" FOREIGN KEY ("approved_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_account" ADD CONSTRAINT "prospecting_account_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_account" ADD CONSTRAINT "prospecting_account_assigned_to_identity_id_fkey" FOREIGN KEY ("assigned_to_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_contract" ADD CONSTRAINT "management_contract_signed_by_owner_identity_id_fkey" FOREIGN KEY ("signed_by_owner_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_fee" ADD CONSTRAINT "earned_fee_management_contract_id_fkey" FOREIGN KEY ("management_contract_id") REFERENCES "management_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
