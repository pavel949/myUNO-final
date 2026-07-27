-- DM-4: hygiene from the data-model audit.

-- A dedicated status for PDPA deletion requests, so a genuine identity
-- merge (status=merged, merged_into_id set) is never anonymized by the
-- retention job.
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'deletion_requested';

-- Missing indexes on hot filter columns.
CREATE INDEX IF NOT EXISTS "unit_owner_identity_id_idx" ON "unit"("owner_identity_id");
CREATE INDEX IF NOT EXISTS "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_log_actor_identity_id_idx" ON "audit_log"("actor_identity_id");
CREATE INDEX IF NOT EXISTS "media_asset_delete_after_idx" ON "media_asset"("delete_after");
CREATE INDEX IF NOT EXISTS "content_key_namespace_idx" ON "content_key"("namespace");
CREATE INDEX IF NOT EXISTS "service_category_key_idx" ON "service"("category_key");
CREATE INDEX IF NOT EXISTS "config_change_parameter_key_idx" ON "config_change"("parameter_key");
