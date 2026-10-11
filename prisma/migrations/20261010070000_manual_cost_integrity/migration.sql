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
