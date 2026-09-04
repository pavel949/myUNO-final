-- Follow-up to 20260904060200_role_assignment_scope_constraints:
-- existing seed/test data creates some unit-scoped roles without project_id.
-- Keep the safety shape for platform/project scopes, and require unit_id for
-- unit scope while allowing project_id to remain optional for compatibility.

ALTER TABLE "role_assignment"
  DROP CONSTRAINT IF EXISTS "role_assignment_scope_shape_check";

ALTER TABLE "role_assignment"
  ADD CONSTRAINT "role_assignment_scope_shape_check"
  CHECK (
    ("scope_type" = 'platform' AND "project_id" IS NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'project' AND "project_id" IS NOT NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'unit' AND "unit_id" IS NOT NULL)
  )
  NOT VALID;
