-- Expand the existing canonical OperationalTask for multi-team PMS operations.
-- No second task engine is introduced.

ALTER TABLE "operational_task"
  ADD COLUMN "operating_space_id" TEXT,
  ADD COLUMN "assigned_team_id" TEXT,
  ADD COLUMN "preventive_maintenance_plan_id" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN "estimated_cost_satang" INTEGER,
  ADD COLUMN "actual_cost_satang" INTEGER,
  ADD COLUMN "blocks_inventory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE TABLE "operational_task_media" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operational_task_id" TEXT NOT NULL,
  "media_asset_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "operational_task_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "preventive_maintenance_plan" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "operating_space_id" TEXT NOT NULL,
  "project_id" TEXT,
  "unit_id" TEXT,
  "assigned_team_id" TEXT,
  "assigned_identity_id" TEXT,
  "task_type" "OperationalTaskType" NOT NULL DEFAULT 'preventive_maintenance',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "frequency_days" INTEGER NOT NULL,
  "next_due_at" TIMESTAMP(3) NOT NULL,
  "last_generated_at" TIMESTAMP(3),
  "estimated_cost_satang" INTEGER,
  "blocks_inventory" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "preventive_maintenance_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_task_operating_space_id_status_due_at_idx"
  ON "operational_task"("operating_space_id","status","due_at");
CREATE INDEX "operational_task_assigned_team_id_status_due_at_idx"
  ON "operational_task"("assigned_team_id","status","due_at");
CREATE INDEX "operational_task_preventive_maintenance_plan_id_due_at_idx"
  ON "operational_task"("preventive_maintenance_plan_id","due_at");

CREATE UNIQUE INDEX "operational_task_media_operational_task_id_media_asset_id_key"
  ON "operational_task_media"("operational_task_id","media_asset_id");
CREATE INDEX "operational_task_media_media_asset_id_idx"
  ON "operational_task_media"("media_asset_id");

CREATE INDEX "preventive_maintenance_plan_operating_space_id_active_next_due_"
  ON "preventive_maintenance_plan"("operating_space_id","active","next_due_at");
CREATE INDEX "preventive_maintenance_plan_unit_id_active_next_due_at_idx"
  ON "preventive_maintenance_plan"("unit_id","active","next_due_at");

ALTER TABLE "operational_task"
  ADD CONSTRAINT "operational_task_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_task"
  ADD CONSTRAINT "operational_task_assigned_team_id_fkey"
  FOREIGN KEY ("assigned_team_id") REFERENCES "operating_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_task"
  ADD CONSTRAINT "operational_task_preventive_maintenance_plan_id_fkey"
  FOREIGN KEY ("preventive_maintenance_plan_id") REFERENCES "preventive_maintenance_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_task_media"
  ADD CONSTRAINT "operational_task_media_operational_task_id_fkey"
  FOREIGN KEY ("operational_task_id") REFERENCES "operational_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_task_media"
  ADD CONSTRAINT "operational_task_media_media_asset_id_fkey"
  FOREIGN KEY ("media_asset_id") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_operating_space_id_fkey"
  FOREIGN KEY ("operating_space_id") REFERENCES "operating_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_assigned_team_id_fkey"
  FOREIGN KEY ("assigned_team_id") REFERENCES "operating_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_assigned_identity_id_fkey"
  FOREIGN KEY ("assigned_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "preventive_maintenance_plan"
  ADD CONSTRAINT "preventive_maintenance_plan_frequency_chk" CHECK ("frequency_days" > 0);
ALTER TABLE "operational_task"
  ADD CONSTRAINT "operational_task_cost_chk"
  CHECK (
    ("estimated_cost_satang" IS NULL OR "estimated_cost_satang" >= 0)
    AND ("actual_cost_satang" IS NULL OR "actual_cost_satang" >= 0)
  );


-- New operational support tables are server-only; existing operational_task
-- RLS remains unchanged and continues to protect canonical task records.
ALTER TABLE "operational_task_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preventive_maintenance_plan" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "operational_task_media" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "preventive_maintenance_plan" FROM PUBLIC, anon, authenticated;
