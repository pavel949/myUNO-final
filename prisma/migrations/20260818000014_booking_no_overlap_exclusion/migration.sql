-- P0-1: make double-booking impossible in the database, not just in application code.
--
-- Before this migration `createBooking` read the calendar, found no conflict, and
-- then inserted — two concurrent requests could both pass the read and both insert,
-- selling the same unit twice. The guard was advisory only.
--
-- The blocking set is: confirmed, checked_in, and a live pending_payment hold.
-- A constraint predicate has to be immutable, so it cannot test `hold_expires_at >
-- now()`. Instead every hold-bearing status participates and expired holds are
-- moved to `expired` — by the expireHolds job and, inline, by createBooking itself.
-- `requested` never participates: a request is non-binding until approved.
--
-- Ranges are half-open '[)': a stay ending on the 5th does not collide with one
-- starting on the 5th, which is the same rule the application overlap test uses.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Existing overlaps would make the ADD CONSTRAINT fail. Report them loudly rather
-- than silently dropping data: an operator has to decide which booking survives.
DO $$
DECLARE
  overlap_count integer;
BEGIN
  SELECT count(*) INTO overlap_count
  FROM booking a
  JOIN booking b
    ON a.unit_id = b.unit_id
   AND a.id < b.id
   AND a.status IN ('confirmed', 'checked_in', 'pending_payment')
   AND b.status IN ('confirmed', 'checked_in', 'pending_payment')
   AND daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)');

  IF overlap_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add booking_no_overlap: % overlapping booking pair(s) already exist. Resolve them first (see docs/architecture/PHASE1_IMPLEMENTATION_PLAN.md, P0-1).',
      overlap_count;
  END IF;
END $$;

-- A stay cannot end before it begins. Nothing enforced this before, and
-- daterange() rejects an inverted range anyway — without this the exclusion
-- constraint below would surface the bad row as a confusing 22000 at insert
-- time instead of naming the real problem.
ALTER TABLE booking
  ADD CONSTRAINT booking_dates_ordered CHECK (end_date > start_date);

ALTER TABLE booking
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (status IN ('confirmed', 'checked_in', 'pending_payment'));
