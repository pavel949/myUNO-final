-- D4: Add ownerStayNights to MetricDaily for ADR computation
-- ADR should exclude nights occupied by owner stays (staff/owner roles using the unit)

ALTER TABLE metric_daily ADD COLUMN owner_stay_nights INTEGER NOT NULL DEFAULT 0;

-- Backfill: Any existing rows stay at 0, which is safe (owner stays weren't previously tracked)
