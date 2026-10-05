-- Canonical Project Portal locality layer.
-- Additive only: nearby places are descriptive Project facts, never inventory,
-- pricing, availability, service supply or operating authority.

CREATE TABLE "project_nearby_place" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_key" TEXT NOT NULL DEFAULT 'other',
    "short_description" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "distance_meters" INTEGER,
    "walking_minutes" INTEGER,
    "driving_minutes" INTEGER,
    "external_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_nearby_place_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_nearby_place_project_id_slug_key"
ON "project_nearby_place"("project_id", "slug");

CREATE INDEX "project_nearby_place_project_id_published_sort_idx"
ON "project_nearby_place"("project_id", "published", "sort");

ALTER TABLE "project_nearby_place"
ADD CONSTRAINT "project_nearby_place_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
