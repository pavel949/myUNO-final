import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkMigrationLedger, migrationFailureSummary, productionMigrationConnection } from './production-migration-policy.mjs';

/** No DDL, subprocess, repair, business writer or credential output in this path. */
export async function inspectReadonlyMigrationLedger(db, files) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const rows = await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
    return checkMigrationLedger(files, rows);
  }, { timeout: 15000, maxWait: 5000 });
}

async function main() {
  let db;
  try {
    if (process.env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')) {
      throw new Error('Read-only preflight requires reviewed main');
    }
    const url = productionMigrationConnection(process.env.DATABASE_URL);
    const target = new URL(url);
    // Only a validated Supabase hostname and port; never the connection URI.
    console.log(`Read-only migration preflight: host=${target.hostname}; port=${target.port || '5432'}`);
    const root = new URL('../prisma/migrations/', import.meta.url);
    const files = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory()) files.push({ name: entry.name, sql: await readFile(new URL(`${entry.name}/migration.sql`, root)) });
    }
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient({ datasources: { db: { url } } });
    const pending = await inspectReadonlyMigrationLedger(db, files);
    console.log(`Read-only ledger verified; reviewed pending migrations: ${pending.join(', ') || 'none'}. No migrations applied.`);
  } catch (error) {
    console.error(migrationFailureSummary('ledger_read', error));
    process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
