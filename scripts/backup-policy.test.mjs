import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupConnection, restorePlan } from './backup-policy.mjs';

test('libpq receives separate connection variables, never a URI as PGDATABASE', () => {
  const env = backupConnection('postgresql://myuno_backup_reader.burcnghheyzbzffzgmjz:p%40ss%3Aword@aws-1-ap-south-1.pooler.supabase.com:5432/postgres');
  assert.equal(env.PGDATABASE, 'postgres'); assert.equal(env.PGPASSWORD, 'p@ss:word');
  assert.equal(env.PGHOST, 'aws-1-ap-south-1.pooler.supabase.com');
  assert.equal(env.PGSSLMODE, 'require'); assert.match(env.PGOPTIONS, /read_only=on/);
});
test('backup refuses app principal, foreign projects and restore into production/source', () => {
  for (const url of ['postgresql://postgres.burcnghheyzbzffzgmjz:x@aws-1-ap-south-1.pooler.supabase.com/postgres', 'postgresql://backup.other:x@aws-1-ap-south-1.pooler.supabase.com/postgres']) assert.throws(() => backupConnection(url));
  assert.throws(() => backupConnection('postgresql://x:y@db.burcnghheyzbzffzgmjz.supabase.co/postgres', { scratch: true }));
  assert.throws(() => backupConnection('postgresql://test:test@localhost/myuno_test', { scratch: true }));
  assert.equal(backupConnection('postgresql://test:test@localhost/myuno_backup_restore_test', { scratch: true }).PGSSLMODE, 'disable');
});
test('restore skips only existing public schema and bootstraps omitted extensions', () => {
  const toc = '6; 2615 2200 SCHEMA - public postgres\n12; 3079 333 EXTENSION - citext postgres\n99; 1259 444 TABLE public unit postgres\n100; 0 444 TABLE DATA public unit postgres\n';
  const plan = restorePlan(toc);
  assert.equal(plan.list, toc.split('\n').slice(1).join('\n'));
  assert.deepEqual(plan.missingExtensions, ['btree_gist']);
  assert.match(plan.list, /TABLE DATA public unit/);
});
