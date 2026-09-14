-- Align the project_organization_role unique index name with the schema.
--
-- 20260907000000_canonical_property_data_system created the constraint with a
-- hand-written name that truncates one character short of the name Prisma
-- derives from @@unique([projectId, organizationId, roleKey]). The database was
-- therefore correct in structure but drifted in naming, and `prisma migrate
-- diff` reported a pending rename on every run — which is how a real pending
-- migration gets lost in the noise.
--
-- Renaming rather than dropping and recreating: the index is the same index,
-- and dropping a unique constraint on a live table opens a window where a
-- duplicate can be written.
ALTER INDEX IF EXISTS "project_organization_role_project_id_organization_id_role_key_k"
  RENAME TO "project_organization_role_project_id_organization_id_role_k_key";
