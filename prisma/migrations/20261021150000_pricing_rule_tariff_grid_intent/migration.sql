-- Additive intent marker. Existing legacy rules remain inactive on validated
-- seasonal grids; only new explicit calendar edits opt in. No booking,
-- offering, policy, tax approval or historical amount is rewritten.
ALTER TABLE "pricing_rule"
  ADD COLUMN "applies_to_tariff_grid" BOOLEAN NOT NULL DEFAULT false;
