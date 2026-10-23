-- Additive intent marker. Existing legacy rules remain inactive on validated
-- seasonal grids; only new explicit calendar edits opt in. No booking,
-- offering, policy, tax approval or historical amount is rewritten.
ALTER TABLE "pricing_rule"
  ADD COLUMN "applies_to_tariff_grid" BOOLEAN NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  overlap_count integer;
BEGIN
  SELECT count(*) INTO overlap_count
  FROM pricing_rule a
  JOIN pricing_rule b
    ON a.unit_id = b.unit_id
   AND a.id < b.id
   AND a.applies_to_tariff_grid
   AND b.applies_to_tariff_grid
   AND daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)');
  IF overlap_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add pricing_rule_tariff_grid_no_overlap: % overlapping tariff-grid rule pair(s) already exist. Resolve them before enabling canonical dated pricing.',
      overlap_count;
  END IF;
END $$;

ALTER TABLE "pricing_rule"
  ADD CONSTRAINT "pricing_rule_tariff_grid_no_overlap"
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (applies_to_tariff_grid);
