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
