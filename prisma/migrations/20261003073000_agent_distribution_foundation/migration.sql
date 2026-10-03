-- Agent / Distribution OS foundation.
-- Adds agent-scoped commercial records without duplicating canonical inventory or pricing.

ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'agency';
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'distribution_partner';
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'agent_member';

CREATE TABLE "agent_client_protection" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "agent_identity_id" TEXT NOT NULL,
  "agency_organization_id" TEXT,
  "client_identity_id" TEXT,
  "client_name" TEXT NOT NULL,
  "client_phone" TEXT,
  "client_whatsapp" TEXT,
  "transaction_scope" TEXT NOT NULL DEFAULT 'all',
  "destination_scope" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  CONSTRAINT "agent_client_protection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_shortlist" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "agent_identity_id" TEXT NOT NULL,
  "agency_organization_id" TEXT,
  "client_protection_id" TEXT,
  "title" TEXT NOT NULL,
  "brand_mode" TEXT NOT NULL DEFAULT 'myuno',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  CONSTRAINT "agent_shortlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_shortlist_item" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shortlist_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  CONSTRAINT "agent_shortlist_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_quote" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "agent_identity_id" TEXT NOT NULL,
  "agency_organization_id" TEXT,
  "client_protection_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "base_total_satang" INTEGER NOT NULL DEFAULT 0,
  "markup_satang" INTEGER NOT NULL DEFAULT 0,
  "discount_satang" INTEGER NOT NULL DEFAULT 0,
  "fees_satang" INTEGER NOT NULL DEFAULT 0,
  "taxes_satang" INTEGER NOT NULL DEFAULT 0,
  "client_total_satang" INTEGER NOT NULL DEFAULT 0,
  "commission_satang" INTEGER NOT NULL DEFAULT 0,
  "availability_state" TEXT NOT NULL DEFAULT 'request',
  "valid_until" TIMESTAMP(3),
  "price_breakdown" JSONB,
  "public_note" TEXT,
  CONSTRAINT "agent_quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_quote_item" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quote_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "base_satang" INTEGER NOT NULL DEFAULT 0,
  "markup_satang" INTEGER NOT NULL DEFAULT 0,
  "client_satang" INTEGER NOT NULL DEFAULT 0,
  "rate_snapshot" JSONB,
  CONSTRAINT "agent_quote_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_commission" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "agent_identity_id" TEXT NOT NULL,
  "agency_organization_id" TEXT,
  "booking_id" TEXT,
  "transaction_type" TEXT NOT NULL,
  "transaction_ref" TEXT,
  "basis_amount_satang" INTEGER NOT NULL,
  "rate_bps" INTEGER NOT NULL DEFAULT 1000,
  "amount_satang" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'estimated',
  "approved_at" TIMESTAMP(3),
  "payable_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "reversed_at" TIMESTAMP(3),
  CONSTRAINT "agent_commission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_shared_link" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "agent_identity_id" TEXT NOT NULL,
  "shortlist_id" TEXT,
  "quote_id" TEXT,
  "token" TEXT NOT NULL,
  "brand_mode" TEXT NOT NULL DEFAULT 'myuno',
  "expires_at" TIMESTAMP(3),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "last_viewed_at" TIMESTAMP(3),
  CONSTRAINT "agent_shared_link_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_client_protection_agent_identity_id_status_expires_at_idx"
  ON "agent_client_protection"("agent_identity_id","status","expires_at");
CREATE INDEX "agent_client_protection_agency_organization_id_status_idx"
  ON "agent_client_protection"("agency_organization_id","status");
CREATE INDEX "agent_client_protection_client_phone_idx"
  ON "agent_client_protection"("client_phone");

CREATE INDEX "agent_shortlist_agent_identity_id_status_idx"
  ON "agent_shortlist"("agent_identity_id","status");
CREATE INDEX "agent_shortlist_agency_organization_id_status_idx"
  ON "agent_shortlist"("agency_organization_id","status");

CREATE UNIQUE INDEX "agent_shortlist_item_shortlist_id_unit_id_key"
  ON "agent_shortlist_item"("shortlist_id","unit_id");
CREATE INDEX "agent_shortlist_item_unit_id_idx"
  ON "agent_shortlist_item"("unit_id");

CREATE INDEX "agent_quote_agent_identity_id_status_created_at_idx"
  ON "agent_quote"("agent_identity_id","status","created_at");
CREATE INDEX "agent_quote_agency_organization_id_status_idx"
  ON "agent_quote"("agency_organization_id","status");
