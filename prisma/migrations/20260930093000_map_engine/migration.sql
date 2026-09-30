ALTER TABLE "project"
  ADD COLUMN "map_visibility" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "google_place_id" TEXT;

ALTER TABLE "provider"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "latitude" DECIMAL(9,6),
  ADD COLUMN "longitude" DECIMAL(9,6),
  ADD COLUMN "map_visibility" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "google_place_id" TEXT;

CREATE INDEX "provider_map_visibility_status_idx"
  ON "provider" ("map_visibility", "status");

CREATE INDEX "project_map_visibility_status_idx"
  ON "project" ("map_visibility", "status");
