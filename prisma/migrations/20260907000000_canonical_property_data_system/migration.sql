-- Canonical Property Data System Migration

-- Alter Project
ALTER TABLE "project"
ADD COLUMN "project_type" TEXT,
ADD COLUMN "hospitality_classification" TEXT,
ADD COLUMN "development_lifecycle_status" TEXT,
ADD COLUMN "operational_status" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'TH',
ADD COLUMN "region" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postcode" TEXT,
ADD COLUMN "construction_status" TEXT,
ADD COLUMN "launch_date" TIMESTAMP(3),
ADD COLUMN "completion_date" TIMESTAMP(3),
ADD COLUMN "completion_year" INTEGER,
ADD COLUMN "expected_completion" TIMESTAMP(3),
ADD COLUMN "total_units" INTEGER,
ADD COLUMN "total_buildings" INTEGER,
ADD COLUMN "floors" INTEGER,
ADD COLUMN "land_area_sqm" DECIMAL(10,2),
ADD COLUMN "common_area_sqm" DECIMAL(10,2),
ADD COLUMN "masterplan_media_id" TEXT,
ADD COLUMN "phases" JSONB,
ADD COLUMN "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hospitality_config" JSONB;

-- Alter Organization
ALTER TABLE "organization"
ADD COLUMN "legal_name" TEXT,
ADD COLUMN "trading_name" TEXT,
ADD COLUMN "logo_media_id" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "hq_country" TEXT,
ADD COLUMN "office_address" TEXT,
ADD COLUMN "registration_number" TEXT,
ADD COLUMN "tax_identifier" TEXT,
ADD COLUMN "year_established" INTEGER,
ADD COLUMN "profile_key" TEXT,
ADD COLUMN "parent_organization_id" TEXT,
ADD COLUMN "listed_exchange" TEXT,
ADD COLUMN "developer_track_record" JSONB,
ADD COLUMN "developer_verification" TEXT DEFAULT 'unverified';

-- Alter Unit
ALTER TABLE "unit"
ADD COLUMN "inventory_category_id" TEXT,
ADD COLUMN "privacy_type" TEXT DEFAULT 'entire_place',
ADD COLUMN "accommodation_type" TEXT,
ADD COLUMN "usable_area_sqm" DECIMAL(10,2),
ADD COLUMN "gross_area_sqm" DECIMAL(10,2),
ADD COLUMN "outdoor_area_sqm" DECIMAL(10,2),
ADD COLUMN "plot_area_sqm" DECIMAL(10,2),
ADD COLUMN "balcony_area_sqm" DECIMAL(10,2),
ADD COLUMN "unit_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "accessibility_facts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "safety_facts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "furnishing_status" TEXT,
ADD COLUMN "views" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "pet_fee_thb" INTEGER,
ADD COLUMN "pet_rules" TEXT;

-- Create Table: inventory_category
CREATE TABLE "inventory_category" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "max_guests" INTEGER NOT NULL,
    "base_nightly_thb" INTEGER NOT NULL,
    "min_nights" INTEGER NOT NULL DEFAULT 1,
    "cancellation_policy_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'live',

    CONSTRAINT "inventory_category_pkey" PRIMARY KEY ("id")
);

-- Create Table: rate_plan
CREATE TABLE "rate_plan" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT,
    "category_id" TEXT,
    "unit_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_master" BOOLEAN NOT NULL DEFAULT true,
    "parent_rate_plan_id" TEXT,
    "adjustment_type" TEXT,
    "adjustment_value" DECIMAL(10,2),
    "cancellation_policy_key" TEXT,
    "min_nights" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "rate_plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_category_project_id_category_key_key" ON "inventory_category"("project_id", "category_key");
CREATE UNIQUE INDEX "rate_plan_project_id_code_key" ON "rate_plan"("project_id", "code");
CREATE INDEX "rate_plan_category_id_idx" ON "rate_plan"("category_id");
CREATE INDEX "rate_plan_unit_id_idx" ON "rate_plan"("unit_id");

ALTER TABLE "unit" ADD CONSTRAINT "unit_inventory_category_id_fkey" FOREIGN KEY ("inventory_category_id") REFERENCES "inventory_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_category" ADD CONSTRAINT "inventory_category_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_parent_rate_plan_id_fkey" FOREIGN KEY ("parent_rate_plan_id") REFERENCES "rate_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Table: project_organization_role
CREATE TABLE "project_organization_role" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "provenance" TEXT DEFAULT 'verified',

    CONSTRAINT "project_organization_role_pkey" PRIMARY KEY ("id")
);

-- Create Table: sleeping_space
CREATE TABLE "sleeping_space" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "space_type" TEXT NOT NULL DEFAULT 'bedroom',
    "name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sleeping_space_pkey" PRIMARY KEY ("id")
);

