import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertProductionTarget, checkMigrationLedger, PROJECT_REF, APPROVED_PENDING } from './production-migration-policy.mjs';

test('release target refuses foreign project, local DB, transaction pooler and lookalike host', () => {
  assertProductionTarget(`postgresql://postgres.${PROJECT_REF}:test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`);
  assertProductionTarget(`postgresql://postgres:test@db.${PROJECT_REF}.supabase.co:5432/postgres`);
  for (const url of [undefined, 'postgresql://test@localhost/test', `postgresql://postgres.other:test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co.evil.test/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co:6543/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co/postgres?pgbouncer=true`]) {
    assert.throws(() => assertProductionTarget(url));
  }
});
test('ledger refuses checksum drift, unfinished history and unreviewed pending SQL', () => {
  const file = { name: 'baseline', sql: Buffer.from('SELECT 1;') };
  const row = { migration_name: file.name, checksum: createHash('sha256').update(file.sql).digest('hex'), finished_at: new Date(), rolled_back_at: null };
  assert.deepEqual(checkMigrationLedger([file], [row]), []);
  assert.throws(() => checkMigrationLedger([file], [{ ...row, checksum: 'changed' }]));
  assert.throws(() => checkMigrationLedger([file], [{ ...row, finished_at: null }]));
  assert.throws(() => checkMigrationLedger([file], []));
  const reviewed = { name: [...APPROVED_PENDING][0], sql: Buffer.from('') };
  assert.deepEqual(checkMigrationLedger([reviewed], []), [reviewed.name]);
  assert.throws(() => checkMigrationLedger([reviewed], [], true));
  assert.deepEqual(checkMigrationLedger([file], [row, { migration_name: 'legacy_orphan', finished_at: new Date() }]), []);
});

test('equivalent Windows line endings do not rewrite or invalidate history', () => {
  const sql = Buffer.from('SELECT 1;\nSELECT 2;\n');
  const row = { migration_name: 'baseline', checksum: createHash('sha256').update(sql.toString().replace(/\n/g, '\r\n')).digest('hex'), finished_at: new Date() };
  assert.deepEqual(checkMigrationLedger([{ name: 'baseline', sql }], [row]), []);
  assert.throws(() => checkMigrationLedger([{ name: 'baseline', sql: Buffer.from('SELECT 3;\n') }], [row]));
});

test('accepts only the audited historical comment removal without repairing the ledger', () => {
  const name = '20260913210000_canonical_inventory_bootstrap';
  const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url));
  const row = { migration_name: name, checksum: '5cdddad1e07812cdfdac470ecc1b946304e73f2be4d1fcf376ba8668d32e3f80', finished_at: new Date() };
  assert.deepEqual(checkMigrationLedger([{ name, sql }], [row]), []);
  assert.throws(() => checkMigrationLedger([{ name, sql: Buffer.concat([sql, Buffer.from('\nSELECT 42;')]) }], [row]));
  assert.throws(() => checkMigrationLedger([{ name, sql }], [{ ...row, checksum: 'unknown' }]));
});


test('release failures expose only allowlisted stages and driver codes', async () => {
  const { migrationFailureSummary } = await import('./production-migration-policy.mjs');
  assert.match(migrationFailureSummary('ledger_read', { code: 'P1001', message: 'postgresql://private:secret@db.example/production' }), /stage=ledger_read; code=P1001/);
  assert.doesNotMatch(migrationFailureSummary('private-token', { code: 'password', message: 'SECRET' }), /private-token|password|SECRET/);
  const { Prisma } = await import('@prisma/client');
  const initError = new Prisma.PrismaClientInitializationError('postgresql://private:secret@db.example/production', '5.22.0', 'P1000');
  assert.match(migrationFailureSummary('ledger_read', initError), /stage=ledger_read; code=P1000/);
  assert.doesNotMatch(migrationFailureSummary('ledger_read', initError), /private|secret|db.example/);
  assert.doesNotMatch(migrationFailureSummary('ledger_read', { errorCode: 'TOKEN', message: 'SECRET' }), /TOKEN|SECRET/);
});
