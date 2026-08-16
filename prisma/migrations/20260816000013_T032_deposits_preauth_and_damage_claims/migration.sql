-- T-032 · Deposits (pre-auth) & damage claims
--
-- Add support for pre-authorized deposits and damage claim lifecycle:
-- 1. DepositPreauth table tracks the pre-auth lifecycle (authorized → voided → captured)
-- 2. DepositPreauthStatus enum for status tracking
-- 3. Link DepositPreauth to Booking (one-to-one) and to DepositClaim (for capture reference)

-- CreateEnum
CREATE TYPE "DepositPreauthStatus" AS ENUM ('authorized', 'voided', 'captured');

-- CreateTable
CREATE TABLE "deposit_preauth" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount_thb" INTEGER NOT NULL,
    "provider_session_id" TEXT,
    "status" "DepositPreauthStatus" NOT NULL DEFAULT 'authorized',
    "authorized_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "capture_via_claim_id" TEXT,

    CONSTRAINT "deposit_preauth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_preauth_booking_id_key" ON "deposit_preauth"("booking_id");
CREATE UNIQUE INDEX "deposit_preauth_capture_via_claim_id_key" ON "deposit_preauth"("capture_via_claim_id");
CREATE INDEX "deposit_preauth_status_authorized_at_idx" ON "deposit_preauth"("status", "authorized_at");

-- AddForeignKey
ALTER TABLE "deposit_preauth" ADD CONSTRAINT "deposit_preauth_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposit_preauth" ADD CONSTRAINT "deposit_preauth_capture_via_claim_id_fkey" FOREIGN KEY ("capture_via_claim_id") REFERENCES "deposit_claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
