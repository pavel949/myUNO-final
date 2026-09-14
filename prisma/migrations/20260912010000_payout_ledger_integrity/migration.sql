-- P0 finance integrity: every recorded payout must have a unique append-only
-- ledger consequence and payout creation must be race-safe.

ALTER TABLE "ledger_entry"
  ADD COLUMN "payout_id" TEXT;

ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "payout"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ledger_entry_payout_id_key"
  ON "ledger_entry"("payout_id");

CREATE UNIQUE INDEX "payout_owner_statement_unique"
  ON "payout"("owner_statement_id")
  WHERE "payee_type" = 'owner' AND "owner_statement_id" IS NOT NULL;

CREATE UNIQUE INDEX "payout_provider_period_unique"
  ON "payout"("provider_id", "period_start", "period_end")
  WHERE "payee_type" = 'provider'
    AND "provider_id" IS NOT NULL
    AND "period_start" IS NOT NULL
    AND "period_end" IS NOT NULL;
