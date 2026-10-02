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
  CONSTRAINT "research_publication_author_identity_id_fkey" FOREIGN KEY ("author_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_publication_reviewer_identity_id_fkey" FOREIGN KEY ("reviewer_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_independent_review" CHECK ("reviewer_identity_id" IS NULL OR "reviewer_identity_id" <> "author_identity_id"),
  CONSTRAINT "research_published_requires_review" CHECK ("status" <> 'published' OR ("reviewer_identity_id" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "published_at" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "research_publication_destination_key_slug_locale_key"
  ON "research_publication"("destination_key","slug","locale");
CREATE INDEX IF NOT EXISTS "research_publication_destination_key_status_published_at_idx"
  ON "research_publication"("destination_key","status","published_at");
CREATE INDEX IF NOT EXISTS "research_publication_author_identity_id_idx"
  ON "research_publication"("author_identity_id");
CREATE INDEX IF NOT EXISTS "research_publication_reviewer_identity_id_idx"
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
  CONSTRAINT "research_source_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "research_publication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "research_source_number_positive" CHECK ("source_number" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "research_source_publication_id_source_number_key"
  ON "research_source"("publication_id","source_number");
CREATE INDEX IF NOT EXISTS "research_source_publication_id_idx"
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
  CONSTRAINT "research_correction_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "research_publication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "research_correction_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "research_correction_publication_id_public_at_idx"
  ON "research_correction"("publication_id","public_at");
CREATE INDEX IF NOT EXISTS "research_correction_created_by_identity_id_idx"
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
  CONSTRAINT "video_publication_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "video_publication_created_by_identity_id_fkey" FOREIGN KEY ("created_by_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "video_published_requires_timestamp" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL),
  CONSTRAINT "video_scope_pair" CHECK (("scope_type" IS NULL AND "scope_id" IS NULL) OR ("scope_type" IS NOT NULL AND "scope_id" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_publication_destination_key_slug_locale_key"
  ON "video_publication"("destination_key","slug","locale");
CREATE INDEX IF NOT EXISTS "video_publication_destination_key_status_published_at_idx"
  ON "video_publication"("destination_key","status","published_at");
CREATE INDEX IF NOT EXISTS "video_publication_media_asset_id_idx"
  ON "video_publication"("media_asset_id");
CREATE INDEX IF NOT EXISTS "video_publication_scope_type_scope_id_idx"
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


CREATE OR REPLACE FUNCTION guard_research_publication_governance()
RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'draft' AND (
    NEW.destination_key IS DISTINCT FROM OLD.destination_key OR
    NEW.slug IS DISTINCT FROM OLD.slug OR
    NEW.locale IS DISTINCT FROM OLD.locale OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.summary IS DISTINCT FROM OLD.summary OR
    NEW.body IS DISTINCT FROM OLD.body OR
    NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR
    NEW.author_identity_id IS DISTINCT FROM OLD.author_identity_id
  ) THEN
    RAISE EXCEPTION 'research content is frozen once review begins';
  END IF;

  IF NEW.status IN ('reviewed','published') AND
     NOT EXISTS (SELECT 1 FROM research_source WHERE publication_id = NEW.id) THEN
    RAISE EXCEPTION 'reviewed research requires at least one numbered source';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_publication_governance ON "research_publication";
CREATE TRIGGER research_publication_governance
BEFORE UPDATE ON "research_publication"
FOR EACH ROW EXECUTE FUNCTION guard_research_publication_governance();

CREATE OR REPLACE FUNCTION guard_research_source_mutation()
RETURNS trigger AS $$
DECLARE publication_status "ResearchPublicationStatus";
DECLARE target_publication_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_publication_id := OLD.publication_id;
  ELSE
    target_publication_id := NEW.publication_id;
  END IF;
  SELECT status INTO publication_status FROM research_publication WHERE id = target_publication_id;
  IF publication_status IS DISTINCT FROM 'draft'::"ResearchPublicationStatus" THEN
    RAISE EXCEPTION 'research sources are frozen once review begins';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_source_frozen ON "research_source";
CREATE TRIGGER research_source_frozen
BEFORE INSERT OR UPDATE OR DELETE ON "research_source"
FOR EACH ROW EXECUTE FUNCTION guard_research_source_mutation();

ALTER TABLE "video_publication"
  DROP CONSTRAINT IF EXISTS "video_published_requires_provenance";
ALTER TABLE "video_publication"
  ADD CONSTRAINT "video_published_requires_provenance"
  CHECK ("status" <> 'published' OR length(trim(COALESCE("provenance", ''))) > 0);