CREATE INDEX "agent_quote_item_quote_id_idx" ON "agent_quote_item"("quote_id");
CREATE INDEX "agent_quote_item_unit_id_start_date_end_date_idx"
  ON "agent_quote_item"("unit_id","start_date","end_date");

CREATE INDEX "agent_commission_agent_identity_id_status_idx"
  ON "agent_commission"("agent_identity_id","status");
CREATE INDEX "agent_commission_agency_organization_id_status_idx"
  ON "agent_commission"("agency_organization_id","status");
CREATE INDEX "agent_commission_booking_id_idx" ON "agent_commission"("booking_id");

CREATE UNIQUE INDEX "agent_shared_link_token_key" ON "agent_shared_link"("token");
CREATE INDEX "agent_shared_link_agent_identity_id_created_at_idx"
  ON "agent_shared_link"("agent_identity_id","created_at");
CREATE INDEX "agent_shared_link_shortlist_id_idx" ON "agent_shared_link"("shortlist_id");
CREATE INDEX "agent_shared_link_quote_id_idx" ON "agent_shared_link"("quote_id");

ALTER TABLE "agent_client_protection"
  ADD CONSTRAINT "agent_client_protection_agent_identity_id_fkey"
  FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_client_protection"
  ADD CONSTRAINT "agent_client_protection_client_identity_id_fkey"
  FOREIGN KEY ("client_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_client_protection"
  ADD CONSTRAINT "agent_client_protection_agency_organization_id_fkey"
  FOREIGN KEY ("agency_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_shortlist"
  ADD CONSTRAINT "agent_shortlist_agent_identity_id_fkey"
  FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_shortlist"
  ADD CONSTRAINT "agent_shortlist_agency_organization_id_fkey"
  FOREIGN KEY ("agency_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_shortlist"
  ADD CONSTRAINT "agent_shortlist_client_protection_id_fkey"
  FOREIGN KEY ("client_protection_id") REFERENCES "agent_client_protection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_shortlist_item"
  ADD CONSTRAINT "agent_shortlist_item_shortlist_id_fkey"
  FOREIGN KEY ("shortlist_id") REFERENCES "agent_shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_shortlist_item"
  ADD CONSTRAINT "agent_shortlist_item_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_quote"
  ADD CONSTRAINT "agent_quote_agent_identity_id_fkey"
  FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_quote"
  ADD CONSTRAINT "agent_quote_agency_organization_id_fkey"
  FOREIGN KEY ("agency_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_quote"
  ADD CONSTRAINT "agent_quote_client_protection_id_fkey"
  FOREIGN KEY ("client_protection_id") REFERENCES "agent_client_protection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_quote_item"
  ADD CONSTRAINT "agent_quote_item_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "agent_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_quote_item"
  ADD CONSTRAINT "agent_quote_item_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_commission"
  ADD CONSTRAINT "agent_commission_agent_identity_id_fkey"
  FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_commission"
  ADD CONSTRAINT "agent_commission_agency_organization_id_fkey"
  FOREIGN KEY ("agency_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_commission"
  ADD CONSTRAINT "agent_commission_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_shared_link"
  ADD CONSTRAINT "agent_shared_link_agent_identity_id_fkey"
  FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_shared_link"
  ADD CONSTRAINT "agent_shared_link_shortlist_id_fkey"
  FOREIGN KEY ("shortlist_id") REFERENCES "agent_shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_shared_link"
  ADD CONSTRAINT "agent_shared_link_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "agent_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_shared_link"
  ADD CONSTRAINT "agent_shared_link_one_target_chk"
  CHECK (
    ("shortlist_id" IS NOT NULL AND "quote_id" IS NULL)
    OR ("shortlist_id" IS NULL AND "quote_id" IS NOT NULL)
  );

ALTER TABLE "agent_client_protection"
  ADD CONSTRAINT "agent_client_protection_expiry_chk"
  CHECK ("expires_at" > "starts_at");

ALTER TABLE "agent_commission"
  ADD CONSTRAINT "agent_commission_non_negative_chk"
  CHECK ("basis_amount_satang" >= 0 AND "rate_bps" >= 0 AND "amount_satang" >= 0);


-- Agent commercial records are server-authorized. Public share pages read
-- through server code; Supabase Data API roles receive no direct table access.
ALTER TABLE "agent_client_protection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_shortlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_shortlist_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_quote_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_commission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_shared_link" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "agent_client_protection" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_shortlist" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_shortlist_item" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_quote" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_quote_item" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_commission" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "agent_shared_link" FROM PUBLIC, anon, authenticated;
