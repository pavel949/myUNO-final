-- One dispute record per canonical subject. Application-level prechecks are
-- advisory only; this unique index is the concurrency backstop for booking,
-- service-order and statement disputes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "dispute"
    GROUP BY "subject_type", "subject_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique dispute subject: duplicate disputes already exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "dispute_subject_type_subject_id_idx";
CREATE UNIQUE INDEX "dispute_subject_type_subject_id_key"
  ON "dispute"("subject_type", "subject_id");
