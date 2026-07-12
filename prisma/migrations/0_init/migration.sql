-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('active', 'invited', 'blocked', 'merged');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('google', 'apple');

-- CreateEnum
CREATE TYPE "OneTimeTokenPurpose" AS ENUM ('password_reset', 'email_verify', 'account_claim');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'live', 'archived');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('villa', 'condo', 'townhouse');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('draft', 'mobilizing', 'live', 'paused', 'offboarded');

-- CreateEnum
CREATE TYPE "UnitEngagementType" AS ENUM ('direct_managed', 'via_management_company', 'owner_direct');

-- CreateEnum
CREATE TYPE "UnitEngagementStatus" AS ENUM ('draft', 'active', 'ended');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('management_company', 'juristic_person', 'developer');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('owner', 'guest', 'resident', 'buyer', 'provider_member', 'mc_member', 'juristic_member', 'staff_ops', 'onsite_host');

-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM ('platform', 'project', 'unit');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('photo', 'document', 'receipt', 'passport', 'avatar', 'brand');

-- CreateTable
CREATE TABLE "identity" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "latin_first_name" TEXT,
    "latin_last_name" TEXT,
    "email" CITEXT UNIQUE,
    "email_verified_at" TIMESTAMP(3),
    "phone" TEXT UNIQUE,
    "phone_verified_at" TIMESTAMP(3),
    "hashed_password" TEXT,
    "preferred_locale" TEXT NOT NULL DEFAULT 'en',
    "avatar_media_id" TEXT,
    "status" "IdentityStatus" NOT NULL DEFAULT 'active',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "notes_internal" TEXT,
    "merged_into_id" TEXT,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_account_id" TEXT NOT NULL,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_token" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "purpose" "OneTimeTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "one_time_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area_label_key" TEXT NOT NULL,
    "description_key" TEXT NOT NULL,
    "latitude" NUMERIC(9,6) NOT NULL,
    "longitude" NUMERIC(9,6) NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "cover_media_id" TEXT,
    "amenity_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handbook_key" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "default_currency" TEXT NOT NULL DEFAULT 'THB',

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "owner_identity_id" TEXT,
    "name" TEXT NOT NULL,
    "unit_type" "UnitType" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "max_guests" INTEGER NOT NULL,
    "size_sqm" INTEGER,
    "floor" TEXT,
    "address_supplement" TEXT NOT NULL,
    "description_key" TEXT,
    "amenity_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "base_nightly_thb" INTEGER NOT NULL,
    "min_nights" INTEGER NOT NULL,
    "instant_book" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_policy_key" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'draft',
    "permitted_use_confirmed_at" TIMESTAMP(3),
    "cover_media_id" TEXT,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_engagement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "engagement_type" "UnitEngagementType" NOT NULL,
    "owner_identity_id" TEXT NOT NULL,
    "management_org_id" TEXT,
    "noi_cap_annual_thb" INTEGER,
    "fee_override_pct" NUMERIC(5,2),
    "setup_fee_thb" INTEGER,
    "mandate_media_id" TEXT,
    "starts_on" TIMESTAMP(3),
    "ends_on" TIMESTAMP(3),
    "status" "UnitEngagementStatus" NOT NULL DEFAULT 'draft',

    CONSTRAINT "unit_engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "org_type" "OrganizationType" NOT NULL,
    "project_id" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identity_id" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "scope_type" "RoleScopeType" NOT NULL,
    "project_id" TEXT,
    "unit_id" TEXT,
    "organization_id" TEXT,
    "provider_id" TEXT,
    "status" "RoleStatus" NOT NULL DEFAULT 'active',
    "granted_by_identity_id" TEXT,

    CONSTRAINT "role_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_identity_id" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "delete_after" TIMESTAMP(3),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_identity_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_media" (
    "unit_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "unit_media_pkey" PRIMARY KEY ("unit_id","media_id")
);

-- CreateTable
CREATE TABLE "project_media" (
    "project_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_media_pkey" PRIMARY KEY ("project_id","media_id")
);

-- CreateTable
CREATE TABLE "config_parameter" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "default_value" JSONB,
    "enum_options" JSONB,
    "json_schema" JSONB,
    "scopeable_to" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "config_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_override" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "parameter_key" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "config_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_change" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parameter_key" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "changed_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "config_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_key" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supports_rich" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "content_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "content_key_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "updated_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_email_key" ON "identity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "identity_phone_key" ON "identity"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_provider_provider_account_id_key" ON "auth_account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "unit_project_id_name_key" ON "unit"("project_id", "name");

-- CreateIndex
CREATE INDEX "unit_engagement_unit_id_status_idx" ON "unit_engagement"("unit_id", "status");

-- CreateIndex
CREATE INDEX "role_assignment_identity_id_status_idx" ON "role_assignment"("identity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_storage_key_key" ON "media_asset"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "config_parameter_key_key" ON "config_parameter"("key");

-- CreateIndex
CREATE UNIQUE INDEX "config_override_parameter_key_scope_type_scope_id_key" ON "config_override"("parameter_key", "scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_key_key_key" ON "content_key"("key");

-- CreateIndex
CREATE UNIQUE INDEX "translation_content_key_id_locale_key" ON "translation"("content_key_id", "locale");

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_token" ADD CONSTRAINT "one_time_token_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit" ADD CONSTRAINT "unit_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "unit" ADD CONSTRAINT "unit_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit" ADD CONSTRAINT "unit_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_management_org_id_fkey" FOREIGN KEY ("management_org_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_engagement" ADD CONSTRAINT "unit_engagement_mandate_media_id_fkey" FOREIGN KEY ("mandate_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_granted_by_identity_id_fkey" FOREIGN KEY ("granted_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaded_by_identity_id_fkey" FOREIGN KEY ("uploaded_by_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_media" ADD CONSTRAINT "unit_media_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_media" ADD CONSTRAINT "unit_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "config_change" ADD CONSTRAINT "config_change_changed_by_identity_id_fkey" FOREIGN KEY ("changed_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_key" ADD CONSTRAINT "content_key_id_fkey" FOREIGN KEY ("id") REFERENCES "content_key"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "translation_content_key_id_fkey" FOREIGN KEY ("content_key_id") REFERENCES "content_key"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "translation_updated_by_identity_id_fkey" FOREIGN KEY ("updated_by_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE;
