import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectReadonlyMigrationLedger, readonlyPreflightConnection } from './production-migration-preflight.mjs';
import { migrationFailureCategory, migrationFailureSummary } from './production-migration-policy.mjs';

test('preflight selects the restricted canonical backup reader without copying writer credentials', () => {
  const env = {
    READONLY_DATABASE_URL: 'postgresql://backup_reader.burcnghheyzbzffzgmjz:reader-only@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=disable',
    DATABASE_URL: 'postgresql://invalid-writer:never-used@foreign.example/postgres',
  };
  const result = new URL(readonlyPreflightConnection(env));
  assert.equal(result.username, 'backup_reader.burcnghheyzbzffzgmjz');
  assert.equal(result.password, 'reader-only');
  assert.equal(result.searchParams.get('sslmode'), 'require');
  assert.equal(result.searchParams.get('connection_limit'), '1');
  for (const invalid of [
    env.READONLY_DATABASE_URL.replace('burcnghheyzbzffzgmjz', 'otherproject'),
    env.READONLY_DATABASE_URL.replace('backup_reader.burcnghheyzbzffzgmjz', 'postgres.burcnghheyzbzffzgmjz'),
    env.READONLY_DATABASE_URL.replace(':5432', ':6543'),
    env.READONLY_DATABASE_URL + '&schema=private',
    env.READONLY_DATABASE_URL + '&pgbouncer=true',
  ]) assert.throws(() => readonlyPreflightConnection({ READONLY_DATABASE_URL: invalid }));
});

test('preflight establishes database-enforced READ ONLY before reading migration history', async () => {
  const files = [{ name: 'baseline', sql: Buffer.from('SELECT 1;') }];
  const statements = [];
  const db = { $transaction: async (work, options) => {
    assert.deepEqual(options, { timeout: 15000, maxWait: 5000 });
    return work({
      $executeRawUnsafe: async sql => { statements.push(sql); },
      $queryRawUnsafe: async sql => {
        assert.equal(statements[0], 'SET TRANSACTION READ ONLY');
        statements.push(sql);
        return [{ migration_name: 'baseline', checksum: createHash('sha256').update(files[0].sql).digest('hex'), finished_at: new Date() }];
      },
    });
  } };
  assert.deepEqual(await inspectReadonlyMigrationLedger(db, files), []);
  assert.equal(statements.length, 2);
  assert.match(statements[1], /^SELECT .* FROM public\._prisma_migrations$/);
});

test('failed READ ONLY setup prevents the ledger query and all later work', async () => {
  let queried = false;
  const db = { $transaction: work => work({
    $executeRawUnsafe: async () => { throw new Error('read only rejected'); },
    $queryRawUnsafe: async () => { queried = true; return []; },
  }) };
  await assert.rejects(inspectReadonlyMigrationLedger(db, []));
  assert.equal(queried, false);
});

test('unknown Prisma connector failures get fixed categories without URL, SQL or untrusted fields', async () => {
  const { Prisma } = await import('@prisma/client');
  const cases = [
    ['Tenant or user not found', 'pooler_tenant_rejected'],
    ['Circuit breaker open: Too many authentication errors', 'pooler_auth_circuit_open'],
    ['password authentication failed', 'authentication_rejected'],
    ['MaxClientsInSessionMode', 'pool_capacity'],
    ['permission denied for table _prisma_migrations', 'ledger_permission_denied'],
    ["Can\u0027t reach database server", 'network_unreachable'],
    ['TLS certificate verify failed', 'tls_failure'],
    ['connection timed out', 'connection_timeout'],
    ['unexpected provider payload', 'unclassified'],
    ['connection config sslmode=require', 'unclassified'],
  ];
  for (const [reason, category] of cases) {
    const error = new Prisma.PrismaClientUnknownRequestError(`postgresql://private:SECRET@db.example/production SELECT private_data; ${reason}`, { clientVersion: '5.22.0' });
    assert.equal(migrationFailureCategory(error), category);
    const diagnostic = migrationFailureSummary('ledger_read', error);
    assert.match(diagnostic, new RegExp(`kind=PrismaClientUnknownRequestError; category=${category}`));
    assert.doesNotMatch(diagnostic, /SECRET|db\.example|SELECT|private_data|postgresql/);
  }
  assert.doesNotMatch(migrationFailureSummary('ledger_read', { name: 'PRIVATE_NAME', message: 'PRIVATE_MESSAGE P1000' }), /PRIVATE_NAME|PRIVATE_MESSAGE|code=P1000/);
});
