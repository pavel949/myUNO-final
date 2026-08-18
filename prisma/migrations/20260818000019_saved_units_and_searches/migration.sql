-- Saving a villa, and saving a search.
--
-- A prospect who browses and leaves has nothing to come back to: no way to keep
-- a villa they liked, and no way to be told when one matching what they wanted
-- appears. For a business whose first channel is a relationship rather than a
-- search engine, that is the difference between a conversation continuing and a
-- visit ending.
--
-- Scope note: the *storage and rules* are here. What a saved search does when it
-- matches — mail immediately, digest daily, say nothing until they return — is a
-- product decision and is logged as Q38 rather than guessed.

CREATE TABLE "saved_unit" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identity_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    -- Free-text collection ("Songkran with the family"). Null = the default list.
    "collection" TEXT,
    "note" TEXT,

    CONSTRAINT "saved_unit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "saved_unit"
    ADD CONSTRAINT "saved_unit_identity_id_fkey"
    FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_unit"
    ADD CONSTRAINT "saved_unit_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One save per villa per list. Saving twice is the same intent expressed twice,
-- not two saves, and a duplicate would show the villa twice in their list.
-- COALESCE because NULL never equals NULL, so the default list needs a sentinel
-- or every save into it would be treated as distinct.
CREATE UNIQUE INDEX "saved_unit_identity_unit_collection_key"
    ON "saved_unit" ("identity_id", "unit_id", COALESCE("collection", ''));

CREATE INDEX "saved_unit_identity_id_idx" ON "saved_unit" ("identity_id");
CREATE INDEX "saved_unit_unit_id_idx" ON "saved_unit" ("unit_id");

CREATE TABLE "saved_search" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identity_id" TEXT NOT NULL,
    "name" TEXT,
    -- The filter set, stored as the criteria rather than a query string: a URL
    -- shape is a presentation detail and would tie stored data to the router.
    "criteria" JSONB NOT NULL,
    -- Whether the saver wants to hear about matches at all. The *how* is Q38.
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_alerted_at" TIMESTAMP(3),

    CONSTRAINT "saved_search_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "saved_search"
    ADD CONSTRAINT "saved_search_identity_id_fkey"
    FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "saved_search_identity_id_idx" ON "saved_search" ("identity_id");
CREATE INDEX "saved_search_alerts_enabled_idx" ON "saved_search" ("alerts_enabled");
