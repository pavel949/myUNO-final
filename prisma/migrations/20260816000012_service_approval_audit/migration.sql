-- Record who approved a service and when.
--
-- Approval is a gate an admin passes a service through, but only the resulting
-- status was stored: the platform knew a service was approved, not by whom or
-- when. Provider vetting already keeps this trail (vetted_at /
-- vetted_by_identity_id); this brings the service layer level with it, per the
-- audit-logging rules in CLAUDE.md.
--
-- The idea comes from PR #8, which is otherwise superseded by the merged S2/S3
-- vetting work. Rewritten here rather than cherry-picked: that branch carried an
-- un-timestamped migration folder, which no longer fits the naming the chain
-- depends on for ordering.

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_identity_id" TEXT;

-- CreateIndex
CREATE INDEX "service_status_approved_at_idx" ON "service"("status", "approved_at");

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_approved_by_identity_id_fkey" FOREIGN KEY ("approved_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

