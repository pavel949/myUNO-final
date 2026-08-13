-- Unit categories (sellable classes like "Superior 2BR"): units may carry a
-- category key validated against the project's catalog.unit_categories config.
ALTER TABLE "unit" ADD COLUMN "category_key" TEXT;

CREATE INDEX "unit_project_id_category_key_idx" ON "unit"("project_id", "category_key");
