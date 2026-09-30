-- Flexible project-level amenities / facilities.
-- myUNO Marketplace remains global; this table describes what exists INSIDE
-- a specific project (gym, sauna, cinema, shuttle, coworking, etc.).

CREATE TABLE IF NOT EXISTS "project_amenity" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "project_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category_key" TEXT,
  "short_description" TEXT,
  "description" TEXT,
  "icon_key" TEXT,
  "location_label" TEXT,
  "cover_media_id" TEXT,
  "access_type" TEXT NOT NULL DEFAULT 'open',
  "access_instructions" TEXT,
  "booking_required" BOOLEAN NOT NULL DEFAULT false,
  "booking_mode" TEXT NOT NULL DEFAULT 'none',
  "booking_url" TEXT,
  "pricing_type" TEXT NOT NULL DEFAULT 'included',
  "price_thb" INTEGER,
  "capacity" INTEGER,
  "min_age" INTEGER,
  "opening_hours" JSONB,
  "rules" JSONB,
  "terms" TEXT,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_amenity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_amenity_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_cover_media_id_fkey"
    FOREIGN KEY ("cover_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_price_nonnegative" CHECK ("price_thb" IS NULL OR "price_thb" >= 0),
  CONSTRAINT "project_amenity_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0),
  CONSTRAINT "project_amenity_min_age_nonnegative" CHECK ("min_age" IS NULL OR "min_age" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_amenity_project_id_slug_key"
  ON "project_amenity"("project_id", "slug");
CREATE INDEX IF NOT EXISTS "project_amenity_project_id_published_sort_idx"
  ON "project_amenity"("project_id", "published", "sort");
CREATE INDEX IF NOT EXISTS "project_amenity_project_id_category_key_idx"
  ON "project_amenity"("project_id", "category_key");

CREATE TABLE IF NOT EXISTS "project_amenity_media" (
  "amenity_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_amenity_media_pkey" PRIMARY KEY ("amenity_id", "media_id"),
  CONSTRAINT "project_amenity_media_amenity_id_fkey"
    FOREIGN KEY ("amenity_id") REFERENCES "project_amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_media_media_id_fkey"
    FOREIGN KEY ("media_id") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_amenity_media_amenity_id_sort_idx"
  ON "project_amenity_media"("amenity_id", "sort");
