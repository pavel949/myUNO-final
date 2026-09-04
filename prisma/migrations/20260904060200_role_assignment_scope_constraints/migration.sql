-- RoleAssignment scope invariants from docs/02_data_model.md §2.8:
-- - platform scope carries no project/unit
-- - project scope requires project and no unit
-- - unit scope requires both project and unit
--
-- Added as NOT VALID to avoid breaking historical rows immediately; Postgres
-- still enforces these constraints for all new/updated rows.

ALTER TABLE "role_assignment"
  ADD CONSTRAINT "role_assignment_scope_shape_check"
  CHECK (
    ("scope_type" = 'platform' AND "project_id" IS NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'project' AND "project_id" IS NOT NULL AND "unit_id" IS NULL) OR
    ("scope_type" = 'unit' AND "project_id" IS NOT NULL AND "unit_id" IS NOT NULL)
  )
  NOT VALID;
