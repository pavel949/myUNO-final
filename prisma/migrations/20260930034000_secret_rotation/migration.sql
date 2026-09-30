CREATE TYPE "IntegrationRotationStatus" AS ENUM ('validated', 'applied', 'rolled_back', 'failed');

CREATE TABLE "integration_secret_rotation" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "integration_key" "IntegrationKey" NOT NULL,
  "field_key" TEXT NOT NULL,
  "status" "IntegrationRotationStatus" NOT NULL,
  "actor_identity_id" TEXT NOT NULL,
  "account_id" TEXT,
  "previous_config" JSONB,
  "applied_config_hash" TEXT,
  "validation_note" TEXT,
  "error_message" TEXT,
  "validated_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "rolled_back_at" TIMESTAMP(3),
  CONSTRAINT "integration_secret_rotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_secret_rotation_integration_key_created_at_idx"
  ON "integration_secret_rotation"("integration_key", "created_at");
CREATE INDEX "integration_secret_rotation_status_created_at_idx"
  ON "integration_secret_rotation"("status", "created_at");

ALTER TABLE "integration_secret_rotation"
  ADD CONSTRAINT "integration_secret_rotation_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "integration_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
