-- CreateEnum
CREATE TYPE "IntegrationKey" AS ENUM ('ical_airbnb', 'ical_booking', 'ical_agoda', 'payment_provider', 'whatsapp', 'telegram', 'crm_hubspot');

-- CreateEnum
CREATE TYPE "IntegrationScopeType" AS ENUM ('platform', 'project', 'unit');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('active', 'error', 'disabled');

-- CreateTable
CREATE TABLE "integration_account" (
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

-- CreateIndex
CREATE UNIQUE INDEX "integration_account_integration_key_scope_type_project_id_unit_key" ON "integration_account"("integration_key", "scope_type", "project_id", "unit_id");

-- CreateIndex
CREATE INDEX "integration_account_scope_type_project_id_idx" ON "integration_account"("scope_type", "project_id");

-- CreateIndex
CREATE INDEX "integration_account_scope_type_unit_id_idx" ON "integration_account"("scope_type", "unit_id");

-- CreateIndex
CREATE INDEX "integration_account_status_last_sync_at_idx" ON "integration_account"("status", "last_sync_at");

-- AddForeignKey
ALTER TABLE "integration_account" ADD CONSTRAINT "integration_account_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_account" ADD CONSTRAINT "integration_account_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
