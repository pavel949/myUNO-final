import { createHash } from 'node:crypto';
import { resolveDatabaseUrl } from '../src/lib/resolveDatabaseUrl.ts';

export const PROJECT_REF = 'burcnghheyzbzffzgmjz';
export const APPROVED_PENDING = new Set([
  '20261015080331_pricing_editor_role',
  '20261015120347_property_capability_delegation',
  '20261021010000_booking_refund_dispatch_authorization',
  '20261021023000_imported_reservation_groups',
  '20261021140000_sales_offer_desk',
  '20261021190000_protected_workspace_administration',
  '20261021150000_pricing_rule_tariff_grid_intent',
]);

// Reviewed expand-only release SQL. Any further edit requires another review.
const REVIEWED_RELEASE_CHECKSUMS = new Map([
  ['20261021150000_pricing_rule_tariff_grid_intent', '2e4c95a17b5318716b4cf3d1554c079277167a67518e2985a090026c3b76c414'],
  ['20261021190000_protected_workspace_administration', '5d67013f4d2f393f6785334a7c577a5984ca4e54315d0ceb5ed4ea0234bc93ef'],
  ['20261021023000_imported_reservation_groups', '0585d9741c7a086946dc2e2058f180cc8880d906023bdd2406bbeb9bca0d10e7'],
  ['20261021010000_booking_refund_dispatch_authorization', '05b04e97d98c29634d27b5ae55fbfbf8b5c21150d17f5d328e1c481dc586d25a'],
  ['20261021140000_sales_offer_desk', '96dfc0238962165e14b758f12951520c4759e640267281818c039dda0017b92b'],
]);

// Git 8dec5d51 -> fa1b2bff removed five SQL comments only. Production
// recorded the original LF file. Accept this exact audited pair without
// updating _prisma_migrations or replaying the historical data migration.
const COMMENT_ONLY_HISTORY = {
  name: '20260913210000_canonical_inventory_bootstrap',
  recorded: '5cdddad1e07812cdfdac470ecc1b946304e73f2be4d1fcf376ba8668d32e3f80',
  current: '3ad73a860c207d0fd76caa0fdc2887552b099a08102b370c0de1b0ab9a5084ec',
};

// Prisma accepts equivalent LF/CRLF files. Preserve the stored checksum;
// operating-system line endings must not cause a false history-repair prompt.
export function migrationChecksums(sql) {
  const source = sql.toString('utf8').replace(/^\uFEFF/, '');
  const lf = source.replace(/\r\n/g, '\n');
  return new Set([source, lf, lf.replace(/\n/g, '\r\n')].map(value => createHash('sha256').update(value).digest('hex')));
}

