// Metadata-only diagnostics. No database client, socket connection or SQL.
import { Resolver } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { assertProductionTarget, productionMigrationConnection, PROJECT_REF } from './production-migration-policy.mjs';
import { readonlyPreflightConnection } from './production-migration-preflight.mjs';

function option(url, key, values) {
  const value = url.searchParams.get(key);
  return value === null ? 'default' : values.includes(value) ? value : 'unrecognized';
}

export function connectionMetadata(value) {
  const url = new URL(value);
  const direct = url.hostname === `db.${PROJECT_REF}.supabase.co`;
  if (!direct && !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)) {
    throw new Error('Diagnostic target rejected');
  }
  const flags = ['host', 'sslcert', 'sslidentity', 'sslpassword', 'sslrootcert', 'options'];
  return {
    host: url.hostname,
    port: url.port || '5432',
    mode: direct ? 'direct' : (url.port || '5432') === '5432' ? 'session_pooler' : 'other',
    publicSchema: !url.searchParams.has('schema') || url.searchParams.get('schema') === 'public',
    sslmode: option(url, 'sslmode', ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']),
    sslaccept: option(url, 'sslaccept', ['strict', 'accept_invalid_certs']),
    singleConnection: url.searchParams.get('connection_limit') === '1',
    transactionPooling: url.searchParams.get('pgbouncer') === 'true',
    duplicateOptions: [...new Set(url.searchParams.keys())].some(key => url.searchParams.getAll(key).length > 1),
    flags: Object.fromEntries(flags.map(key => [key, url.searchParams.has(key)])),
  };
}

export function describeConnections(env) {
  assertProductionTarget(env.DATABASE_URL);
  const input = connectionMetadata(env.DATABASE_URL);
  const writer = connectionMetadata(productionMigrationConnection(env.DATABASE_URL));
  const reader = connectionMetadata(readonlyPreflightConnection(env));
  return { input, writer, reader, sameEndpoint: writer.host === reader.host && writer.port === reader.port };
}

export async function dnsMetadata(host, resolver) {
  // Host is validated before any DNS operation. Never use query-option values.
  connectionMetadata(`postgresql://diagnostic@${host}:5432/postgres`);
  const results = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
  const safeCodes = ['ENODATA', 'ENOTFOUND', 'ETIMEOUT', 'ESERVFAIL', 'EREFUSED', 'EAI_AGAIN'];
  return Object.fromEntries(results.map((result, index) => [index === 0 ? 'ipv4' : 'ipv6',
    result.status === 'fulfilled'
      ? { count: Array.isArray(result.value) ? Math.min(result.value.length, 128) : 0 }
      : { error: safeCodes.includes(result.reason?.code) ? result.reason.code : 'unclassified' },
  ]));
}

async function main() {
  try {
    if (process.env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')) {
      throw new Error('Reviewed main required');
    }
    const metadata = describeConnections(process.env);
    console.log(`Connection metadata: ${JSON.stringify(metadata)}`);
    const resolver = new Resolver({ timeout: 3000, tries: 1 });
    for (const host of new Set([metadata.input.host, metadata.writer.host, metadata.reader.host])) {
      console.log(`Connection DNS: ${JSON.stringify({ host, ...await dnsMetadata(host, resolver) })}`);
    }
  } catch {
    // No arbitrary URI, username, password, query value, DNS address or driver message.
    console.error('Connection metadata diagnostic rejected; inspect the reviewed target configuration.');
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
