import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectionMetadata, describeConnections, dnsMetadata } from './production-connection-diagnostics.mjs';

const host = 'aws-1-ap-south-1.pooler.supabase.com';
const ref = 'burcnghheyzbzffzgmjz';

test('reports reader/writer differences without disclosing credentials or arbitrary options', () => {
  const result = describeConnections({
    DATABASE_URL: `postgresql://postgres.${ref}:WRITER_SECRET@${host}:5432/postgres?sslmode=disable&sslcert=PRIVATE_PATH&host=PRIVATE_SOCKET`,
    READONLY_DATABASE_URL: `postgresql://backup_reader.${ref}:READER_SECRET@${host}:5432/postgres`,
  });
  assert.equal(result.sameEndpoint, true);
  assert.equal(result.writer.sslmode, 'disable');
  assert.equal(result.reader.sslmode, 'require');
  assert.equal(result.writer.flags.host, true);
  assert.equal(result.writer.flags.sslcert, true);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|PRIVATE|backup_reader|postgres\./);
});

test('unknown and duplicate option values stay bounded; foreign DNS target is rejected', async () => {
  const result = connectionMetadata(`postgresql://secret:secret@${host}:5432/postgres?sslmode=SECRET&sslmode=OTHER&sslaccept=PRIVATE`);
  assert.equal(result.sslmode, 'unrecognized');
  assert.equal(result.sslaccept, 'unrecognized');
  assert.equal(result.duplicateOptions, true);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|OTHER|PRIVATE/);
  await assert.rejects(dnsMetadata('foreign.example', {}), /rejected/);
});

test('DNS exposes only family counts and fixed error categories', async () => {
  const result = await dnsMetadata(host, {
    resolve4: async () => ['192.0.2.1', '192.0.2.2'],
    resolve6: async () => { throw { code: 'SECRET', message: 'PRIVATE' }; },
  });
  assert.deepEqual(result, { ipv4: { count: 2 }, ipv6: { error: 'unclassified' } });
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2|SECRET|PRIVATE/);
});

test('metadata command is restricted to preflight-only mode and has no database execution path', () => {
  const workflow = readFileSync(new URL('../.github/workflows/production-migration.yml', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./production-connection-diagnostics.mjs', import.meta.url), 'utf8');
  assert.match(workflow, /name: Metadata-only connection and DNS comparison\n\s+if: \$\{\{ inputs\.preflight_only \}\}/);
  assert.match(workflow, /if: \$\{\{ !inputs\.preflight_only \}\}/);
  assert.doesNotMatch(source, /PrismaClient|\$queryRaw|\$executeRaw|spawnSync|node:net|node:tls/);
});
