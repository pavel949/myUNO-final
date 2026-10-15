-- Additive pointer only. No inferred data backfill and no content rewrite.
-- Null preserves the legacy description-derived marketing title key.
ALTER TABLE "unit" ADD COLUMN "marketing_title_key" TEXT;
