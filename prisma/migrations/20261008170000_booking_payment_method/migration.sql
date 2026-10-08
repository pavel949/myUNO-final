-- Additive only: legacy reservations retain their existing expiry and null rail.
-- No live reservation or financial record is rewritten by this migration.
ALTER TABLE "booking" ADD COLUMN "payment_method" "PaymentMethod";
