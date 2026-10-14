-- Founder's key register. Table and protection ship as ONE unit: created, row-level
-- security on and every Data API grant revoked in this file, so there is no moment
-- at which it is open. Additive only: a new table, no existing object touched.
CREATE TABLE "secret_vault_entry" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "value_encrypted" TEXT,
  "last4" VARCHAR(4),
  "notes" VARCHAR(500),
  "updated_by_identity_id" TEXT,
  CONSTRAINT "secret_vault_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "secret_vault_entry_name_check" CHECK ("name" ~ '^[A-Za-z0-9_.-]{1,100}$')
);

CREATE UNIQUE INDEX "secret_vault_entry_name_key" ON "secret_vault_entry"("name");

ALTER TABLE "secret_vault_entry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "secret_vault_entry" FROM PUBLIC, anon, authenticated;
