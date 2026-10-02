-- P2 product layer: governed research publication + first-class video publication.
-- Research corrections are append-only; publication cannot be marked reviewed/published
-- by its own author. Source-count publication gates live in the canonical service.

DO $$ BEGIN
  CREATE TYPE "ResearchPublicationStatus" AS ENUM ('draft','in_review','reviewed','published','retracted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VideoPublicationStatus" AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'video';

CREATE TABLE IF NOT EXISTS "research_publication" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "destination_key" TEXT NOT NULL DEFAULT 'phuket',
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "ResearchPublicationStatus" NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "scheduled_for" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "retracted_at" TIMESTAMP(3),
  "author_identity_id" TEXT NOT NULL,
  "reviewer_identity_id" TEXT,
  CONSTRAINT "research_publication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_publication_author_fkey" FOREIGN KEY ("author_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_publication_reviewer_fkey" FOREIGN KEY ("reviewer_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_independent_review" CHECK ("reviewer_identity_id" IS NULL OR "reviewer_identity_id" <> "author_identity_id"),
  CONSTRAINT "research_published_requires_review" CHECK ("status" <> 'published' OR ("reviewer_identity_id" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "published_at" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "research_publication_destination_slug_locale_key"
  ON "research_publication"("destination_key","slug","locale");
CREATE INDEX IF NOT EXISTS "research_publication_destination_status_published_idx"
  ON "research_publication"("destination_key","status","published_at");
CREATE INDEX IF NOT EXISTS "research_publication_author_idx"
  ON "research_publication"("author_identity_id");
CREATE INDEX IF NOT EXISTS "research_publication_reviewer_idx"
  ON "research_publication"("reviewer_identity_id");

CREATE TABLE IF NOT EXISTS "research_source" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publication_id" TEXT NOT NULL,
  "source_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "publisher" TEXT,
  "url" TEXT NOT NULL,
  "published_on" DATE,
  "accessed_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "research_source_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_source_publication_fkey" FOREIGN KEY ("publication_id") REFERENCES "research_publication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "research_source_number_positive" CHECK ("source_number" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "research_source_publication_number_key"
  ON "research_source"("publication_id","source_number");
CREATE INDEX IF NOT EXISTS "research_source_publication_idx"
  ON "research_source"("publication_id");

CREATE TABLE IF NOT EXISTS "research_correction" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publication_id" TEXT NOT NULL,
  "created_by_identity_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "public_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_correction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_correction_publication_fkey" FOREIGN KEY ("publication_id") REFERENCES "research_publication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "research_correction_creator_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "research_correction_publication_public_idx"
  ON "research_correction"("publication_id","public_at");
CREATE INDEX IF NOT EXISTS "research_correction_creator_idx"
  ON "research_correction"("created_by_identity_id");

CREATE TABLE IF NOT EXISTS "video_publication" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "destination_key" TEXT NOT NULL DEFAULT 'phuket',
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "media_asset_id" TEXT NOT NULL,
  "created_by_identity_id" TEXT NOT NULL,
  "status" "VideoPublicationStatus" NOT NULL DEFAULT 'draft',
  "recorded_on" DATE,
  "provenance" TEXT,
  "scope_type" TEXT,
  "scope_id" TEXT,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "video_publication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "video_publication_media_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "video_publication_creator_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "video_published_requires_timestamp" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL),
  CONSTRAINT "video_scope_pair" CHECK (("scope_type" IS NULL AND "scope_id" IS NULL) OR ("scope_type" IS NOT NULL AND "scope_id" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_publication_destination_slug_locale_key"
  ON "video_publication"("destination_key","slug","locale");
CREATE INDEX IF NOT EXISTS "video_publication_destination_status_published_idx"
  ON "video_publication"("destination_key","status","published_at");
CREATE INDEX IF NOT EXISTS "video_publication_media_idx"
  ON "video_publication"("media_asset_id");
CREATE INDEX IF NOT EXISTS "video_publication_scope_idx"
  ON "video_publication"("scope_type","scope_id");

CREATE OR REPLACE FUNCTION prevent_research_correction_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'research corrections are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_correction_immutable ON "research_correction";
CREATE TRIGGER research_correction_immutable
BEFORE UPDATE OR DELETE ON "research_correction"
FOR EACH ROW EXECUTE FUNCTION prevent_research_correction_mutation();
