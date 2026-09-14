-- Canonical v3 completion: F01/F02/F03/F09/F16/F18.
-- Additive migration. Existing project-scoped orders remain valid; standalone
-- orders may omit project_id but must carry an explicit service context.

-- F01: standalone Phuket service orders.
ALTER TABLE "service_order" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "service_order" DROP CONSTRAINT IF EXISTS "service_order_project_id_fkey";
ALTER TABLE "service_order"
  ADD CONSTRAINT "service_order_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_order"
  ADD COLUMN IF NOT EXISTS "service_context" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "quantity_dimensions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "terms_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "quote_version_id" TEXT;

ALTER TABLE "service_order"
  ADD CONSTRAINT "service_order_context_required"
  CHECK (
    "project_id" IS NOT NULL
    OR length(trim(COALESCE("service_context"->>'address', ''))) > 0
    OR length(trim(COALESCE("service_context"->>'area', ''))) > 0
  );

-- F02: property-specific service commercial terms. ServiceProject remains the
-- current configuration record; accepted orders snapshot its complete terms so
-- later edits cannot rewrite historical economics.
ALTER TABLE "service_project"
  ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "public" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "price_override_thb" INTEGER,
  ADD COLUMN IF NOT EXISTS "cost_thb" INTEGER,
  ADD COLUMN IF NOT EXISTS "take_rate_pct" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "lead_time_hours" INTEGER,
  ADD COLUMN IF NOT EXISTS "sla_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "cancellation_policy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "collector" TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS "fulfillment_owner" TEXT NOT NULL DEFAULT 'provider',
  ADD COLUMN IF NOT EXISTS "complaint_owner" TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS "inclusions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "effective_to" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "terms_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "service_project"
  ADD CONSTRAINT "service_project_take_rate_valid"
  CHECK ("take_rate_pct" IS NULL OR ("take_rate_pct" >= 0 AND "take_rate_pct" <= 100));
ALTER TABLE "service_project"
  ADD CONSTRAINT "service_project_price_valid"
  CHECK ("price_override_thb" IS NULL OR "price_override_thb" >= 0);
ALTER TABLE "service_project"
  ADD CONSTRAINT "service_project_cost_valid"
  CHECK ("cost_thb" IS NULL OR "cost_thb" >= 0);
ALTER TABLE "service_project"
  ADD CONSTRAINT "service_project_effective_range_valid"
  CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from");

-- F03: quote request/version contract. Quote versions are immutable after
-- insert; accepting one only stamps accepted_at and the service order references
-- the exact version used for pricing/terms.
CREATE TABLE IF NOT EXISTS "service_quote_request" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "service_id" TEXT NOT NULL REFERENCES "service"("id") ON DELETE CASCADE,
  "project_id" TEXT REFERENCES "project"("id") ON DELETE SET NULL,
  "orderer_identity_id" TEXT NOT NULL REFERENCES "identity"("id") ON DELETE CASCADE,
  "service_context" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "quantity_dimensions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'open',
  "expires_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "service_quote_request_orderer_created_idx"
  ON "service_quote_request"("orderer_identity_id", "created_at");
CREATE INDEX IF NOT EXISTS "service_quote_request_service_status_idx"
  ON "service_quote_request"("service_id", "status");

CREATE TABLE IF NOT EXISTS "service_quote_version" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "request_id" TEXT NOT NULL REFERENCES "service_quote_request"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "provider_id" TEXT NOT NULL REFERENCES "provider"("id") ON DELETE RESTRICT,
  "price_breakdown" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "total_thb" INTEGER NOT NULL,
  "terms_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "accepted_at" TIMESTAMPTZ,
  CONSTRAINT "service_quote_version_total_valid" CHECK ("total_thb" >= 0),
  CONSTRAINT "service_quote_version_request_version_key" UNIQUE ("request_id", "version")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_quote_one_accepted_per_request"
  ON "service_quote_version"("request_id") WHERE "accepted_at" IS NOT NULL;

ALTER TABLE "service_order"
  ADD CONSTRAINT "service_order_quote_version_id_fkey"
  FOREIGN KEY ("quote_version_id") REFERENCES "service_quote_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "service_order_quote_version_unique"
  ON "service_order"("quote_version_id") WHERE "quote_version_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_service_quote_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."request_id" IS DISTINCT FROM OLD."request_id"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."provider_id" IS DISTINCT FROM OLD."provider_id"
     OR NEW."price_breakdown" IS DISTINCT FROM OLD."price_breakdown"
     OR NEW."total_thb" IS DISTINCT FROM OLD."total_thb"
     OR NEW."terms_snapshot" IS DISTINCT FROM OLD."terms_snapshot"
     OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at" THEN
    RAISE EXCEPTION 'service quote versions are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS "service_quote_version_immutable" ON "service_quote_version";
CREATE TRIGGER "service_quote_version_immutable"
BEFORE UPDATE ON "service_quote_version"
FOR EACH ROW EXECUTE FUNCTION prevent_service_quote_version_mutation();

