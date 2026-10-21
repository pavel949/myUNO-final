import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertProductionTarget, productionMigrationConnection, checkMigrationLedger, PROJECT_REF, APPROVED_PENDING } from './production-migration-policy.mjs';

test('canonical direct migration uses the runtime session route and preserves encoded credentials', () => {
  const raw = `postgresql://postgres:p%40ss%2Fword%3A%25@db.${PROJECT_REF}.supabase.co:5432/postgres?schema=public`;
  const resolved = new URL(productionMigrationConnection(raw));
  assert.equal(resolved.hostname, 'aws-1-ap-south-1.pooler.supabase.com');
  assert.equal(resolved.port, '5432');
  assert.equal(resolved.username, `postgres.${PROJECT_REF}`);
  assert.equal(resolved.password, new URL(raw).password);
  assert.equal(resolved.searchParams.get('sslmode'), 'require');
  assert.equal(resolved.searchParams.get('connection_limit'), '1');
  assert.equal(resolved.searchParams.get('schema'), 'public');
  assert.equal(new URL(productionMigrationConnection(resolved.toString())).href, resolved.href);
});

test('migration validates input before rewriting and refuses a foreign resolver override', () => {
  for (const raw of [
    `postgresql://postgres:test@db.foreign.supabase.co:5432/postgres`,
    `postgresql://postgres.${PROJECT_REF}:test@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  ]) assert.throws(() => productionMigrationConnection(raw));
  const previous = process.env.DATABASE_POOLER_HOST;
  try {
    for (const host of ['db.attacker.example', 'https://aws-0-ap-south-1.pooler.supabase.com', 'aws-0-ap-south-1.pooler.supabase.com:5432', ' ']) {
      process.env.DATABASE_POOLER_HOST = host;
      assert.throws(() => productionMigrationConnection(`postgresql://postgres:test@db.${PROJECT_REF}.supabase.co:5432/postgres`));
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_POOLER_HOST;
    else process.env.DATABASE_POOLER_HOST = previous;
  }
});

test('an explicit canonical session route also applies to an already-pooled URL without changing credentials', () => {
  const previous = process.env.DATABASE_POOLER_HOST;
  const raw = `postgresql://postgres.${PROJECT_REF}:synthetic@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`;
  try {
    process.env.DATABASE_POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
    const resolved = new URL(productionMigrationConnection(raw));
    assert.equal(resolved.hostname, process.env.DATABASE_POOLER_HOST);
    assert.equal(resolved.username, new URL(raw).username);
    assert.equal(resolved.password, new URL(raw).password);
    assert.equal(resolved.port, '5432');
    assert.equal(resolved.pathname, '/postgres');
  } finally {
    if (previous === undefined) delete process.env.DATABASE_POOLER_HOST;
    else process.env.DATABASE_POOLER_HOST = previous;
  }
});

test('release target refuses foreign project, local DB, transaction pooler and lookalike host', () => {
  assertProductionTarget(`postgresql://postgres.${PROJECT_REF}:test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`);
  assertProductionTarget(`postgresql://postgres:test@db.${PROJECT_REF}.supabase.co:5432/postgres`);
  for (const url of [undefined, 'postgresql://test@localhost/test', `postgresql://postgres.other:test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co.evil.test/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co:6543/postgres`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co/postgres?schema=auth`,
    `postgresql://postgres.${PROJECT_REF}:test@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?schema=public&schema=auth`,
    `postgresql://postgres:test@db.${PROJECT_REF}.supabase.co/postgres?SCHEMA=auth`,
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


test('backup endpoint metadata preserves migration credentials and explicit direct routing', () => {
  const previous = process.env.MIGRATION_DATABASE_HOST;
  const raw = `postgresql://postgres:synthetic%40migration@db.${PROJECT_REF}.supabase.co:5432/postgres?schema=public&sslmode=verify-full`;
  try {
    for (const host of [`db.${PROJECT_REF}.supabase.co`, 'aws-0-ap-south-1.pooler.supabase.com']) {
      process.env.MIGRATION_DATABASE_HOST = host;
      const routed = new URL(productionMigrationConnection(raw));
      assert.equal(routed.hostname, host);
      assert.equal(routed.password, new URL(raw).password);
      assert.equal(routed.username, host.startsWith('db.') ? 'postgres' : `postgres.${PROJECT_REF}`);
      assert.equal(routed.searchParams.get('sslmode'), 'verify-full');
      assert.equal(routed.searchParams.get('schema'), 'public');
      assert.equal(routed.port, '5432');
    }
    for (const host of ['foreign.example', 'aws-0-ap-south-1.pooler.supabase.com:5432', `db.foreign.supabase.co`]) {
      process.env.MIGRATION_DATABASE_HOST = host;
      assert.throws(() => productionMigrationConnection(raw));
    }
    process.env.MIGRATION_DATABASE_HOST = `db.${PROJECT_REF}.supabase.co`;
    assert.throws(() => productionMigrationConnection(raw.replace('postgres:synthetic', 'backup_reader:synthetic')));
    assert.throws(() => productionMigrationConnection(raw.replace('schema=public', 'schema=auth')));
  } finally {
    if (previous === undefined) delete process.env.MIGRATION_DATABASE_HOST;
    else process.env.MIGRATION_DATABASE_HOST = previous;
  }
});


test('reviewed release SQL is pinned and unreviewed migrations remain rejected', () => {
  const names = [
    '20261021010000_booking_refund_dispatch_authorization',
    '20261021023000_imported_reservation_groups',
    '20261021140000_sales_offer_desk',
    '20261021190000_protected_workspace_administration',
  ];
  const files = names.map(name => ({ name, sql: readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url)) }));
  assert.deepEqual(checkMigrationLedger(files, []), names);
  for (const file of files) {
    assert.throws(() => checkMigrationLedger([{ ...file, sql: Buffer.concat([file.sql, Buffer.from('\nSELECT 42;')]) }], []), /checksum mismatch/);
  }
  assert.throws(() => checkMigrationLedger([{ name: '20261022000000_unreviewed', sql: Buffer.from('SELECT 1;') }], []), /Unexpected pending migration/);
});
