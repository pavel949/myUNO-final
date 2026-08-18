-- myUNO — apply the seven migrations Supabase is missing.
--
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- It does two things per migration: the schema change itself, and the row in
-- _prisma_migrations that tells Prisma it is applied. Both matter — applying
-- the schema without the bookkeeping would leave Prisma trying to re-run these
-- on the next deploy.
--
-- Run it ONCE. It is not idempotent: a second run stops at the first
-- already-existing constraint. That failure is harmless — everything is inside
-- one transaction, so an aborted second run rolls back and changes nothing —
-- but it will look alarming, and there is no need to run it twice.
--
-- Verified before shipping: applied to a database rebuilt to match this one's
-- exact state (the same 15 migrations, nothing after), after which
-- `prisma migrate status` reported "Database schema is up to date!" — which is
-- the real test, because it means Prisma accepts the checksums written below.

BEGIN;

-- ===========================================================
-- 20260818000014_booking_no_overlap_exclusion
-- ===========================================================
-- P0-1: make double-booking impossible in the database, not just in application code.
--
-- Before this migration `createBooking` read the calendar, found no conflict, and
-- then inserted — two concurrent requests could both pass the read and both insert,
-- selling the same unit twice. The guard was advisory only.
--
-- The blocking set is: confirmed, checked_in, and a live pending_payment hold.
-- A constraint predicate has to be immutable, so it cannot test `hold_expires_at >
-- now()`. Instead every hold-bearing status participates and expired holds are
-- moved to `expired` — by the expireHolds job and, inline, by createBooking itself.
-- `requested` never participates: a request is non-binding until approved.
--
-- Ranges are half-open '[)': a stay ending on the 5th does not collide with one
-- starting on the 5th, which is the same rule the application overlap test uses.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Existing overlaps would make the ADD CONSTRAINT fail. Report them loudly rather
-- than silently dropping data: an operator has to decide which booking survives.
DO $$
DECLARE
  overlap_count integer;
BEGIN
  SELECT count(*) INTO overlap_count
  FROM booking a
  JOIN booking b
    ON a.unit_id = b.unit_id
   AND a.id < b.id
   AND a.status IN ('confirmed', 'checked_in', 'pending_payment')
   AND b.status IN ('confirmed', 'checked_in', 'pending_payment')
   AND daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)');

  IF overlap_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add booking_no_overlap: % overlapping booking pair(s) already exist. Resolve them first (see docs/architecture/PHASE1_IMPLEMENTATION_PLAN.md, P0-1).',
      overlap_count;
  END IF;
END $$;

-- A stay cannot end before it begins. Nothing enforced this before, and
-- daterange() rejects an inverted range anyway — without this the exclusion
-- constraint below would surface the bad row as a confusing 22000 at insert
-- time instead of naming the real problem.
ALTER TABLE booking
  ADD CONSTRAINT booking_dates_ordered CHECK (end_date > start_date);

ALTER TABLE booking
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (status IN ('confirmed', 'checked_in', 'pending_payment'));

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'b62121fa53fe090b85de4b976f90d59b2720fd6fb7ed018fe676da079bf1bb3d', now(), '20260818000014_booking_no_overlap_exclusion', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000014_booking_no_overlap_exclusion'
);

-- ===========================================================
-- 20260818000015_ownership_period
-- ===========================================================
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

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '7aca830b2967f9e4fe184f225eb827fdd88ce1c1093cf207ae53a629a9cc3d3c', now(), '20260818000015_ownership_period', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000015_ownership_period'
);

-- ===========================================================
-- 20260818000016_immutable_financial_records
-- ===========================================================
-- Financial snapshots and the audit log become immutable (P1-1, P1-3).
--
-- CLAUDE.md promises owners that fee history is immutable and that every role
-- grant, config change and PII access is auditable. Neither promise was
-- enforced: `price_breakdown` and `cancellation_policy_snapshot` were ordinary
-- updatable JSON, and `audit_log` had no trigger or revoke anywhere in the
-- schema — any code path could rewrite or delete an entry.
--
-- Nothing in the application does either today. That is exactly when to add the
-- constraint: it costs nothing now and it is the difference between a promise
-- and a guarantee when someone disputes a statement in a year.
--
-- Scope note, stated rather than implied: these are ordinary triggers, so a
-- superuser session that sets `session_replication_role = 'replica'` bypasses
-- them — which is how the test suite truncates between cases. They stop the
-- application from mutating these records; they are not a defence against
-- someone holding the database owner's credentials.

-- 1. A confirmed booking's economics cannot be rewritten -------------------
--
-- Once written, a snapshot is frozen. Setting one where none existed is still
-- allowed, so a booking created before this migration can be completed, and a
-- backfill remains possible.
--
-- `total_thb` is deliberately NOT frozen: an extension the guest agreed to
-- legitimately changes what they owe. What must not change is the record of the
-- terms the booking was sold under.