-- F09: replacement-hold rescheduling. The original booking remains untouched
-- while status is pending_funding; the new interval is a held replacement.
CREATE TABLE IF NOT EXISTS "booking_reschedule" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "booking_id" TEXT NOT NULL REFERENCES "booking"("id") ON DELETE CASCADE,
  "requested_by_identity_id" TEXT NOT NULL REFERENCES "identity"("id") ON DELETE RESTRICT,
  "old_start_date" DATE NOT NULL,
  "old_end_date" DATE NOT NULL,
  "new_start_date" DATE NOT NULL,
  "new_end_date" DATE NOT NULL,
  "previous_total_thb" INTEGER NOT NULL,
  "new_total_thb" INTEGER NOT NULL,
  "price_delta_thb" INTEGER NOT NULL,
  "pricing_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'pending_funding',
  "hold_expires_at" TIMESTAMPTZ NOT NULL,
  "payment_id" TEXT REFERENCES "payment"("id") ON DELETE SET NULL,
  "committed_at" TIMESTAMPTZ,
  "released_at" TIMESTAMPTZ,
  CONSTRAINT "booking_reschedule_dates_valid" CHECK ("new_end_date" > "new_start_date"),
  CONSTRAINT "booking_reschedule_status_valid" CHECK ("status" IN ('pending_funding','ready','committed','released','expired','failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "booking_reschedule_one_open_per_booking"
  ON "booking_reschedule"("booking_id")
  WHERE "status" IN ('pending_funding','ready');
CREATE INDEX IF NOT EXISTS "booking_reschedule_hold_idx"
  ON "booking_reschedule"("status", "hold_expires_at");
CREATE INDEX IF NOT EXISTS "booking_reschedule_booking_idx"
  ON "booking_reschedule"("booking_id", "created_at");

-- F16: environment-safe external federation. Mapping uniqueness is scoped by
-- external_system_id, which itself includes environment. Inbox dedup is exact;
-- checkpointing prevents older/out-of-order aggregate events from regressing state.
CREATE TABLE IF NOT EXISTS "external_system" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "system_key" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "external_system_key_environment_key" UNIQUE ("system_key", "environment")
);

CREATE TABLE IF NOT EXISTS "external_mapping" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "external_system_id" TEXT NOT NULL REFERENCES "external_system"("id") ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL,
  "internal_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_version" BIGINT,
  "last_seen_at" TIMESTAMPTZ,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "external_mapping_external_key" UNIQUE ("external_system_id", "entity_type", "external_id"),
  CONSTRAINT "external_mapping_internal_key" UNIQUE ("external_system_id", "entity_type", "internal_id")
);
CREATE INDEX IF NOT EXISTS "external_mapping_internal_idx"
  ON "external_mapping"("entity_type", "internal_id");

CREATE TABLE IF NOT EXISTS "external_event_inbox" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "external_system_id" TEXT NOT NULL REFERENCES "external_system"("id") ON DELETE CASCADE,
  "event_id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_external_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_version" BIGINT,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "payload" JSONB NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "processed_at" TIMESTAMPTZ,
  "error_code" TEXT,
  CONSTRAINT "external_event_inbox_dedup_key" UNIQUE ("external_system_id", "event_id")
);
CREATE INDEX IF NOT EXISTS "external_event_inbox_work_idx"
  ON "external_event_inbox"("status", "received_at");

CREATE TABLE IF NOT EXISTS "external_aggregate_checkpoint" (
  "external_system_id" TEXT NOT NULL REFERENCES "external_system"("id") ON DELETE CASCADE,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_external_id" TEXT NOT NULL,
  "last_event_id" TEXT NOT NULL,
  "last_event_version" BIGINT,
  "last_occurred_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("external_system_id", "aggregate_type", "aggregate_external_id")
);

-- F18: reusable templates + inherited configuration + autosave draft. The
-- operational tables remain authoritative; this is onboarding state only.
CREATE TABLE IF NOT EXISTS "property_onboarding_template" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "template_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "property_type" TEXT NOT NULL,
  "configuration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "checklist" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "property_onboarding_template_key_version_key" UNIQUE ("template_key", "version")
);

CREATE TABLE IF NOT EXISTS "project_onboarding_draft" (
  "project_id" TEXT PRIMARY KEY REFERENCES "project"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "template_id" TEXT REFERENCES "property_onboarding_template"("id") ON DELETE SET NULL,
  "stage_data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "inherited_configuration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "last_stage" TEXT,
  "updated_by_identity_id" TEXT REFERENCES "identity"("id") ON DELETE SET NULL,
  "autosaved_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep the public API closed by default for the new operational/control tables.
-- Application access is through authenticated server routes using Prisma.
REVOKE ALL ON TABLE "service_quote_request", "service_quote_version", "booking_reschedule",
  "external_system", "external_mapping", "external_event_inbox", "external_aggregate_checkpoint",
  "property_onboarding_template", "project_onboarding_draft" FROM PUBLIC;
