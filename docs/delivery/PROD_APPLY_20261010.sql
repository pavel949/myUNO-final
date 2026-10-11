-- Run once in Supabase SQL editor (project burcnghheyzbzffzgmjz) AFTER backup. One transaction; Prisma ledger rows included.
BEGIN;
-- 20261010070000_manual_cost_integrity
-- Manual cost integrity (expand-only; every column is nullable, nothing is backfilled).
--
-- 1. A replay key per recorder: the same person retrying the same cost lands on
--    the same row; a reused key with different content is a conflict (decided in
--    the service by comparing fingerprints, enforced here by the UNIQUE index).
-- 2. A reversal names its original, once: two concurrent reversals of one cost
--    cannot both insert (UNIQUE on reverses_entry_id).
-- 3. A manual cost is a financial fact: after insert only the statement link may
--    change, and it can never be deleted. Legacy rows (no key) are untouched.
ALTER TABLE "ledger_entry"
  ADD COLUMN "manual_cost_key" VARCHAR(36),
  ADD COLUMN "manual_cost_fingerprint" VARCHAR(64),
  ADD COLUMN "reverses_entry_id" TEXT;

CREATE UNIQUE INDEX "ledger_entry_created_by_identity_id_manual_cost_key_key"
  ON "ledger_entry"("created_by_identity_id", "manual_cost_key");
CREATE UNIQUE INDEX "ledger_entry_reverses_entry_id_key"
  ON "ledger_entry"("reverses_entry_id");

ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_reverses_entry_id_fkey"
  FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entry"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_manual_cost_pair"
  CHECK (("manual_cost_key" IS NULL) = ("manual_cost_fingerprint" IS NULL)),
  ADD CONSTRAINT "ledger_entry_no_self_reversal"
  CHECK ("reverses_entry_id" IS NULL OR "reverses_entry_id" <> "id"),
  -- A recognition date is a calendar day, never an instant.
  ADD CONSTRAINT "ledger_entry_manual_cost_business_date"
  CHECK (("manual_cost_key" IS NULL AND "reverses_entry_id" IS NULL)
         OR "occurred_on" = date_trunc('day', "occurred_on")),
  -- Doc 02 §5.3: negative = cost/outflow.
  ADD CONSTRAINT "ledger_entry_manual_cost_is_outflow"
  CHECK ("manual_cost_key" IS NULL OR "amount_thb" < 0);

CREATE OR REPLACE FUNCTION ledger_entry_manual_cost_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger_entry % is immutable: a recorded cost is corrected by a reversal, never deleted', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- statement_id, booking/payment links and FK SET NULL actions stay possible;
  -- the financial fact itself does not move.
  IF NEW.entry_type IS DISTINCT FROM OLD.entry_type
     OR NEW.amount_thb IS DISTINCT FROM OLD.amount_thb
     OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.manual_cost_key IS DISTINCT FROM OLD.manual_cost_key
     OR NEW.manual_cost_fingerprint IS DISTINCT FROM OLD.manual_cost_fingerprint
     OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
     OR (NEW.created_by_identity_id IS DISTINCT FROM OLD.created_by_identity_id AND NEW.created_by_identity_id IS NOT NULL)
     OR (NEW.unit_id IS DISTINCT FROM OLD.unit_id AND NEW.unit_id IS NOT NULL)
     OR (NEW.project_id IS DISTINCT FROM OLD.project_id AND NEW.project_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'ledger_entry % is immutable: a recorded cost is corrected by a reversal, never edited', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entry_manual_cost_immutable ON "ledger_entry";
CREATE TRIGGER ledger_entry_manual_cost_immutable
  BEFORE UPDATE OR DELETE ON "ledger_entry"
  FOR EACH ROW
  WHEN (OLD."manual_cost_key" IS NOT NULL OR OLD."reverses_entry_id" IS NOT NULL)
  EXECUTE FUNCTION ledger_entry_manual_cost_immutable();

INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'77e75ab63abf6b91a1c5360bb1e3b954953c1f0e0bdbd0a4c1d8b4279fed197d','20261010070000_manual_cost_integrity',now(),now(),1,NULL);
-- 20261010102000_private_expense_receipts
-- Private expense receipts. Table and protection ship as ONE unit: the table is
-- created, row-level security is switched on and every Data API grant is revoked
-- in this file, so there is no moment at which it is open.
--
-- The file lives encrypted (lib/encryption AES-256-GCM over base64) in
-- "ciphertext". There is no public URL and no media_asset row.
CREATE TABLE "expense_receipt" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ledger_entry_id" TEXT NOT NULL,
  "uploaded_by_identity_id" TEXT NOT NULL,
  "upload_key" VARCHAR(36) NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "superseded_at" TIMESTAMP(3),
  CONSTRAINT "expense_receipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_receipt_mime_type_check"
    CHECK ("mime_type" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "expense_receipt_size_check" CHECK ("size_bytes" BETWEEN 1 AND 4194304),
  CONSTRAINT "expense_receipt_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "expense_receipt_uploaded_by_identity_id_upload_key_key"
  ON "expense_receipt"("uploaded_by_identity_id", "upload_key");
CREATE INDEX "expense_receipt_ledger_entry_id_idx" ON "expense_receipt"("ledger_entry_id");
-- One current receipt per expense, and one current use per file: the same bytes
-- cannot evidence two different expenses at once.
CREATE UNIQUE INDEX "expense_receipt_current_per_entry"
  ON "expense_receipt"("ledger_entry_id") WHERE "superseded_at" IS NULL;
CREATE UNIQUE INDEX "expense_receipt_current_sha256"
  ON "expense_receipt"("sha256") WHERE "superseded_at" IS NULL;

ALTER TABLE "expense_receipt"
  ADD CONSTRAINT "expense_receipt_ledger_entry_id_fkey"
  FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "expense_receipt_uploaded_by_identity_id_fkey"
  FOREIGN KEY ("uploaded_by_identity_id") REFERENCES "identity"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidence is replaced by superseding, never edited: only "superseded_at" may
-- move, and only from NULL to a timestamp.
CREATE OR REPLACE FUNCTION expense_receipt_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'expense_receipt % is immutable: supersede it with a new receipt', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.ledger_entry_id IS DISTINCT FROM OLD.ledger_entry_id
     OR NEW.uploaded_by_identity_id IS DISTINCT FROM OLD.uploaded_by_identity_id
     OR NEW.upload_key IS DISTINCT FROM OLD.upload_key
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.ciphertext IS DISTINCT FROM OLD.ciphertext
     OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at)
  THEN
    RAISE EXCEPTION 'expense_receipt % is immutable: supersede it with a new receipt', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expense_receipt_immutable ON "expense_receipt";
