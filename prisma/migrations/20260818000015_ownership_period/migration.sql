-- OwnershipPeriod — who held title to a unit, and when.
--
-- Unit.owner_identity_id is a single scalar, so changing an owner erased the
-- previous one. An owner statement earned last year could not prove who owned
-- the unit when it was earned, which contradicts the promise that financial
-- history is immutable.
--
-- The scalar stays, as the denormalised "who owns it right now" that ninety
-- call sites already read. This table is the record of fact behind it, and the
-- two are written together in one transaction.

CREATE TABLE "ownership_period" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_id" TEXT NOT NULL,
    "owner_identity_id" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "note" TEXT,
    "recorded_by_identity_id" TEXT,

    CONSTRAINT "ownership_period_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ownership_period"
    ADD CONSTRAINT "ownership_period_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_period"
    ADD CONSTRAINT "ownership_period_owner_identity_id_fkey"
    FOREIGN KEY ("owner_identity_id") REFERENCES "identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ownership_period"
    ADD CONSTRAINT "ownership_period_recorded_by_identity_id_fkey"
    FOREIGN KEY ("recorded_by_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ownership_period_unit_id_starts_on_idx" ON "ownership_period"("unit_id", "starts_on");
CREATE INDEX "ownership_period_owner_identity_id_idx" ON "ownership_period"("owner_identity_id");

-- A period must end on or after it starts. An open period (ends_on NULL) is the
-- current owner.
ALTER TABLE "ownership_period"
    ADD CONSTRAINT "ownership_period_dates_ordered"
    CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

-- One unit cannot have two owners on the same day. Enforced in the database
-- rather than in the service, for the same reason booking_no_overlap is: two
-- concurrent title transfers would otherwise both commit and leave the unit
-- with two owners of record. An open period runs to infinity.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ownership_period"
    ADD CONSTRAINT "ownership_period_no_overlap"
    EXCLUDE USING gist (
        "unit_id" WITH =,
        daterange("starts_on", COALESCE("ends_on", 'infinity'::date), '[)') WITH &&
    );

-- Backfill: every unit that already has an owner gets an open period starting
-- the day the unit record was created. That date is the best evidence the
-- system holds — no earlier ownership was ever recorded — and it is stated here
-- rather than guessed at read time.
INSERT INTO "ownership_period" ("id", "unit_id", "owner_identity_id", "starts_on", "note")
SELECT
    gen_random_uuid()::text,
    u."id",
    u."owner_identity_id",
    u."created_at"::date,
    'Backfilled from unit.owner_identity_id; no earlier ownership was recorded.'
FROM "unit" u
WHERE u."owner_identity_id" IS NOT NULL;
