-- Shared rate-limit counters (replaces per-instance memory on serverless). Additive: one new
-- table. Created, locked down and revoked in this file so it is never open.
CREATE TABLE "rate_limit_bucket" (
  "key" VARCHAR(200) NOT NULL,
  "attempts" INTEGER NOT NULL,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "backoff_multiplier" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_bucket_reset_at_idx" ON "rate_limit_bucket"("reset_at");

ALTER TABLE "rate_limit_bucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "rate_limit_bucket" FROM PUBLIC, anon, authenticated;
