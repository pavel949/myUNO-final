-- Operating Space foundation: additive operational scoping only.
-- Does not change canonical Unit/Booking/BlockedDate/RatePlan authority.

CREATE TABLE "operating_space" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "status" TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT "operating_space_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operating_space_unit" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "operating_space_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "starts_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_on" TIMESTAMP(3),
  CONSTRAINT "operating_space_unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operating_space_member" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "operating_space_id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "operating_space_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operating_team" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "operating_space_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "team_type" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "operating_team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operating_team_member" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operating_team_id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "operating_team_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operating_space_key_key" ON "operating_space"("key");
CREATE INDEX "operating_space_organization_id_status_idx" ON "operating_space"("organization_id","status");
CREATE UNIQUE INDEX "operating_space_unit_operating_space_id_unit_id_key" ON "operating_space_unit"("operating_space_id","unit_id");
CREATE INDEX "operating_space_unit_unit_id_active_idx" ON "operating_space_unit"("unit_id","active");
CREATE UNIQUE INDEX "operating_space_member_operating_space_id_identity_id_key" ON "operating_space_member"("operating_space_id","identity_id");
CREATE INDEX "operating_space_member_identity_id_active_idx" ON "operating_space_member"("identity_id","active");
CREATE UNIQUE INDEX "operating_team_operating_space_id_name_key" ON "operating_team"("operating_space_id","name");
CREATE INDEX "operating_team_operating_space_id_team_type_active_idx" ON "operating_team"("operating_space_id","team_type","active");
CREATE UNIQUE INDEX "operating_team_member_operating_team_id_identity_id_key" ON "operating_team_member"("operating_team_id","identity_id");
CREATE INDEX "operating_team_member_identity_id_active_idx" ON "operating_team_member"("identity_id","active");

ALTER TABLE "operating_space"
  ADD CONSTRAINT "operating_space_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operating_space_unit"
  ADD CONSTRAINT "operating_space_unit_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operating_space_unit"
  ADD CONSTRAINT "operating_space_unit_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operating_space_member"
  ADD CONSTRAINT "operating_space_member_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operating_space_member"
  ADD CONSTRAINT "operating_space_member_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operating_team"
  ADD CONSTRAINT "operating_team_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operating_team_member"
  ADD CONSTRAINT "operating_team_member_operating_team_id_fkey"
  FOREIGN KEY ("operating_team_id") REFERENCES "operating_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operating_team_member"
  ADD CONSTRAINT "operating_team_member_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
