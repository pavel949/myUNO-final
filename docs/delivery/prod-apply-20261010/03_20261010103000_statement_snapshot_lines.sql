-- Step 3 of 4: 20261010103000_statement_snapshot_lines. Paste ALL of it (last line must start with 'select'), press Run. Run steps in order.
BEGIN;
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
COMMIT;
select migration_name, finished_at from "_prisma_migrations" where migration_name = '20261010103000_statement_snapshot_lines';
