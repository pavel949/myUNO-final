-- CreateEnum
CREATE TYPE "AgentMembershipRole" AS ENUM ('agent', 'manager');

-- CreateEnum
CREATE TYPE "AgentMembershipStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "AgentQuoteStatus" AS ENUM ('draft', 'submitted', 'approved', 'revoked');

-- CreateEnum
CREATE TYPE "AgentHandoverStatus" AS ENUM ('queued', 'acknowledged', 'completed', 'declined');

-- CreateEnum
CREATE TYPE "AgentKnowledgeStatus" AS ENUM ('draft', 'published', 'withdrawn');

-- CreateEnum
CREATE TYPE "AgentCommissionStatus" AS ENUM ('pending', 'due', 'paid', 'disputed');

-- AlterEnum
ALTER TYPE "OrganizationType" ADD VALUE 'brokerage';

-- AlterTable
ALTER TABLE "crm_activity" ADD COLUMN     "workspace_id" TEXT;

-- CreateTable
CREATE TABLE "organization_membership" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "role" "AgentMembershipRole" NOT NULL DEFAULT 'agent',
    "status" "AgentMembershipStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "organization_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workspace" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "crm_workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contact_relationship" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "identity_id" TEXT NOT NULL,
    "owner_identity_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" CITEXT,
    "phone" TEXT,
    "telegram" TEXT,
    "private_notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "crm_contact_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_introduction" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspace_id" TEXT NOT NULL,
    "relationship_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "agent_identity_id" TEXT NOT NULL,

    CONSTRAINT "agent_introduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_handover" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "introduction_id" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "contact_snapshot" JSONB NOT NULL,
    "shared_by_identity_id" TEXT NOT NULL,
    "consent_confirmed_at" TIMESTAMP(3) NOT NULL,
    "status" "AgentHandoverStatus" NOT NULL DEFAULT 'queued',
    "coordinator_identity_id" TEXT,

    CONSTRAINT "agent_handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_quote" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "introduction_id" TEXT NOT NULL,
    "offering_id" TEXT NOT NULL,
    "created_by_identity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount_satang" BIGINT NOT NULL,
    "fee_satang" BIGINT NOT NULL,
    "deposit_satang" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "terms" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "AgentQuoteStatus" NOT NULL DEFAULT 'draft',

    CONSTRAINT "agent_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_quote_version" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quote_id" TEXT NOT NULL,
    "approved_by_identity_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "agent_quote_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_quote_share" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version_id" TEXT NOT NULL,
    "created_by_identity_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "agent_quote_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_knowledge_article" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "status" "AgentKnowledgeStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reviewed_by_identity_id" TEXT,

    CONSTRAINT "agent_knowledge_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_agreement_version" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "due_milestone" TEXT NOT NULL,
    "deadline_basis" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "approved_by_identity_id" TEXT NOT NULL,

    CONSTRAINT "agent_agreement_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_commission" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "introduction_id" TEXT NOT NULL,
    "agreement_version_id" TEXT NOT NULL,
    "amount_satang" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" "AgentCommissionStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3),
    "target_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "ledger_entry_id" TEXT,
    "payout_id" TEXT,

    CONSTRAINT "agent_commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_membership_identity_id_status_idx" ON "organization_membership"("identity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_membership_organization_id_identity_id_key" ON "organization_membership"("organization_id", "identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_workspace_organization_id_key" ON "crm_workspace"("organization_id");

-- CreateIndex
CREATE INDEX "crm_contact_relationship_workspace_id_owner_identity_id_idx" ON "crm_contact_relationship"("workspace_id", "owner_identity_id");

-- CreateIndex
CREATE INDEX "crm_contact_relationship_email_idx" ON "crm_contact_relationship"("email");

-- CreateIndex
CREATE INDEX "crm_contact_relationship_phone_idx" ON "crm_contact_relationship"("phone");

-- CreateIndex
CREATE INDEX "crm_contact_relationship_telegram_idx" ON "crm_contact_relationship"("telegram");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contact_relationship_workspace_id_identity_id_key" ON "crm_contact_relationship"("workspace_id", "identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_introduction_opportunity_id_key" ON "agent_introduction"("opportunity_id");

-- CreateIndex
CREATE INDEX "agent_introduction_workspace_id_agent_identity_id_created_a_idx" ON "agent_introduction"("workspace_id", "agent_identity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_handover_introduction_id_key" ON "agent_handover"("introduction_id");

-- CreateIndex
CREATE INDEX "agent_handover_status_created_at_idx" ON "agent_handover"("status", "created_at");

-- CreateIndex
CREATE INDEX "agent_quote_workspace_id_status_created_at_idx" ON "agent_quote"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_quote_version_quote_id_key" ON "agent_quote_version"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_quote_share_token_hash_key" ON "agent_quote_share"("token_hash");

-- CreateIndex
CREATE INDEX "agent_quote_share_version_id_expires_at_idx" ON "agent_quote_share"("version_id", "expires_at");

-- CreateIndex
CREATE INDEX "agent_knowledge_article_status_locale_expires_at_idx" ON "agent_knowledge_article"("status", "locale", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_agreement_version_organization_id_version_key" ON "agent_agreement_version"("organization_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "agent_commission_introduction_id_key" ON "agent_commission"("introduction_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_commission_ledger_entry_id_key" ON "agent_commission"("ledger_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_commission_payout_id_key" ON "agent_commission"("payout_id");

-- CreateIndex
CREATE INDEX "agent_commission_status_deadline_at_idx" ON "agent_commission"("status", "deadline_at");

-- AddForeignKey
ALTER TABLE "crm_activity" ADD CONSTRAINT "crm_activity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "crm_workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workspace" ADD CONSTRAINT "crm_workspace_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_relationship" ADD CONSTRAINT "crm_contact_relationship_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "crm_workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_relationship" ADD CONSTRAINT "crm_contact_relationship_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_relationship" ADD CONSTRAINT "crm_contact_relationship_owner_identity_id_fkey" FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_introduction" ADD CONSTRAINT "agent_introduction_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "crm_workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_introduction" ADD CONSTRAINT "agent_introduction_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "crm_contact_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_introduction" ADD CONSTRAINT "agent_introduction_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_introduction" ADD CONSTRAINT "agent_introduction_agent_identity_id_fkey" FOREIGN KEY ("agent_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_handover" ADD CONSTRAINT "agent_handover_introduction_id_fkey" FOREIGN KEY ("introduction_id") REFERENCES "agent_introduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_handover" ADD CONSTRAINT "agent_handover_shared_by_identity_id_fkey" FOREIGN KEY ("shared_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_handover" ADD CONSTRAINT "agent_handover_coordinator_identity_id_fkey" FOREIGN KEY ("coordinator_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote" ADD CONSTRAINT "agent_quote_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "crm_workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote" ADD CONSTRAINT "agent_quote_introduction_id_fkey" FOREIGN KEY ("introduction_id") REFERENCES "agent_introduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote" ADD CONSTRAINT "agent_quote_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "commercial_offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote" ADD CONSTRAINT "agent_quote_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote_version" ADD CONSTRAINT "agent_quote_version_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "agent_quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote_version" ADD CONSTRAINT "agent_quote_version_approved_by_identity_id_fkey" FOREIGN KEY ("approved_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote_share" ADD CONSTRAINT "agent_quote_share_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "agent_quote_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_quote_share" ADD CONSTRAINT "agent_quote_share_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_knowledge_article" ADD CONSTRAINT "agent_knowledge_article_reviewed_by_identity_id_fkey" FOREIGN KEY ("reviewed_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_agreement_version" ADD CONSTRAINT "agent_agreement_version_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_agreement_version" ADD CONSTRAINT "agent_agreement_version_approved_by_identity_id_fkey" FOREIGN KEY ("approved_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commission" ADD CONSTRAINT "agent_commission_introduction_id_fkey" FOREIGN KEY ("introduction_id") REFERENCES "agent_introduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commission" ADD CONSTRAINT "agent_commission_agreement_version_id_fkey" FOREIGN KEY ("agreement_version_id") REFERENCES "agent_agreement_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commission" ADD CONSTRAINT "agent_commission_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commission" ADD CONSTRAINT "agent_commission_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE public."organization_membership" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."organization_membership" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."crm_workspace" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."crm_workspace" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."crm_contact_relationship" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."crm_contact_relationship" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_introduction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_introduction" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_handover" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_handover" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_quote" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_quote" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_quote_version" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_quote_version" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_quote_share" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_quote_share" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_knowledge_article" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_knowledge_article" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_agreement_version" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_agreement_version" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."agent_commission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."agent_commission" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."crm_opportunity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."crm_opportunity" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."crm_activity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."crm_activity" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE agent_quote ADD CONSTRAINT agent_quote_amounts_nonnegative CHECK (amount_satang > 0 AND fee_satang >= 0 AND deposit_satang >= 0);
ALTER TABLE agent_commission ADD CONSTRAINT agent_commission_amount_nonnegative CHECK (amount_satang >= 0);
ALTER TABLE agent_commission ADD CONSTRAINT agent_commission_due_dates CHECK (status NOT IN ('due','paid') OR (due_at IS NOT NULL AND target_at IS NOT NULL AND deadline_at IS NOT NULL AND target_at >= due_at AND deadline_at >= target_at));
ALTER TABLE agent_commission ADD CONSTRAINT agent_commission_paid_evidence CHECK (status <> 'paid' OR (ledger_entry_id IS NOT NULL AND payout_id IS NOT NULL));
ALTER TABLE agent_agreement_version ADD CONSTRAINT agent_agreement_deadline_basis CHECK (deadline_basis IN ('calendar','business'));
CREATE FUNCTION agent_immutable_record() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'agent record is immutable; create a new version instead';
END;
$$;
REVOKE ALL ON FUNCTION agent_immutable_record() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER agent_introduction_immutable BEFORE UPDATE OR DELETE ON agent_introduction FOR EACH ROW EXECUTE FUNCTION agent_immutable_record();
CREATE TRIGGER agent_quote_version_immutable BEFORE UPDATE OR DELETE ON agent_quote_version FOR EACH ROW EXECUTE FUNCTION agent_immutable_record();
CREATE TRIGGER agent_agreement_version_immutable BEFORE UPDATE OR DELETE ON agent_agreement_version FOR EACH ROW EXECUTE FUNCTION agent_immutable_record();
