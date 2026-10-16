import { createHash } from 'node:crypto';

export const PROJECT_REF = 'burcnghheyzbzffzgmjz';
export const APPROVED_PENDING = new Set([
  '20261015080331_pricing_editor_role',
  '20261015120347_property_capability_delegation',
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
    || url.searchParams.get('pgbouncer') === 'true') {
    throw new Error('Refusing a foreign database or transaction pooler');
  }
}

export function checkMigrationLedger(files, rows, requireComplete = false) {
  if (rows.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Unfinished migration requires operator recovery');
  const finished = new Map(rows.filter(row => row.finished_at && !row.rolled_back_at).map(row => [row.migration_name, row]));
  const pending = [];
  for (const file of files) {
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
  return `Production migration/verification failed: stage=${safeStage}; code=${code}. Inspect the release configuration and ledger; no automatic history repair attempted.`;
}
