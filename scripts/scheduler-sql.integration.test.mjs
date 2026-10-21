import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { beforeEach, test } from 'node:test';

// Fixed disposable target: never infer a destructive-test target from DATABASE_URL.
assert.equal(process.env.MYUNO_SCHEDULER_SQL_TEST, 'isolated');
function sql(query, expectFailure = false) {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i',
    'myuno-release-postgres', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'test',
    '-d', 'myuno_scheduler_test'], { input: query, encoding: 'utf8' });
  if (expectFailure) { assert.notEqual(result.status, 0); return result.stderr; }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
sql(`CREATE SCHEMA IF NOT EXISTS vault; CREATE SCHEMA IF NOT EXISTS net;
  CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(name text PRIMARY KEY, decrypted_secret text);
  CREATE TABLE IF NOT EXISTS net.requests(id bigserial PRIMARY KEY, url text, headers jsonb, body jsonb);
  CREATE TABLE IF NOT EXISTS net._http_response(id bigint, status_code int, content text, timed_out boolean, error_msg text);
  CREATE TABLE IF NOT EXISTS public.job_run(job_key text, started_at timestamp, finished_at timestamp, outcome text);
  CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb,
    params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb,
    timeout_milliseconds int DEFAULT 2000) RETURNS bigint LANGUAGE sql AS $$
    INSERT INTO net.requests(url,headers,body) VALUES(url,headers,body) RETURNING id $$;`);
