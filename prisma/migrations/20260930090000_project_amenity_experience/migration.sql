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


-- One-time canonicalization of the two legacy Project string arrays. They are
-- retained in the schema for compatibility, but ProjectAmenity is the only
-- project-level amenity authority after this migration. Live projects keep
-- the same public visibility they had before this conversion.
WITH legacy AS (
  SELECT p.id AS project_id, raw_name, source_kind
  FROM public.project p
  CROSS JOIN LATERAL (
    SELECT key AS raw_name, 'amenity'::text AS source_kind
    FROM unnest(COALESCE(p.amenity_keys, ARRAY[]::text[])) AS key
    UNION ALL
    SELECT facility AS raw_name, 'facility'::text AS source_kind
    FROM unnest(COALESCE(p.facilities, ARRAY[]::text[])) AS facility
  ) source
  WHERE btrim(raw_name) <> ''
),
normalized AS (
  SELECT DISTINCT ON (
    project_id,
    regexp_replace(lower(btrim(raw_name)), '[^a-z0-9]+', '-', 'g')
  )
    project_id,
    raw_name,
    source_kind,
    regexp_replace(
      regexp_replace(lower(btrim(raw_name)), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) AS slug
  FROM legacy
  ORDER BY project_id,
    regexp_replace(lower(btrim(raw_name)), '[^a-z0-9]+', '-', 'g'),
    CASE source_kind WHEN 'amenity' THEN 0 ELSE 1 END
)
INSERT INTO public.project_amenity (
  id, created_at, updated_at, project_id, slug, name, category_key,
  access_type, booking_required, booking_mode, pricing_type,
  is_featured, published, sort
)
SELECT
  gen_random_uuid()::text,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  n.project_id,
  n.slug,
  initcap(replace(replace(n.raw_name, '_', ' '), '-', ' ')),
  n.source_kind,
  'open',
  false,
  'none',
  'included',
  false,
  (p.status::text = 'live'),
  row_number() OVER (PARTITION BY n.project_id ORDER BY n.source_kind, n.raw_name)::integer
FROM normalized n
JOIN public.project p ON p.id = n.project_id
WHERE n.slug <> ''
ON CONFLICT ("project_id", "slug") DO NOTHING;

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

CREATE INDEX IF NOT EXISTS "project_amenity_reservation_amenity_id_status_start_at_end__idx"
  ON "project_amenity_reservation"("amenity_id", "status", "start_at", "end_at");
CREATE INDEX IF NOT EXISTS "project_amenity_reservation_identity_id_start_at_idx"
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
