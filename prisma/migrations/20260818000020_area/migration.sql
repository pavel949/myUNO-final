-- An area: a place inventory is described by, for browse and for reporting.
--
-- Until now a location was `project.area_label_key` — a content key, i.e. a
-- display string. Nothing could be asked *about* an area: no area page, no
-- occupancy compared across a region, no "near here". Three key shapes for the
-- one concept already existed, because nothing constrained the vocabulary.
--
-- The parent link makes depth data rather than schema: island -> coast -> beach,
-- or a flat list, without another migration either way.

DO $$ BEGIN
  CREATE TYPE "AreaStatus" AS ENUM ('draft', 'live');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "area" (
  "id"              TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "slug"            TEXT NOT NULL,
  "name_key"        TEXT NOT NULL,
  "description_key" TEXT,
  "parent_id"       TEXT,
  "status"          "AreaStatus" NOT NULL DEFAULT 'draft',
  "sort"            INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "area_slug_key" ON "area"("slug");
CREATE INDEX IF NOT EXISTS "area_parent_id_idx" ON "area"("parent_id");
CREATE INDEX IF NOT EXISTS "area_status_idx" ON "area"("status");

-- SetNull, never cascade: an area is a way of describing where a project is,
-- not its owner. Deleting "Bang Tao" must not delete the villas in Bang Tao.
DO $$ BEGIN
  ALTER TABLE "area"
    ADD CONSTRAINT "area_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- An area cannot be its own parent. This catches the one-step cycle in the
-- database; longer cycles (A -> B -> A) are refused by the service, which walks
-- the ancestry on write. Postgres cannot express that as a CHECK.
DO $$ BEGIN
  ALTER TABLE "area"
    ADD CONSTRAINT "area_is_not_its_own_parent" CHECK ("parent_id" IS DISTINCT FROM "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "area_id" TEXT;

CREATE INDEX IF NOT EXISTS "project_area_id_idx" ON "project"("area_id");

DO $$ BEGIN
  ALTER TABLE "project"
    ADD CONSTRAINT "project_area_id_fkey"
    FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- No backfill. Existing projects keep `area_label_key` and get no area until an
-- admin assigns one: an area's slug is a public URL and its name is founder
-- copy, and deriving either from an i18n key would produce a page addressed
-- `/areas/project-ignatev-location`. `resolveAreaLabelKey` prefers the area
-- when set and falls back to the project's own label, so nothing breaks in the
-- meantime and the column stays droppable once every project is assigned.
