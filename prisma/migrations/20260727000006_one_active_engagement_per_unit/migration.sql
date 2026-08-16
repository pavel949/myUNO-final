-- DM-2: exactly one active engagement per unit (doc 02 §2.6).
-- The service layer checks this too; the partial unique index makes the
-- invariant unbreakable even by raw writes.
CREATE UNIQUE INDEX "unit_engagement_one_active"
  ON "unit_engagement"("unit_id")
  WHERE "status" = 'active';
