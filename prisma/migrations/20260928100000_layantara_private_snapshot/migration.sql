-- Private lossless source snapshots for non-destructive Layantara -> myUNO migration.
-- This schema is NOT part of the Supabase Data API and contains source guest/payment data.
CREATE SCHEMA IF NOT EXISTS layantara_copy;
REVOKE ALL ON SCHEMA layantara_copy FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS layantara_copy.source_row (
  source_table text NOT NULL,
  source_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text GENERATED ALWAYS AS (md5(payload::text)) STORED,
  copied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, source_id),
  CONSTRAINT layantara_source_table_valid CHECK (source_table ~ '^[a-z][a-z0-9_]*$')
);
CREATE INDEX IF NOT EXISTS layantara_snapshot_by_table ON layantara_copy.source_row (source_table, copied_at);
CREATE TABLE IF NOT EXISTS layantara_copy.import_audit (
  source_table text PRIMARY KEY,
  source_count integer NOT NULL,
  copied_count integer NOT NULL,
  source_checksum text NOT NULL,
  target_checksum text NOT NULL,
  verified boolean NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA layantara_copy FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA layantara_copy REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA layantara_copy IS 'Private Layantara source copy for verified migration; not published through public/API; source DB is left unchanged.';
