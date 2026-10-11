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
