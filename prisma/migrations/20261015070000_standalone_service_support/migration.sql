-- Expand-only. Historical project tickets remain intact; standalone support links a real order/org.
ALTER TABLE "ticket" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "ticket" ADD COLUMN "service_order_id" TEXT;
ALTER TABLE "ticket" ADD COLUMN "responsible_organization_id" TEXT;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_responsible_organization_id_fkey" FOREIGN KEY ("responsible_organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ticket_service_order_id_idx" ON "ticket"("service_order_id");
CREATE INDEX "ticket_responsible_organization_id_status_idx" ON "ticket"("responsible_organization_id", "status");
INSERT INTO "config_parameter" ("id", "updated_at", "key", "value_type", "default_value", "scopeable_to", "group_key", "description")
VALUES (gen_random_uuid()::text, NOW(), 'services.standalone_offers', 'json', '[]'::jsonb, 'global', 'services', 'Explicit standalone supply coverage and responsible organization by actual service ID. Disabled until reviewed configuration is supplied.') ON CONFLICT ("key") DO NOTHING;
-- New standalone support cannot become an unscoped global ticket.
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_scope_required" CHECK ("project_id" IS NOT NULL OR ("service_order_id" IS NOT NULL AND "responsible_organization_id" IS NOT NULL)) NOT VALID;
-- Accepted standalone address/responsibility/terms remain the transaction snapshot.
CREATE OR REPLACE FUNCTION protect_standalone_service_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."service_context"->>'kind' = 'standalone' AND (
    NEW."service_context" IS DISTINCT FROM OLD."service_context" OR
    NEW."terms_snapshot" IS DISTINCT FROM OLD."terms_snapshot" OR
    NEW."project_id" IS DISTINCT FROM OLD."project_id" OR
    NEW."provider_id" IS DISTINCT FROM OLD."provider_id" OR
    NEW."service_id" IS DISTINCT FROM OLD."service_id" OR
    NEW."orderer_identity_id" IS DISTINCT FROM OLD."orderer_identity_id" OR
    NEW."total_thb" IS DISTINCT FROM OLD."total_thb" OR
    NEW."take_rate_pct_snapshot" IS DISTINCT FROM OLD."take_rate_pct_snapshot"
  ) THEN RAISE EXCEPTION 'Accepted standalone service context and terms are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "standalone_service_snapshot_immutable" BEFORE UPDATE ON "service_order" FOR EACH ROW EXECUTE FUNCTION protect_standalone_service_snapshot();
-- Retry identity belongs to the ordering person; null keeps historical orders unchanged.
ALTER TABLE "service_order" ADD COLUMN "request_key" VARCHAR(36), ADD COLUMN "request_fingerprint" VARCHAR(64);
CREATE UNIQUE INDEX "service_order_orderer_identity_id_request_key_key" ON "service_order" ("orderer_identity_id", "request_key");
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_request_intent_pair" CHECK (("request_key" IS NULL) = ("request_fingerprint" IS NULL));