export function assertProductionTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL is missing or invalid'); }
  const direct = url.hostname === `db.${PROJECT_REF}.supabase.co`;
  const session = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
    && decodeURIComponent(url.username) === `postgres.${PROJECT_REF}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !session)
    || (url.port && url.port !== '5432') || url.pathname !== '/postgres'
    || [...url.searchParams].some(([key, value]) => key.toLowerCase() === 'schema' && (key !== 'schema' || value !== 'public'))
    || url.searchParams.get('pgbouncer') === 'true') {
    throw new Error('Refusing a foreign database, non-public schema or transaction pooler');
  }
}

/** Keep Prisma queries and its migration subprocess on the same IPv4 session route. */
export function productionMigrationConnection(value) {
  // Validate before normalization: runtime compatibility must never turn a
  // foreign project, transaction pooler or malformed input into a release target.
  assertProductionTarget(value);
  const explicitHost = process.env.MIGRATION_DATABASE_HOST;
  if (explicitHost) {
    const direct = explicitHost === `db.${PROJECT_REF}.supabase.co`;
    if (!direct && !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(explicitHost)) {
      throw new Error('Refusing an invalid migration session host override');
    }
    const routed = new URL(value);
    if (!['postgres', `postgres.${PROJECT_REF}`].includes(decodeURIComponent(routed.username))) {
      throw new Error('Refusing a foreign database principal');
    }
    // Only endpoint metadata comes from the working backup route. Authentication
    // always remains the migration credential; the reader secret is never copied.
    routed.hostname = explicitHost;
    routed.port = '5432';
    routed.username = direct ? 'postgres' : `postgres.${PROJECT_REF}`;
    if (!routed.searchParams.has('sslmode')) routed.searchParams.set('sslmode', 'require');
    if (!routed.searchParams.has('connection_limit')) routed.searchParams.set('connection_limit', '1');
    assertProductionTarget(routed.toString());
    return routed.toString();
  }
  if (process.env.DATABASE_POOLER_HOST && !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(process.env.DATABASE_POOLER_HOST)) {
    throw new Error('Refusing an invalid migration session host override');
  }
  const resolved = new URL(resolveDatabaseUrl(value));
  // A reviewed workflow may choose the project's alternate session cluster.
  // Apply that explicit route to already-pooled URLs as well as direct ones.
  if (process.env.DATABASE_POOLER_HOST) resolved.hostname = process.env.DATABASE_POOLER_HOST;
  // The runtime host override is configuration, not authority to change targets.
  assertProductionTarget(resolved.toString());
  return resolved.toString();
}

export function checkMigrationLedger(files, rows, requireComplete = false) {
  if (rows.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Unfinished migration requires operator recovery');
  const finished = new Map(rows.filter(row => row.finished_at && !row.rolled_back_at).map(row => [row.migration_name, row]));
  const pending = [];
  for (const file of files) {
    const reviewedChecksum = REVIEWED_RELEASE_CHECKSUMS.get(file.name);
    if (reviewedChecksum && !migrationChecksums(file.sql).has(reviewedChecksum)) {
      throw new Error(`Migration checksum mismatch: ${file.name}`);
    }
    const applied = finished.get(file.name);
    if (!applied) { pending.push(file.name); continue; }
    const checksums = migrationChecksums(file.sql);
    const auditedComments = file.name === COMMENT_ONLY_HISTORY.name
      && applied.checksum === COMMENT_ONLY_HISTORY.recorded && checksums.has(COMMENT_ONLY_HISTORY.current);
    if (!checksums.has(applied.checksum) && !auditedComments) {
      throw new Error(`Migration checksum mismatch: ${file.name}`);
    }
  }
  if (pending.some(name => !APPROVED_PENDING.has(name))) throw new Error('Unexpected pending migration; review the new release first');
  if (requireComplete && pending.length) throw new Error('Migration ledger is incomplete');
  return pending;
}


/** Diagnostics may identify a release stage/code, never a driver message, URL or SQL. */
export function migrationFailureSummary(stage, error) {
  const stages = new Set(['ledger_read', 'ledger_policy', 'snapshot_before', 'migrate', 'ledger_verify', 'snapshot_after']);
  const safeStage = stages.has(stage) ? stage : 'unknown';
  // PrismaClientInitializationError uses errorCode, unlike known query errors.
  // Inspect only these bounded codes; never fall back to parsing the message.
  const code = [error?.code, error?.errorCode].find(value => typeof value === 'string'
    && (/^P[0-9]{4}$/.test(value) || ['ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT'].includes(value))) ?? 'unclassified';
  const kinds = new Set(['PrismaClientInitializationError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientValidationError', 'PrismaClientRustPanicError', 'Error']);
  const kind = kinds.has(error?.name) ? error.name : 'unknown';
  return `Production migration/verification failed: stage=${safeStage}; code=${code}; kind=${kind}; category=${migrationFailureCategory(error)}. Inspect the release configuration and ledger; no automatic history repair attempted.`;
}

/** Fixed diagnostic buckets only: no captured text or extracted secret reaches logs. */
export function migrationFailureCategory(error) {
  const message = typeof error?.message === 'string'
    ? error.message.replace(/postgres(?:ql)?:\/\/[^\s)]+/gi, '[connection]') : '';
  if (/^Refusing (?:a foreign database|an invalid migration session host override)/.test(message)) return 'target_rejected';
  if (/^(Unfinished migration|Migration checksum mismatch|Unexpected pending migration|Migration ledger is incomplete)/.test(message)) return 'ledger_policy_rejected';
  if (/tenant or user not found/i.test(message)) return 'pooler_tenant_rejected';
  if (/circuit breaker open|too many authentication errors/i.test(message)) return 'pooler_auth_circuit_open';
  if (/password authentication failed|authentication failed against database/i.test(message)) return 'authentication_rejected';
  if (/maxclientsinsessionmode|max clients reached|remaining connection slots/i.test(message)) return 'pool_capacity';
  if (/permission denied for (?:table )?["']?_prisma_migrations/i.test(message)) return 'ledger_permission_denied';
  if (/can.t reach database server|network is unreachable|connection refused|getaddrinfo/i.test(message)) return 'network_unreachable';
  if (/ssl error|tls handshake|error opening a tls connection|certificate verif(?:y|ication) failed/i.test(message)) return 'tls_failure';
  if (/timed out|timeout/i.test(message)) return 'connection_timeout';
  return 'unclassified';
}
