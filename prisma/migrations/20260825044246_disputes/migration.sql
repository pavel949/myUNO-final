-- CreateEnum
CREATE TYPE "DisputeSubjectType" AS ENUM ('booking', 'service_order', 'statement');

-- CreateTable
CREATE TABLE "dispute" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "subject_type" "DisputeSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "resolution_amount_thb" INTEGER,
    "refund_id" TEXT,
    "ledger_entry_id" TEXT,
    "decided_by_identity_id" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispute_ticket_id_key" ON "dispute"("ticket_id");

-- CreateIndex
CREATE INDEX "dispute_subject_type_subject_id_idx" ON "dispute"("subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_decided_by_identity_id_fkey" FOREIGN KEY ("decided_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
