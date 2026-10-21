-- Activate only after reviewed installation and successful manual dispatch/watchdog.
-- Vault values are provisioned by an operator; never paste secrets into this file.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Activation requires the canonical production database owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Reviewed pg_cron and pg_net installation required';
  END IF;
  IF (SELECT count(DISTINCT name) FROM vault.decrypted_secrets
      WHERE name IN ('myuno_scheduler_cron_secret', 'myuno_scheduler_protection_bypass',
                     'myuno_scheduler_alert_webhook') AND length(decrypted_secret) > 0) <> 3 THEN
    RAISE EXCEPTION 'Scheduler credentials and alert destination required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM myuno_ops.scheduler_delivery
                 WHERE outcome = 'ok' AND started_at > now() - interval '10 minutes')
     OR NOT EXISTS (SELECT 1 FROM myuno_ops.scheduler_watch WHERE name = 'frequent' AND state = 'ok') THEN
    RAISE EXCEPTION 'Fresh verified dispatch and watchdog acceptance required';
  END IF;
END;
$guard$;
SELECT cron.schedule('myuno-frequent-v1', '*/5 * * * *', 'SELECT myuno_ops.dispatch_frequent()');
SELECT cron.schedule('myuno-frequent-watch-v1', '* * * * *', 'SELECT myuno_ops.check_frequent()');
COMMIT;
