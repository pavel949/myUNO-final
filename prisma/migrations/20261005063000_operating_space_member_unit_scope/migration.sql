-- Exact unit authorization provenance for overlapping OperatingSpaces.
-- Additive only: canonical Unit/Booking/RoleAssignment remain unchanged.

CREATE TABLE "operating_space_member_unit" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "operating_space_id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "operating_space_member_unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operating_space_member_unit_space_identity_unit_key"
  ON "operating_space_member_unit"("operating_space_id","identity_id","unit_id");
CREATE INDEX "operating_space_member_unit_identity_unit_active_idx"
  ON "operating_space_member_unit"("identity_id","unit_id","active");
CREATE INDEX "operating_space_member_unit_space_active_idx"
  ON "operating_space_member_unit"("operating_space_id","active");

ALTER TABLE "operating_space_member_unit"
  ADD CONSTRAINT "operating_space_member_unit_member_fkey"
  FOREIGN KEY ("operating_space_id","identity_id")
  REFERENCES "operating_space_member"("operating_space_id","identity_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operating_space_member_unit"
  ADD CONSTRAINT "operating_space_member_unit_unit_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill current staff scopes so this migration is non-breaking.
-- Exact-unit grants map one-for-one.
INSERT INTO "operating_space_member_unit"
  ("id","created_at","updated_at","operating_space_id","identity_id","unit_id","active")
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  osm."operating_space_id", osm."identity_id", osu."unit_id", true
FROM "operating_space_member" osm
JOIN "operating_space_unit" osu
  ON osu."operating_space_id"=osm."operating_space_id" AND osu."active"=true
JOIN "role_assignment" ra
  ON ra."identity_id"=osm."identity_id"
 AND ra."unit_id"=osu."unit_id"
 AND ra."status"='active'
 AND ra."role" IN ('staff_ops','onsite_host')
WHERE osm."active"=true
ON CONFLICT ("operating_space_id","identity_id","unit_id") DO NOTHING;

-- Existing project-scoped operators keep the same access inside each space.
INSERT INTO "operating_space_member_unit"
  ("id","created_at","updated_at","operating_space_id","identity_id","unit_id","active")
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  osm."operating_space_id", osm."identity_id", osu."unit_id", true
FROM "operating_space_member" osm
JOIN "operating_space_unit" osu
  ON osu."operating_space_id"=osm."operating_space_id" AND osu."active"=true
JOIN "unit" u ON u."id"=osu."unit_id"
JOIN "role_assignment" ra
  ON ra."identity_id"=osm."identity_id"
 AND ra."project_id"=u."project_id"
 AND ra."unit_id" IS NULL
 AND ra."status"='active'
 AND ra."role" IN ('staff_ops','onsite_host')
WHERE osm."active"=true
ON CONFLICT ("operating_space_id","identity_id","unit_id") DO NOTHING;

ALTER TABLE "operating_space_member_unit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "operating_space_member_unit" FROM PUBLIC, anon, authenticated;
