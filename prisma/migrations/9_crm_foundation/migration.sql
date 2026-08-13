-- Ignatev Estate CRM foundation.
-- Identity remains the canonical Party ID shared by Stay, Own, Buy and CRM.

CREATE TYPE "CrmLifecycleStage" AS ENUM ('contact', 'guest', 'prospect', 'buyer', 'owner', 'seller', 'former_client');
CREATE TYPE "CrmOpportunityType" AS ENUM ('rental', 'purchase', 'sale', 'management', 'developer_advisory', 'capex', 'compliance');
CREATE TYPE "CrmOpportunityStage" AS ENUM ('new', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost', 'nurture');
CREATE TYPE "CrmActivityType" AS ENUM ('note', 'task', 'call', 'meeting', 'email', 'whatsapp', 'telegram', 'system');
CREATE TYPE "CrmActivityStatus" AS ENUM ('open', 'completed', 'cancelled');
CREATE TYPE "CrmConsentPurpose" AS ENUM ('service', 'marketing', 'property_matching', 'analytics');
CREATE TYPE "CrmConsentStatus" AS ENUM ('granted', 'withdrawn', 'denied');
CREATE TYPE "CrmTouchType" AS ENUM ('first_touch', 'lead_creation', 'conversion', 'assisted');

CREATE TABLE "crm_profile" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "identity_id" TEXT NOT NULL,
  "lifecycle_stage" "CrmLifecycleStage" NOT NULL DEFAULT 'contact',
  "lead_score" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "preferred_channel" TEXT,
  "first_source" TEXT,
  "last_source" TEXT,
  "last_interaction_at" TIMESTAMP(3),
  "next_action_at" TIMESTAMP(3),
  "owner_since" TIMESTAMP(3),
  "guest_since" TIMESTAMP(3),
  "custom_fields" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "crm_profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_opportunity" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "identity_id" TEXT NOT NULL,
  "assigned_to_identity_id" TEXT,
  "project_id" TEXT,
  "unit_id" TEXT,
  "type" "CrmOpportunityType" NOT NULL,
  "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'new',
  "title" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "value_thb" INTEGER,
  "probability" INTEGER NOT NULL DEFAULT 10,
  "requirements" JSONB NOT NULL DEFAULT '{}',
  "expected_close_at" TIMESTAMP(3),
  "next_action_at" TIMESTAMP(3),
  "won_at" TIMESTAMP(3),
  "lost_at" TIMESTAMP(3),
  "lost_reason" TEXT,
  "external_partner" TEXT,
  CONSTRAINT "crm_opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_opportunity_probability_check" CHECK ("probability" >= 0 AND "probability" <= 100)
);

CREATE TABLE "crm_activity" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "identity_id" TEXT NOT NULL,
  "opportunity_id" TEXT,
  "created_by_identity_id" TEXT,
  "type" "CrmActivityType" NOT NULL,
  "status" "CrmActivityStatus" NOT NULL DEFAULT 'open',
  "subject" TEXT NOT NULL,
  "body" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "channel_reference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "crm_activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_consent" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "identity_id" TEXT NOT NULL,
  "purpose" "CrmConsentPurpose" NOT NULL,
  "status" "CrmConsentStatus" NOT NULL,
  "channel" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "evidence" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "crm_consent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_attribution_touch" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "identity_id" TEXT NOT NULL,
  "touch_type" "CrmTouchType" NOT NULL,
  "source" TEXT NOT NULL,
  "medium" TEXT,
  "campaign" TEXT,
  "content" TEXT,
  "landing_page" TEXT,
  "referrer" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "crm_attribution_touch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_profile_identity_id_key" ON "crm_profile"("identity_id");
CREATE INDEX "crm_profile_lifecycle_stage_next_action_at_idx" ON "crm_profile"("lifecycle_stage", "next_action_at");
CREATE INDEX "crm_profile_lead_score_idx" ON "crm_profile"("lead_score");
CREATE INDEX "crm_opportunity_stage_next_action_at_idx" ON "crm_opportunity"("stage", "next_action_at");
CREATE INDEX "crm_opportunity_identity_id_created_at_idx" ON "crm_opportunity"("identity_id", "created_at");
CREATE INDEX "crm_opportunity_assigned_to_identity_id_stage_idx" ON "crm_opportunity"("assigned_to_identity_id", "stage");
CREATE INDEX "crm_opportunity_type_stage_idx" ON "crm_opportunity"("type", "stage");
CREATE INDEX "crm_activity_status_due_at_idx" ON "crm_activity"("status", "due_at");
CREATE INDEX "crm_activity_identity_id_created_at_idx" ON "crm_activity"("identity_id", "created_at");
CREATE INDEX "crm_activity_opportunity_id_created_at_idx" ON "crm_activity"("opportunity_id", "created_at");
CREATE INDEX "crm_consent_identity_id_purpose_captured_at_idx" ON "crm_consent"("identity_id", "purpose", "captured_at");
CREATE INDEX "crm_consent_status_expires_at_idx" ON "crm_consent"("status", "expires_at");
CREATE INDEX "crm_attribution_touch_identity_id_occurred_at_idx" ON "crm_attribution_touch"("identity_id", "occurred_at");
CREATE INDEX "crm_attribution_touch_source_campaign_occurred_at_idx" ON "crm_attribution_touch"("source", "campaign", "occurred_at");

ALTER TABLE "crm_profile" ADD CONSTRAINT "crm_profile_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_opportunity" ADD CONSTRAINT "crm_opportunity_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_opportunity" ADD CONSTRAINT "crm_opportunity_assigned_to_identity_id_fkey" FOREIGN KEY ("assigned_to_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunity" ADD CONSTRAINT "crm_opportunity_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunity" ADD CONSTRAINT "crm_opportunity_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activity" ADD CONSTRAINT "crm_activity_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activity" ADD CONSTRAINT "crm_activity_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activity" ADD CONSTRAINT "crm_activity_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_consent" ADD CONSTRAINT "crm_consent_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_attribution_touch" ADD CONSTRAINT "crm_attribution_touch_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