-- Create Table: bed
CREATE TABLE "bed" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sleeping_space_id" TEXT NOT NULL,
    "bed_type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "bed_pkey" PRIMARY KEY ("id")
);

-- Create Table: commercial_offering
CREATE TABLE "commercial_offering" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT,
    "unit_id" TEXT,
    "offering_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pricing_terms" JSONB NOT NULL DEFAULT '{}',
    "rules_and_policies" JSONB NOT NULL DEFAULT '{}',
    "ownership_tenure" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "commercial_offering_pkey" PRIMARY KEY ("id")
);

-- Create Table: channel_mapping
CREATE TABLE "channel_mapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "offering_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "external_listing_id" TEXT,
    "sync_state" TEXT NOT NULL DEFAULT 'synced',
    "external_status" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "channel_overrides" JSONB NOT NULL DEFAULT '{}',
    "sync_errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "channel_mapping_pkey" PRIMARY KEY ("id")
);

-- Create Table: regulatory_credential
CREATE TABLE "regulatory_credential" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "requirement_key" TEXT NOT NULL,
    "jurisdiction_country" TEXT NOT NULL DEFAULT 'TH',
    "credential_type" TEXT NOT NULL,
    "scope_level" TEXT NOT NULL,
    "organization_id" TEXT,
    "project_id" TEXT,
    "unit_id" TEXT,
    "registration_number" TEXT,
    "issuing_authority" TEXT,
    "legal_holder_name" TEXT,
    "issue_date" TIMESTAMP(3),
    "effective_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "exemption_basis" TEXT,
    "evidence_media_id" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'verified',
    "verified_by_identity_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "regulatory_credential_pkey" PRIMARY KEY ("id")
);

-- Create Indexes & Unique Constraints
CREATE UNIQUE INDEX "project_organization_role_project_id_organization_id_role_key_key" ON "project_organization_role"("project_id", "organization_id", "role_key");
CREATE INDEX "project_organization_role_project_id_role_key_idx" ON "project_organization_role"("project_id", "role_key");
CREATE INDEX "project_organization_role_organization_id_idx" ON "project_organization_role"("organization_id");

CREATE INDEX "sleeping_space_unit_id_sort_order_idx" ON "sleeping_space"("unit_id", "sort_order");
CREATE INDEX "bed_sleeping_space_id_idx" ON "bed"("sleeping_space_id");

CREATE INDEX "commercial_offering_unit_id_offering_type_idx" ON "commercial_offering"("unit_id", "offering_type");
CREATE INDEX "commercial_offering_project_id_offering_type_idx" ON "commercial_offering"("project_id", "offering_type");

CREATE UNIQUE INDEX "channel_mapping_offering_id_channel_key" ON "channel_mapping"("offering_id", "channel");

CREATE INDEX "regulatory_credential_organization_id_status_idx" ON "regulatory_credential"("organization_id", "status");
CREATE INDEX "regulatory_credential_project_id_status_idx" ON "regulatory_credential"("project_id", "status");
CREATE INDEX "regulatory_credential_unit_id_status_idx" ON "regulatory_credential"("unit_id", "status");
CREATE INDEX "regulatory_credential_credential_type_status_idx" ON "regulatory_credential"("credential_type", "status");

-- Foreign Keys
ALTER TABLE "project" ADD CONSTRAINT "project_masterplan_media_id_fkey" FOREIGN KEY ("masterplan_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization" ADD CONSTRAINT "organization_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization" ADD CONSTRAINT "organization_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_organization_role" ADD CONSTRAINT "project_organization_role_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_organization_role" ADD CONSTRAINT "project_organization_role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sleeping_space" ADD CONSTRAINT "sleeping_space_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bed" ADD CONSTRAINT "bed_sleeping_space_id_fkey" FOREIGN KEY ("sleeping_space_id") REFERENCES "sleeping_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_offering" ADD CONSTRAINT "commercial_offering_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_offering" ADD CONSTRAINT "commercial_offering_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_mapping" ADD CONSTRAINT "channel_mapping_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "commercial_offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regulatory_credential" ADD CONSTRAINT "regulatory_credential_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regulatory_credential" ADD CONSTRAINT "regulatory_credential_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regulatory_credential" ADD CONSTRAINT "regulatory_credential_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regulatory_credential" ADD CONSTRAINT "regulatory_credential_evidence_media_id_fkey" FOREIGN KEY ("evidence_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regulatory_credential" ADD CONSTRAINT "regulatory_credential_verified_by_identity_id_fkey" FOREIGN KEY ("verified_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS on new tables
DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;
