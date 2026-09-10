-- AT09 safety: whenever a replacement reschedule leaves an open state, remove
-- its synthetic BlockedDate hold. This makes expiry cleanup correct even when
-- the replacement stay dates are in the future and protects against process
-- crashes between status transition and application-level cleanup.
CREATE OR REPLACE FUNCTION cleanup_booking_reschedule_hold()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('pending_funding', 'ready')
     AND NEW."status" NOT IN ('pending_funding', 'ready') THEN
    DELETE FROM "blocked_date"
      WHERE "external_ref" = 'reschedule:' || NEW."id";
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "booking_reschedule_cleanup_hold" ON "booking_reschedule";
CREATE TRIGGER "booking_reschedule_cleanup_hold"
AFTER UPDATE OF "status" ON "booking_reschedule"
FOR EACH ROW EXECUTE FUNCTION cleanup_booking_reschedule_hold();
