-- A unit's project is the only authority on which project a row belongs to.
--
-- `booking`, `management_contract` and `role_assignment` each carry both a
-- `unit_id` and a `project_id`, and nothing made the two agree. Two API routes
-- took `project_id` straight from the caller and wrote it beside a unit that
-- lived in a different project (fixed in the same commit as this migration),
-- but the deeper problem is that the database allowed the disagreement at all:
-- any writer — a script, a seed, a future route — could file a booking, a
-- management contract or a role into a project that does not contain the unit.
--
-- What that costs when it happens: a booking lands in another project's ledger,
-- metrics and MC dashboard, and resolves its cancellation policy against that
-- project's config overrides before the snapshot trigger makes the terms
-- immutable. A management contract decides a performance fee under the wrong
-- project. A role assignment grants scope somewhere its holder was never meant
-- to reach.
--
-- Enforced with triggers rather than a composite foreign key on purpose. The
-- FK would be expressible in schema.prisma only as a second, duplicate
-- relation on the same columns; left undeclared, the next `prisma migrate dev`
-- would diff it as drift and drop it — silently removing the guarantee. Prisma
-- does not model triggers at all, so a trigger survives, and it can name the
-- invariant in the error the way `booking_snapshot_is_immutable` does.
--
-- `restrict_violation` is the same error class migration 20260818000016 uses:
-- Prisma passes a raised message through for it, while `foreign_key_violation`
-- is mapped to its own generic P2003 and the explanation is lost.
--
-- Same scope note as migration 20260818000016: these are ordinary triggers, so
-- a superuser session that sets `session_replication_role = 'replica'` bypasses
-- them — which is how the test suite truncates between cases. They stop the
-- application from writing an incoherent row; they are not a defence against
-- someone holding the database owner's credentials.

-- 1. Repair existing rows ---------------------------------------------------
--
-- The unit is the source of truth, so a disagreement is resolved in its favour
-- rather than by deleting anything. Migration 20260904062200 relaxed the
-- role-assignment shape check specifically because rows existed with no
-- project_id; this fills them in, which is what that migration deferred.

UPDATE "role_assignment" ra
   SET "project_id" = u."project_id"
  FROM "unit" u
 WHERE ra."unit_id" = u."id"
   AND ra."project_id" IS DISTINCT FROM u."project_id";

UPDATE "booking" b
   SET "project_id" = u."project_id"
  FROM "unit" u
 WHERE b."unit_id" = u."id"
   AND b."project_id" IS DISTINCT FROM u."project_id";

UPDATE "management_contract" mc
   SET "project_id" = u."project_id"
  FROM "unit" u
 WHERE mc."unit_id" = u."id"
   AND mc."project_id" IS DISTINCT FROM u."project_id";

-- 2. Restore the role-assignment scope shape doc 02 §2.8 specifies ----------
--
-- Migration 20260904062200 dropped the requirement that a unit-scoped role
-- carries a project_id, to accommodate seed and test data that no longer
-- violates it (the test factory now derives project_id from the unit). The
-- relaxation was never harmless: `getIdentityRoles(identity, { projectId })`
-- filters on that column, so a unit-scoped role written without one is
-- invisible to every project-scoped permission read — the holder silently
-- loses access that was granted to them.
--
-- Added NOT VALID and then validated as a separate statement: the validation
-- takes a weaker lock that way, and it still checks every existing row. If it
-- fails, a row violates the scope shape in a way step 1 does not cover (a
-- platform-scoped row carrying a project, say) — that needs a human to read it,
-- not a migration to guess at it.

ALTER TABLE "role_assignment"
  DROP CONSTRAINT IF EXISTS "role_assignment_scope_shape_check";

ALTER TABLE "role_assignment"
  ADD CONSTRAINT "role_assignment_scope_shape_check"
  CHECK (
    ("scope_type" = 'platform' AND "project_id" IS NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'project' AND "project_id" IS NOT NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'unit' AND "project_id" IS NOT NULL AND "unit_id" IS NOT NULL)
  )
  NOT VALID;

ALTER TABLE "role_assignment"
  VALIDATE CONSTRAINT "role_assignment_scope_shape_check";

-- 3. The project beside a unit must be that unit's project ------------------
--
-- One function for all three tables. A row with no unit_id is not this
-- constraint's business: a platform- or project-scoped role, or a ledger-style
-- row that names only a project, is legitimately unit-less.

CREATE OR REPLACE FUNCTION project_matches_unit()
RETURNS TRIGGER AS $$
DECLARE
    unit_project_id TEXT;
BEGIN
    IF NEW."unit_id" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT "project_id" INTO unit_project_id FROM "unit" WHERE "id" = NEW."unit_id";

    -- No unit row: leave it to the foreign key, which reports it better.
    IF unit_project_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW."project_id" IS DISTINCT FROM unit_project_id THEN
        RAISE EXCEPTION
            '%.project_id is % but unit % belongs to project %. A unit''s project is the only authority on which project a row belongs to.',
            TG_TABLE_NAME, COALESCE(NEW."project_id", 'null'), NEW."unit_id", unit_project_id
        USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_project_matches_unit ON "booking";
CREATE TRIGGER booking_project_matches_unit
    BEFORE INSERT OR UPDATE ON "booking"
    FOR EACH ROW
    EXECUTE FUNCTION project_matches_unit();

DROP TRIGGER IF EXISTS management_contract_project_matches_unit ON "management_contract";
CREATE TRIGGER management_contract_project_matches_unit
    BEFORE INSERT OR UPDATE ON "management_contract"
    FOR EACH ROW
    EXECUTE FUNCTION project_matches_unit();

DROP TRIGGER IF EXISTS role_assignment_project_matches_unit ON "role_assignment";
CREATE TRIGGER role_assignment_project_matches_unit
    BEFORE INSERT OR UPDATE ON "role_assignment"
    FOR EACH ROW
    EXECUTE FUNCTION project_matches_unit();
