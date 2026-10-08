-- Provider creation is claimed by an existing Payment row before network I/O.
-- Historical sessions remain intact and require reconciliation if no URL exists.
ALTER TABLE "payment" ADD COLUMN "checkout_url_encrypted" TEXT;
ALTER TABLE "payment" ADD COLUMN "checkout_expires_at" TIMESTAMP(3);
