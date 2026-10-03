-- Distribution policy is an additive configuration layer on canonical
-- CommercialOffering. Unit, Booking, availability and pricing remain authoritative.

CREATE TABLE "offering_distribution_policy" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "offering_id" TEXT NOT NULL,
  "supply_organization_id" TEXT,
  "inventory_source" TEXT NOT NULL DEFAULT 'managed',
  "availability_mode" TEXT NOT NULL DEFAULT 'live',
  "booking_mode" TEXT NOT NULL DEFAULT 'request',
  "agent_distribution_enabled" BOOLEAN NOT NULL DEFAULT true,
  "direct_distribution_enabled" BOOLEAN NOT NULL DEFAULT true,
  "ota_distribution_enabled" BOOLEAN NOT NULL DEFAULT false,
  "allow_agent_markup" BOOLEAN NOT NULL DEFAULT true,
  "max_agent_markup_bps" INTEGER,
  "default_agent_commission_bps" INTEGER NOT NULL DEFAULT 1000,
  "confirmation_sla_minutes" INTEGER,
  "stale_after_minutes" INTEGER,
  "notes" TEXT,
  CONSTRAINT "offering_distribution_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offering_distribution_policy_offering_id_key"
  ON "offering_distribution_policy"("offering_id");
CREATE INDEX "offering_policy_source_availability_idx"
  ON "offering_distribution_policy"("inventory_source","availability_mode");
CREATE INDEX "offering_policy_agent_booking_idx"
  ON "offering_distribution_policy"("agent_distribution_enabled","booking_mode");
CREATE INDEX "offering_policy_supply_org_idx"
  ON "offering_distribution_policy"("supply_organization_id");

ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_offering_id_fkey"
  FOREIGN KEY ("offering_id") REFERENCES "commercial_offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_supply_organization_id_fkey"
  FOREIGN KEY ("supply_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_inventory_source_chk"
  CHECK ("inventory_source" IN ('managed','partner'));
ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_availability_mode_chk"
  CHECK ("availability_mode" IN ('live','synced','request'));
ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_booking_mode_chk"
  CHECK ("booking_mode" IN ('instant','request','operator_approval','partner_approval','not_agent_bookable'));
ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_money_rules_chk"
  CHECK (
    "default_agent_commission_bps" >= 0
    AND ("max_agent_markup_bps" IS NULL OR "max_agent_markup_bps" >= 0)
  );
ALTER TABLE "offering_distribution_policy"
  ADD CONSTRAINT "offering_distribution_policy_sla_chk"
  CHECK (
    ("confirmation_sla_minutes" IS NULL OR "confirmation_sla_minutes" > 0)
    AND ("stale_after_minutes" IS NULL OR "stale_after_minutes" > 0)
  );

ALTER TABLE "offering_distribution_policy" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "offering_distribution_policy" FROM PUBLIC, anon, authenticated;

-- Quote items keep the commercial context they were calculated from.
ALTER TABLE "agent_quote_item" ADD COLUMN "offering_id" TEXT;
CREATE INDEX "agent_quote_item_offering_id_idx" ON "agent_quote_item"("offering_id");
ALTER TABLE "agent_quote_item"
  ADD CONSTRAINT "agent_quote_item_offering_id_fkey"
  FOREIGN KEY ("offering_id") REFERENCES "commercial_offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
