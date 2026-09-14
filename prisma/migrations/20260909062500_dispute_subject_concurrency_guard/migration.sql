-- Serialize dispute creation per canonical subject without changing the Prisma
-- data model. Prisma does not model triggers; the application also re-checks
-- inside its transaction, while this trigger is the database backstop for
-- concurrent or non-application inserts.
CREATE OR REPLACE FUNCTION prevent_duplicate_dispute_subject()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Hash collisions only serialize unrelated subjects; they cannot corrupt data.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.subject_type::text || ':' || NEW.subject_id, 0));

  IF EXISTS (
    SELECT 1
    FROM dispute d
    WHERE d.subject_type = NEW.subject_type
      AND d.subject_id = NEW.subject_id
  ) THEN
    RAISE EXCEPTION 'A dispute has already been raised for this record'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispute_subject_concurrency_guard ON dispute;
CREATE TRIGGER dispute_subject_concurrency_guard
BEFORE INSERT ON dispute
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_dispute_subject();
