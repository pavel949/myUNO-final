-- Scheduler last-run ledger (doc 15 §5). Append-only rows; the admin panel
-- reads the latest per job_key so a silent scheduler is a visible red light.

CREATE TYPE "JobRunOutcome" AS ENUM ('ok', 'failed');

CREATE TABLE "job_run" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "job_key" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL,
    "outcome" "JobRunOutcome" NOT NULL,
    "summary" TEXT,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_run_job_key_started_at_idx" ON "job_run"("job_key", "started_at");

-- Same idempotent RLS sweep as 20260824000021 / 20260825050000: a table
-- created after the original sweep is otherwise born readable through
-- Supabase's public REST endpoint.
DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;
