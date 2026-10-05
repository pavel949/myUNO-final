CREATE TYPE "OperationalTaskType" AS ENUM ('turnover_cleaning', 'turnover_inspection', 'maintenance_followup');
CREATE TYPE "OperationalTaskStatus" AS ENUM ('planned', 'assigned', 'in_progress', 'inspected', 'ready', 'cancelled');

CREATE TABLE "operational_task" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "project_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "task_type" "OperationalTaskType" NOT NULL,
  "status" "OperationalTaskStatus" NOT NULL DEFAULT 'planned',
  "due_at" TIMESTAMP(3) NOT NULL,
  "assigned_identity_id" TEXT,
  "started_at" TIMESTAMP(3),
  "inspected_at" TIMESTAMP(3),
  "ready_at" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "operational_task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_task_booking_id_task_type_key" ON "operational_task"("booking_id", "task_type");
CREATE INDEX "operational_task_project_id_status_due_at_idx" ON "operational_task"("project_id", "status", "due_at");
CREATE INDEX "operational_task_unit_id_status_due_at_idx" ON "operational_task"("unit_id", "status", "due_at");
CREATE INDEX "operational_task_assigned_identity_id_status_due_at_idx" ON "operational_task"("assigned_identity_id", "status", "due_at");

ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_task" ADD CONSTRAINT "operational_task_assigned_identity_id_fkey"
  FOREIGN KEY ("assigned_identity_id") REFERENCES "identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing checked-out stays predate OperationalTask. Only seed the latest
-- unresolved departure per unit. A later booking/stay is evidence that the
-- historical turnover was already operationally cleared before this model existed.
WITH latest_unresolved_checkout AS (
  SELECT DISTINCT ON (b."unit_id")
    b."id", b."project_id", b."unit_id", b."checked_out_at", b."end_date"
  FROM "booking" b
  WHERE b."status" = 'checked_out'
    AND NOT EXISTS (
      SELECT 1
      FROM "booking" later
      WHERE later."unit_id" = b."unit_id"
        AND later."id" <> b."id"
        AND later."start_date" >= b."end_date"
        AND later."status" IN ('confirmed','checked_in','checked_out','completed')
    )
  ORDER BY b."unit_id", COALESCE(b."checked_out_at", b."end_date"::timestamp) DESC
)
INSERT INTO "operational_task" (
  "id","created_at","updated_at","project_id","unit_id","booking_id",
  "task_type","status","due_at"
)
SELECT
  'turnover-clean-' || b."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  b."project_id",
  b."unit_id",
  b."id",
  'turnover_cleaning'::"OperationalTaskType",
  'planned'::"OperationalTaskStatus",
  COALESCE(b."checked_out_at", b."end_date"::timestamp)
FROM latest_unresolved_checkout b
ON CONFLICT ("booking_id","task_type") DO NOTHING;

WITH latest_unresolved_checkout AS (
  SELECT DISTINCT ON (b."unit_id")
    b."id", b."project_id", b."unit_id", b."checked_out_at", b."end_date"
  FROM "booking" b
  WHERE b."status" = 'checked_out'
    AND NOT EXISTS (
      SELECT 1
      FROM "booking" later
      WHERE later."unit_id" = b."unit_id"
        AND later."id" <> b."id"
        AND later."start_date" >= b."end_date"
        AND later."status" IN ('confirmed','checked_in','checked_out','completed')
    )
  ORDER BY b."unit_id", COALESCE(b."checked_out_at", b."end_date"::timestamp) DESC
)
INSERT INTO "operational_task" (
  "id","created_at","updated_at","project_id","unit_id","booking_id",
  "task_type","status","due_at"
)
SELECT
  'turnover-inspect-' || b."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  b."project_id",
  b."unit_id",
  b."id",
  'turnover_inspection'::"OperationalTaskType",
  'planned'::"OperationalTaskStatus",
  COALESCE(b."checked_out_at", b."end_date"::timestamp)
FROM latest_unresolved_checkout b
ON CONFLICT ("booking_id","task_type") DO NOTHING;

ALTER TABLE "operational_task" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "operational_task" FROM PUBLIC, anon, authenticated;