CREATE TRIGGER expense_receipt_immutable
  BEFORE UPDATE OR DELETE ON "expense_receipt"
  FOR EACH ROW EXECUTE FUNCTION expense_receipt_immutable();

-- Closed by default (same pattern as 20261005170000_stitch_additive_gaps).
ALTER TABLE "expense_receipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "expense_receipt" FROM PUBLIC, anon, authenticated;

INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'1cf87ee1709742e787d942cd06d1c6ef1e8c235fc37ba8950d35ebe36e7ee3d6','20261010102000_private_expense_receipts',now(),now(),1,NULL);
-- 20261010103000_statement_snapshot_lines
-- Verified statement snapshot + traceable expense lines (expand-only, nullable).
-- Statements generated before this migration keep NULLs and are treated as
-- "unverifiable" by sign-off, never as stale.
ALTER TABLE "owner_statement"
  ADD COLUMN "source_fingerprint" VARCHAR(64),
  ADD COLUMN "snapshot_hash" VARCHAR(64);

ALTER TABLE "statement_line_item"
  ADD COLUMN "ledger_entry_id" TEXT,
  ADD COLUMN "expense_receipt_id" TEXT;

CREATE UNIQUE INDEX "statement_line_item_statement_id_ledger_entry_id_key"
  ON "statement_line_item"("statement_id", "ledger_entry_id");
CREATE INDEX "statement_line_item_ledger_entry_id_idx" ON "statement_line_item"("ledger_entry_id");
CREATE INDEX "statement_line_item_expense_receipt_id_idx" ON "statement_line_item"("expense_receipt_id");

ALTER TABLE "statement_line_item"
  ADD CONSTRAINT "statement_line_item_ledger_entry_id_fkey"
  FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "statement_line_item_expense_receipt_id_fkey"
  FOREIGN KEY ("expense_receipt_id") REFERENCES "expense_receipt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'5a00b572c44acbc89ca9810c2a7536248f14972433776da4c3f22245c32cb598','20261010103000_statement_snapshot_lines',now(),now(),1,NULL);
-- 20261010104000_pin_finance_trigger_search_path
-- Pin search_path on the two trigger functions added by 20261010070000 and
-- 20261010102000 (same rule as 20260930120000_pin_trigger_function_search_path).
-- Definition-only change; no data is touched.
ALTER FUNCTION public.ledger_entry_manual_cost_immutable() SET search_path = public, pg_temp;
ALTER FUNCTION public.expense_receipt_immutable() SET search_path = public, pg_temp;

INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'0e9d6a0f7a0e6080b25d4cc8ac6e48d50a3eeedb27fa4a6f1d8a32dab3b27800','20261010104000_pin_finance_trigger_search_path',now(),now(),1,NULL);
COMMIT;
select migration_name from "_prisma_migrations" where migration_name ~ '^20261010' order by 1;
