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
  "reservation_config" JSONB,
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


CREATE TABLE IF NOT EXISTS "project_amenity_reservation" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "amenity_id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "unit_id" TEXT,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "party_size" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'guest',
  CONSTRAINT "project_amenity_reservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_amenity_reservation_amenity_id_fkey"
    FOREIGN KEY ("amenity_id") REFERENCES "project_amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_reservation_identity_id_fkey"
    FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_reservation_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_reservation_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "project_amenity_reservation_time_valid" CHECK ("end_at" > "start_at"),
  CONSTRAINT "project_amenity_reservation_party_positive" CHECK ("party_size" > 0)
);

CREATE INDEX IF NOT EXISTS "project_amenity_reservation_amenity_status_time_idx"
  ON "project_amenity_reservation"("amenity_id", "status", "start_at", "end_at");
CREATE INDEX IF NOT EXISTS "project_amenity_reservation_identity_start_idx"
  ON "project_amenity_reservation"("identity_id", "start_at");
CREATE INDEX IF NOT EXISTS "project_amenity_reservation_booking_id_idx"
  ON "project_amenity_reservation"("booking_id");


-- New project-experience tables stay server-authorized like the rest of the
-- operational domain; do not expose them directly through Supabase Data API.
ALTER TABLE public.project_amenity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_amenity_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_amenity_reservation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_amenity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_amenity_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_amenity_reservation FROM PUBLIC, anon, authenticated;