sql(readFileSync(new URL('./sql/scheduler-control.sql', import.meta.url), 'utf8'));
beforeEach(() => {
  sql(`TRUNCATE myuno_ops.scheduler_delivery, myuno_ops.scheduler_watch, net.requests,
    net._http_response, vault.decrypted_secrets, public.job_run RESTART IDENTITY;
    INSERT INTO vault.decrypted_secrets VALUES
      ('myuno_scheduler_cron_secret','synthetic-only'),
      ('myuno_scheduler_protection_bypass','synthetic-only'),
      ('myuno_scheduler_alert_webhook','https://alerts.example.test/hook');
    INSERT INTO public.job_run SELECT key, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', 'ok'
      FROM unnest(ARRAY['booking_lifecycle','tm30_escalations','ical_sync']) key;`);
});
const successful = JSON.stringify({ success: true, results: {
  booking_lifecycle: 'ok (0 expired)', tm30_escalations: 'ok (0 checked)', ical_sync: 'ok (0 synced)',
} });
test('invoker functions and tables are inaccessible to public API roles', () => {
  assert.equal(sql(`SELECT has_schema_privilege('anon','myuno_ops','USAGE'),
    has_function_privilege('authenticated','myuno_ops.dispatch_frequent()','EXECUTE'),
    has_table_privilege('anon','myuno_ops.scheduler_delivery','SELECT');`), 'f|f|f');
  assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='myuno_ops' AND rowsecurity"), '2');
});
test('missing credentials refuse a request and expose no secret', () => {
  sql("DELETE FROM vault.decrypted_secrets WHERE name='myuno_scheduler_cron_secret'");
  assert.match(sql('SELECT myuno_ops.dispatch_frequent()', true), /credentials are not configured/);
  assert.equal(sql('SELECT count(*) FROM net.requests'), '0');
});
test('repeated dispatch while HTTP is pending enqueues only once', () => {
  sql('SELECT myuno_ops.dispatch_frequent(); SELECT myuno_ops.dispatch_frequent();');
  assert.equal(sql('SELECT count(*) FROM net.requests'), '1');
  assert.equal(sql("SELECT url FROM net.requests"), 'https://my-uno-final.vercel.app/api/cron/run-frequent');
});
test('concurrent dispatchers enqueue only one request', async () => {
  const exec = promisify(execFile);
  await Promise.all(Array.from({ length: 8 }, () => exec('docker', [
    '--host=unix:///var/run/docker.sock', 'exec', 'myuno-release-postgres', 'psql',
    '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'test', '-d', 'myuno_scheduler_test',
    '-c', 'SELECT myuno_ops.dispatch_frequent()',
  ])));
  assert.equal(sql('SELECT count(*) FROM net.requests'), '1');
});
test('activation refuses the disposable database before creating schedules', () => {
  assert.match(sql(readFileSync(new URL('./sql/scheduler-activate.sql', import.meta.url), 'utf8'), true),
    /Activation requires the canonical production database owner/);
});
test('successful HTTP alone is insufficient without every expected job result', () => {
  sql(`SELECT myuno_ops.dispatch_frequent(); INSERT INTO net._http_response VALUES(1,200,'{"success":true}',false,null);`);
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
  assert.equal(sql('SELECT outcome FROM myuno_ops.scheduler_delivery'), 'failed');
});
test('well-formed response plus persisted fresh jobs passes', () => {
  sql(`SELECT myuno_ops.dispatch_frequent(); INSERT INTO net._http_response VALUES(1,200,'${successful}',false,null);
    UPDATE public.job_run SET started_at=now(),finished_at=now();`);
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'ok');
  assert.equal(sql('SELECT outcome FROM myuno_ops.scheduler_delivery'), 'ok');
});
test('positive HTTP body cannot replace persisted job records for this dispatch', () => {
  sql(`SELECT myuno_ops.dispatch_frequent(); INSERT INTO net._http_response VALUES(1,200,'${successful}',false,null);`);
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
});
test('malformed or redirected/protected response fails safely', () => {
  sql(`SELECT myuno_ops.dispatch_frequent(); INSERT INTO net._http_response VALUES(1,302,'<html>login</html>',false,null);`);
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
});
test('watchdog detects never-run, stale and failed jobs independently', () => {
  sql("DELETE FROM public.job_run WHERE job_key='ical_sync'");
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
  sql("INSERT INTO public.job_run VALUES('ical_sync',now(),now(),'ok'); UPDATE public.job_run SET finished_at=now()-interval '13 minutes' WHERE job_key='booking_lifecycle'");
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
  sql("UPDATE public.job_run SET finished_at=now(),outcome='failed' WHERE job_key='booking_lifecycle'");
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
});
test('alerts deduplicate during incident, repeat after cooldown and notify recovery', () => {
  sql("UPDATE public.job_run SET outcome='failed' WHERE job_key='booking_lifecycle'");
  sql('SELECT myuno_ops.check_frequent(); SELECT myuno_ops.check_frequent()');
  assert.equal(sql('SELECT count(*) FROM net.requests'), '1');
  sql("UPDATE myuno_ops.scheduler_watch SET last_alert_at=now()-interval '31 minutes'; SELECT myuno_ops.check_frequent()");
  assert.equal(sql('SELECT count(*) FROM net.requests'), '2');
  sql("UPDATE public.job_run SET outcome='ok',finished_at=now(); SELECT myuno_ops.check_frequent(); SELECT myuno_ops.check_frequent()");
  assert.equal(sql('SELECT count(*) FROM net.requests'), '3');
});
test('timed-out dispatch is failed and can be retried without duplicating a pending request', () => {
  sql("SELECT myuno_ops.dispatch_frequent(); UPDATE myuno_ops.scheduler_delivery SET started_at=now()-interval '6 minutes'");
  assert.equal(sql('SELECT myuno_ops.check_frequent()'), 'action');
  sql('SELECT myuno_ops.dispatch_frequent(); SELECT myuno_ops.dispatch_frequent()');
  assert.equal(sql("SELECT count(*) FROM myuno_ops.scheduler_delivery WHERE outcome='pending'"), '1');
});
test('missing alert destination refuses to claim watchdog acceptance', () => {
  sql("DELETE FROM vault.decrypted_secrets WHERE name='myuno_scheduler_alert_webhook'");
  assert.match(sql('SELECT myuno_ops.check_frequent()', true), /alert webhook is not configured/);
  assert.equal(sql('SELECT count(*) FROM myuno_ops.scheduler_watch'), '0');
});
