-- Editorial homepage placement layer.
-- This table controls only ordering/visibility. It must never carry price,
-- availability, readiness or operating-authority facts.

CREATE TABLE "homepage_placement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "destination_key" TEXT NOT NULL,
    "locale" TEXT,
    "section_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "query" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible_from" TIMESTAMP(3),
    "visible_until" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "editorial_reason" TEXT,

    CONSTRAINT "homepage_placement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homepage_placement_destination_key_section_key_status_position_idx"
ON "homepage_placement"("destination_key", "section_key", "status", "position");

CREATE INDEX "homepage_placement_entity_type_entity_id_idx"
ON "homepage_placement"("entity_type", "entity_id");

ALTER TABLE "homepage_placement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "homepage_placement" FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE "homepage_placement" IS
  'Server-only editorial ordering/visibility for canonical homepage entities; never duplicates price, availability, readiness or authority.';
