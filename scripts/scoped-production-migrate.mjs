import { readdir, readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { assertScopedRelease, RELEASE_SHA, RELEASE_MIGRATIONS } from './scoped-release-policy.mjs';
const control = resolve(import.meta.dirname, '..');
const release = resolve(control, '../release');
const mode = process.argv[2];
const head = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
// Dependency installation must not alter tracked release code or SQL.
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--'], { cwd: release, stdio: 'pipe' });
const migrationRoot = join(release, 'prisma/migrations');
const files = [];
for (const entry of await readdir(migrationRoot, { withFileTypes: true })) {
  if (entry.isDirectory()) files.push({ name: entry.name, sql: await readFile(join(migrationRoot, entry.name, 'migration.sql')) });
}
files.sort((a, b) => a.name.localeCompare(b.name));
assertScopedRelease({ releaseHead: head(release), controlHead: head(control), eventSha: process.env.GITHUB_SHA,
  ref: process.env.GITHUB_REF, backupSha: process.env.BACKUP_VERIFIED_SHA, mode, migrationNames: files.map(f => f.name) });
const { checkMigrationLedger, productionMigrationConnection, migrationFailureSummary } = await import(pathToFileURL(join(release, 'scripts/production-migration-policy.mjs')));
const { readonlyPreflightConnection } = await import(pathToFileURL(join(release, 'scripts/production-migration-preflight.mjs')));
const requireRelease = createRequire(join(release, 'package.json'));
const { PrismaClient } = requireRelease('@prisma/client');
let db;
let stage = 'ledger_read';
try {
  const url = mode === 'preflight' ? readonlyPreflightConnection(process.env) : productionMigrationConnection(process.env.DATABASE_URL);
  db = new PrismaClient({ datasources: { db: { url } } });
  const ledger = () => db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const forbidden = await tx.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='identity' AND column_name='is_super_admin') AS present");
    if (forbidden[0].present) throw new Error('Deferred administrator schema is already present; stop for reconciliation');
    return tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
  });
  const pending = checkMigrationLedger(files, await ledger());
  if (pending.some(name => !RELEASE_MIGRATIONS.includes(name))) throw new Error('Pending migrations exceed approved scope');
  console.log(`Approved application SHA: ${RELEASE_SHA}; pending: ${pending.join(', ') || 'none'}`);
  if (mode === 'migrate') {
    const snapshot = async () => {
      const result = {};
      for (const table of ['booking', 'payment', 'ledger_entry', 'owner_statement']) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::text AS rows, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) AS digest FROM public.${table} t`);
      return JSON.stringify(result);
    };
    stage = 'snapshot_before';
    const before = await snapshot();
    stage = 'migrate';
    const command = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: release, stdio: 'pipe', encoding: 'utf8', timeout: 300000, env: { ...process.env, DATABASE_URL: url },
    });
    if (command.error || command.status !== 0) throw Object.assign(new Error('Scoped migration failed'), { code: `${command.stdout ?? ''} ${command.stderr ?? ''}`.match(/\bP[0-9]{4}\b/)?.[0] });
    stage = 'ledger_verify';
    checkMigrationLedger(files, await ledger(), true);
    stage = 'snapshot_after';
    if (before !== await snapshot()) throw new Error('Financial records changed; reconcile before deployment, never overwrite');
    console.log('Approved migration ledger complete; financial snapshot unchanged; administrator schema absent. Deployment remains separate.');
  }
} catch (error) {
  console.error(migrationFailureSummary(stage, error));
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
