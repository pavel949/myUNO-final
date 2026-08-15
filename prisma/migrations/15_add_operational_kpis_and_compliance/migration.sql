-- Phase 3: Operational KPIs & Compliance

-- 1. Create OperationalKpi table for tracking unit performance metrics
CREATE TABLE "operational_kpi" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unit_id" TEXT NOT NULL,
  "metric_name" TEXT NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "target_value" DECIMAL(10, 2),
  "actual_value" DECIMAL(10, 2),
  "status" TEXT NOT NULL DEFAULT 'on_track',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "operational_kpi_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Create IncidentLog table for tracking maintenance, complaints, violations
CREATE TABLE "incident_log" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unit_id" TEXT NOT NULL,
  "incident_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reported_by_identity_id" TEXT NOT NULL,
  "assigned_to_identity_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_at" TIMESTAMP(3),
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "incident_log_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_log_reported_by_fkey" FOREIGN KEY ("reported_by_identity_id") REFERENCES "identity" ("id") ON DELETE RESTRICT,
  CONSTRAINT "incident_log_assigned_to_fkey" FOREIGN KEY ("assigned_to_identity_id") REFERENCES "identity" ("id") ON DELETE SET NULL
);

-- 3. Create ComplianceChecklistTemplate table (master templates)
CREATE TABLE "compliance_checklist_template" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create ComplianceChecklistInstance table (tracking actual compliance checks)
CREATE TABLE "compliance_checklist_instance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unit_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "due_date" DATE NOT NULL,
  "completed_date" DATE,
  "checked_by_identity_id" TEXT,
  "passed" BOOLEAN,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compliance_checklist_instance_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "compliance_checklist_instance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "compliance_checklist_template" ("id") ON DELETE RESTRICT,
  CONSTRAINT "compliance_checklist_instance_checked_by_fkey" FOREIGN KEY ("checked_by_identity_id") REFERENCES "identity" ("id") ON DELETE SET NULL
);

-- 5. Create indexes for performance
CREATE INDEX "operational_kpi_unit_id_period_idx" ON "operational_kpi"("unit_id", "period_start", "period_end");
CREATE INDEX "operational_kpi_metric_status_idx" ON "operational_kpi"("metric_name", "status");
CREATE INDEX "incident_log_unit_id_status_idx" ON "incident_log"("unit_id", "status");
CREATE INDEX "incident_log_severity_idx" ON "incident_log"("severity");
CREATE INDEX "incident_log_created_at_idx" ON "incident_log"("created_at");
CREATE INDEX "compliance_checklist_instance_unit_id_due_idx" ON "compliance_checklist_instance"("unit_id", "due_date");
CREATE INDEX "compliance_checklist_instance_passed_idx" ON "compliance_checklist_instance"("passed");
