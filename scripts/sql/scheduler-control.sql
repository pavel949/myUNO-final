-- Versioned operations infrastructure, separate from application migration history.
-- Requires pg_net and Supabase Vault. Run only through a reviewed operations rollout.
BEGIN;
CREATE SCHEMA IF NOT EXISTS myuno_ops;
REVOKE ALL ON SCHEMA myuno_ops FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS myuno_ops.scheduler_delivery (
  request_id bigint PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'ok', 'failed')),
  http_status integer
);
CREATE TABLE IF NOT EXISTS myuno_ops.scheduler_watch (
  name text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('ok', 'action')),
  last_alert_at timestamptz
);
ALTER TABLE myuno_ops.scheduler_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE myuno_ops.scheduler_watch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA myuno_ops FROM PUBLIC, anon, authenticated;

-- Invoker security: only the postgres-owned cron can read Vault and enqueue HTTP.
-- Neither a callable Data API function nor a new privileged application writer.
CREATE OR REPLACE FUNCTION myuno_ops.dispatch_frequent() RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  credential text;
  bypass text;
  request bigint;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(1836674926, 5) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM myuno_ops.scheduler_delivery
             WHERE outcome = 'pending' AND started_at > now() - interval '5 minutes')
  THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO credential FROM vault.decrypted_secrets
    WHERE name = 'myuno_scheduler_cron_secret';
  SELECT decrypted_secret INTO bypass FROM vault.decrypted_secrets
    WHERE name = 'myuno_scheduler_protection_bypass';
  IF coalesce(length(credential), 0) = 0 OR coalesce(length(bypass), 0) = 0
  THEN RAISE EXCEPTION 'Scheduler credentials are not configured'; END IF;
  SELECT net.http_post(
    url := 'https://my-uno-final.vercel.app/api/cron/run-frequent',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || credential, 'x-vercel-protection-bypass', bypass),
    body := '{}'::jsonb, timeout_milliseconds := 180000
  ) INTO request;
  INSERT INTO myuno_ops.scheduler_delivery(request_id) VALUES(request);
  RETURN request;
END;
$fn$;

CREATE OR REPLACE FUNCTION myuno_ops.check_frequent() RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  item record;
  payload jsonb;
  response_ok boolean;
  stale integer;
  unhealthy boolean;
  previous text;
  last_alert timestamptz;
  alert_url text;
  verified_dispatch_at timestamptz;
BEGIN
  -- Do not let concurrent watchdogs duplicate a notification.
  PERFORM pg_catalog.pg_advisory_xact_lock(1836674926, 6);
  FOR item IN SELECT d.request_id, r.status_code, r.content, r.timed_out, r.error_msg
    FROM myuno_ops.scheduler_delivery d JOIN net._http_response r ON r.id = d.request_id
    WHERE d.outcome = 'pending'
  LOOP
    response_ok := false;
    BEGIN
      payload := item.content::jsonb;
      response_ok := coalesce(item.status_code BETWEEN 200 AND 299
        AND NOT coalesce(item.timed_out, false) AND item.error_msg IS NULL
        AND payload->'success' = 'true'::jsonb
        AND payload->'results'->>'booking_lifecycle' LIKE 'ok (%)'
        AND payload->'results'->>'tm30_escalations' LIKE 'ok (%)'
        AND payload->'results'->>'ical_sync' LIKE 'ok (%)', false);
    EXCEPTION WHEN invalid_text_representation THEN response_ok := false;
    END;
    UPDATE myuno_ops.scheduler_delivery
      SET outcome = CASE WHEN response_ok THEN 'ok' ELSE 'failed' END,
          http_status = item.status_code WHERE request_id = item.request_id;
  END LOOP;
  UPDATE myuno_ops.scheduler_delivery SET outcome = 'failed'
    WHERE outcome = 'pending' AND started_at < now() - interval '5 minutes';
  SELECT max(started_at) INTO verified_dispatch_at FROM myuno_ops.scheduler_delivery WHERE outcome = 'ok';

  -- Assess each latest persisted execution, including failed/never-run jobs.
  SELECT count(*) INTO stale FROM
    (VALUES ('booking_lifecycle', interval '12 minutes'),
            ('tm30_escalations', interval '25 minutes'),
            ('ical_sync', interval '25 minutes')) AS expected(job_key, max_age)
    LEFT JOIN LATERAL (SELECT r.finished_at, r.outcome FROM public.job_run r
      WHERE r.job_key = expected.job_key ORDER BY r.started_at DESC LIMIT 1) latest ON true
    WHERE latest.finished_at IS NULL OR latest.outcome::text <> 'ok'
      OR latest.finished_at AT TIME ZONE 'UTC' < now() - expected.max_age
      OR latest.finished_at AT TIME ZONE 'UTC' < verified_dispatch_at;
  unhealthy := stale > 0 OR coalesce((SELECT outcome = 'failed'
    FROM myuno_ops.scheduler_delivery ORDER BY started_at DESC, request_id DESC LIMIT 1), false);
  SELECT state, last_alert_at INTO previous, last_alert FROM myuno_ops.scheduler_watch
    WHERE name = 'frequent';
  SELECT decrypted_secret INTO alert_url FROM vault.decrypted_secrets
    WHERE name = 'myuno_scheduler_alert_webhook';
  IF coalesce(alert_url, '') !~ '^https://[^/@?#[:space:]]+/'
  THEN RAISE EXCEPTION 'Scheduler alert webhook is not configured'; END IF;
  IF (unhealthy AND (previous IS DISTINCT FROM 'action' OR last_alert < now() - interval '30 minutes'))
     OR (NOT unhealthy AND previous = 'action') THEN
    PERFORM net.http_post(url := alert_url, headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('text', CASE WHEN unhealthy
        THEN 'myUNO scheduler requires attention: missing, failed or stale frequent jobs / dispatch.'
        ELSE 'myUNO scheduler recovered: all frequent jobs are fresh and successful.' END),
      timeout_milliseconds := 10000);
    last_alert := now();
  END IF;
  INSERT INTO myuno_ops.scheduler_watch(name, state, last_alert_at)
    VALUES('frequent', CASE WHEN unhealthy THEN 'action' ELSE 'ok' END, last_alert)
    ON CONFLICT(name) DO UPDATE SET state = EXCLUDED.state, last_alert_at = EXCLUDED.last_alert_at;
  DELETE FROM myuno_ops.scheduler_delivery WHERE started_at < now() - interval '7 days';
  RETURN CASE WHEN unhealthy THEN 'action' ELSE 'ok' END;
END;
$fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA myuno_ops FROM PUBLIC, anon, authenticated;
COMMIT;
