-- Additive only. Existing money and booking records remain unchanged.
ALTER TYPE "LedgerEntryType" ADD VALUE 'payment_unallocated';
ALTER TABLE "payment" ADD COLUMN "reconciliation_reason" TEXT;
