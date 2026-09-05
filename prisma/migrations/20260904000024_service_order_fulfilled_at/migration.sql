-- N-27: timestamp when provider marked order fulfilled (scheduled review prompt anchor)
ALTER TABLE "service_order" ADD COLUMN IF NOT EXISTS "fulfilled_at" TIMESTAMP(3);
