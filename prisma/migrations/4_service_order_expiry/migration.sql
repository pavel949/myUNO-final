-- S5: Add expiry tracking to service orders
ALTER TABLE "service_order" ADD COLUMN "expired_at" TIMESTAMP(3);
