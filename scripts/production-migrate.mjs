// Explicit operator stage. Never imported by build/install or test runners.
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { assertProductionTarget, checkMigrationLedger } from './production-migration-policy.mjs';

assertProductionTarget(process.env.DATABASE_URL);
if (process.env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')
  || process.env.BACKUP_VERIFIED_SHA !== process.env.GITHUB_SHA) {
  throw new Error('Requires reviewed main and the successful backup/restore stage for this exact SHA');
}
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const root = new URL('../prisma/migrations/', import.meta.url);
const files = [];
for (const dir of await readdir(root, { withFileTypes: true })) {
  if (dir.isDirectory()) files.push({ name: dir.name, sql: await readFile(new URL(`${dir.name}/migration.sql`, root)) });
}
const ledger = () => db.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
// Digests only: no guest, payment, passport or private address data leaves DB.
async function financialSnapshot() {
  const result = {};
  for (const table of ['booking', 'payment', 'ledger_entry', 'owner_statement']) {
    result[table] = await db.$queryRawUnsafe(`SELECT count(*)::text AS rows, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) AS digest FROM public.${table} t`);
  }
  return JSON.stringify(result);
}
try {
  const pending = checkMigrationLedger(files, await ledger());
  console.log(`Reviewed pending migrations: ${pending.join(', ') || 'none'}`);
  const before = await financialSnapshot();
  const command = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
  if (command.error || command.status !== 0) throw new Error('Prisma migrate deploy failed; no automatic history repair attempted');
  checkMigrationLedger(files, await ledger(), true);
  if (before !== await financialSnapshot()) throw new Error('Financial records changed during release: reconcile before deploying; never overwrite live records');
  console.log(`Migration ledger complete: ${files.length} files; financial snapshot unchanged. Code deployment is a separate stage.`);
} catch {
  // Prisma exceptions can include credentials. Only safe status reaches logs.
  console.error('Production migration/verification failed. Inspect migration ledger and reconcile before retrying.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