CREATE OR REPLACE FUNCTION booking_snapshot_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."price_breakdown" IS NOT NULL
       AND NEW."price_breakdown" IS DISTINCT FROM OLD."price_breakdown" THEN
        RAISE EXCEPTION
            'price_breakdown is immutable once set (booking %). The price a booking was sold at is a financial record, not a mutable field.',
            OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD."cancellation_policy_snapshot" IS NOT NULL
       AND NEW."cancellation_policy_snapshot" IS DISTINCT FROM OLD."cancellation_policy_snapshot" THEN
        RAISE EXCEPTION
            'cancellation_policy_snapshot is immutable once set (booking %). The guest agreed to these terms; a later config change cannot rewrite them.',
            OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_snapshot_immutable ON "booking";
CREATE TRIGGER booking_snapshot_immutable
    BEFORE UPDATE ON "booking"
    FOR EACH ROW
    EXECUTE FUNCTION booking_snapshot_is_immutable();

-- 2. The audit log is append-only ------------------------------------------
--
-- An audit trail that can be edited is not an audit trail. Corrections are made
-- by appending a further entry, which is the point: the original claim and the
-- correction both remain visible.

CREATE OR REPLACE FUNCTION audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only; % is not permitted. Record a correcting entry instead.',
        TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_append_only ON "audit_log";
CREATE TRIGGER audit_log_append_only
    BEFORE UPDATE OR DELETE ON "audit_log"
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_is_append_only();

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '4e61b66d99f320ee01e2674116b5f011e149ade4f26dd46a6b4b7c5166a416be', now(), '20260818000016_immutable_financial_records', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000016_immutable_financial_records'
);

-- ===========================================================
-- 20260818000017_booking_party_composition
-- ===========================================================
-- A booking's party is more than a headcount.
--
-- Bookings recorded `adults` and `children` only. A villa's house rules turn on
-- pets — whether they are allowed at all, what the cleaning costs, which units
-- can take them — and the model had no way to express the question, let alone
-- the answer. Infants matter for a different reason: they need a cot rather than
-- a bed, and counting them against capacity turns a family of four into a party
-- the villa refuses.
--
-- Occupancy stays adults + children, the convention every OTA uses. Infants and
-- pets are recorded, and counted against their own limits rather than the bed
-- count.

ALTER TABLE "booking"
    ADD COLUMN "infants" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "pets" INTEGER NOT NULL DEFAULT 0;

-- Negative people are not a thing, and a booking that claims them would corrupt
-- every occupancy figure downstream.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_party_non_negative"
    CHECK ("adults" >= 0 AND "children" >= 0 AND "infants" >= 0 AND "pets" >= 0);

-- Somebody has to be responsible for the stay.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_has_an_adult"
    CHECK ("adults" >= 1);

-- Whether a unit takes pets at all, and how many. Null means the unit has not
-- said — which is not the same as "no", and is left for the operator to answer
-- rather than guessed here.
ALTER TABLE "unit"
    ADD COLUMN "pets_allowed" BOOLEAN,
    ADD COLUMN "max_pets" INTEGER;

ALTER TABLE "unit"
    ADD CONSTRAINT "unit_max_pets_non_negative"
    CHECK ("max_pets" IS NULL OR "max_pets" >= 0);

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'd663d37f4de555483d1cc1557ee99ba2746afc38f6933ed1ac39f881bbf16784', now(), '20260818000017_booking_party_composition', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000017_booking_party_composition'
);

-- ===========================================================
-- 20260818000018_guest_reviews
-- ===========================================================
-- Reviews of a guest, after their stay.
--
-- Reviews ran one way: guests reviewed stays and service orders, and nobody
-- reviewed the guest. For a business letting private villas to a repeat
-- clientele that leaves the owner's first question unanswerable — "who stayed in
-- my villa, and were they any good" — and gives an operator no basis for
-- declining a returning guest who was a problem.
--
-- No new table. Review is already polymorphic (target_type + target_id) and
-- already carries rating, comment, a reply and a one-review-per-author
-- constraint. A guest review is that shape with a different target.
--
-- The target is the BOOKING, not the guest identity. Targeting the identity
-- would let the existing unique constraint record only one review per guest per
-- author for all time — so a guest who stayed four times could be reviewed once.
-- Per booking, a returning guest is reviewed each stay, and the reputation is
-- the set of them.

ALTER TYPE "ReviewTargetType" ADD VALUE IF NOT EXISTS 'guest';

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '712497234a520be7126c5528575d47a38c6b82e34aa98f761969fbdd281cd8f8', now(), '20260818000018_guest_reviews', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000018_guest_reviews'
);

-- ===========================================================
-- 20260818000019_saved_units_and_searches
-- ===========================================================
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

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'b555e10555d8bc710ddcf9e635e23278134ddb689228c4e0943112e3a3211274', now(), '20260818000019_saved_units_and_searches', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000019_saved_units_and_searches'
);

-- ===========================================================
-- 20260818000020_area
-- ===========================================================
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

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'ea591c6193c26586e88b6788900cfea785235dd6d3053d0f56fb51129a14c77a', now(), '20260818000020_area', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260818000020_area'
);

COMMIT;

-- Verify: expect 30 applied, 0 unfinished, and three t's.
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) AS applied,
       count(*) FILTER (WHERE finished_at IS NULL)     AS unfinished
FROM "_prisma_migrations";

SELECT to_regclass('public.area')             IS NOT NULL AS area,
       to_regclass('public.ownership_period') IS NOT NULL AS ownership_period,
       to_regclass('public.saved_unit')       IS NOT NULL AS saved_unit;
