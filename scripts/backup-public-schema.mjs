import { writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { backupConnection, restorePlan } from './backup-policy.mjs';

const mode = process.argv[2];
const testSource = process.argv.includes('--test-source');
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function run(bin, args, env) {
  const result = spawnSync(bin, args, { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    for (const line of (result.stderr || '').split('\n').filter(value => /^pg_(dump|restore): error:/.test(value)).slice(0, 2)) {
      console.error(line.replace(/postgres(?:ql)?:\/\/\S+/g, '[connection redacted]'));
    }
    // Never echo arbitrary DB errors, connection strings, row values or SQL.
    throw new Error(`${bin.split('/').pop()} failed (exit ${result.status ?? 'unavailable'})`);
  }
  return result.stdout;
}
async function manifest(db) {
  const tables = await db.$queryRawUnsafe("SELECT tablename::text AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  if (!tables.length) throw new Error('Empty public schema');
  const rows = [];
  for (const { name } of tables) {
    const [result] = await db.$queryRawUnsafe(`SELECT count(*)::text AS rows, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS digest FROM public.${quote(name)} t`);
    rows.push({ name, ...result });
  }
  return rows;
}
let db;
try {
  const { PrismaClient } = await import('@prisma/client');
  if (mode === 'dump') {
    const url = process.env.BACKUP_DATABASE_URL;
    const env = backupConnection(url, { testSource });
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      const [principal] = await tx.$queryRawUnsafe('SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user');
      if (!principal?.rolbypassrls || principal.rolsuper || principal.rolcreaterole || principal.rolcreatedb || principal.rolreplication) throw new Error('Backup principal is not restricted');
      const [access] = await tx.$queryRawUnsafe("SELECT count(*) FILTER(WHERE has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER'))::int AS writable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'");
      if (access.writable !== 0) throw new Error('Backup principal has write access');
      const [{ token }] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot()::text AS token');
      const expected = await manifest(tx);
      run(process.env.PG_DUMP_BIN || 'pg_dump', ['--format=custom', '--schema=public', '--no-owner', '--no-privileges', `--snapshot=${token}`, '--file=dump.pgc'], env);
      await writeFile('backup-manifest.json', JSON.stringify(expected), { mode: 0o600 });
      console.log(`Consistent application backup captured: ${expected.length} tables; no source writes.`);
    }, { isolationLevel: 'RepeatableRead', timeout: 300000, maxWait: 10000 });
  } else if (mode === 'restore') {
    const url = process.env.SCRATCH_DATABASE_URL;
    const env = backupConnection(url, { scratch: true });
    const binary = process.env.PG_RESTORE_BIN || 'pg_restore';
    const plan = restorePlan(run(binary, ['--list', 'dump.pgc'], env));
    for (const name of plan.missingExtensions) run(process.env.PSQL_BIN || 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE EXTENSION IF NOT EXISTS ${quote(name)} WITH SCHEMA public`], env);
    await writeFile('restore-list.txt', plan.list, { mode: 0o600 });
    run(binary, [`--dbname=${env.PGDATABASE}`, '--no-owner', '--no-privileges', '--exit-on-error', '--use-list=restore-list.txt', 'dump.pgc'], env);
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$executeRawUnsafe("SET TIME ZONE 'UTC'");
    const expected = JSON.parse(await readFile('backup-manifest.json', 'utf8'));
    const actual = await manifest(db);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Restored table/row/digest parity failed');
    console.log(`Restore verified: all ${actual.length} application tables match source snapshot row counts and digests.`);
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `### Backup restore verified\n\n${actual.length} application tables: exact row counts and row digests match the same exported production snapshot. No raw rows or credentials are reported.\n\nScope: public application schema; Vercel configuration, Blob files, managed Supabase infrastructure and external side effects require their separate recovery paths.\n`, { flag: 'a' });
  } else throw new Error('Expected dump or restore');
} catch (error) {
  // Only errors created by this file are safe; Prisma errors may carry PII.
  const safe = error instanceof Error && error.constructor === Error && /^(Backup principal|Empty public|Restored table|Expected dump|pg_dump failed|pg_restore failed|psql failed|Dedicated canonical|Missing or invalid|Restore requires|Test backup|PostgreSQL connection)/.test(error.message);
  console.error(safe ? error.message : 'Backup/restore failed; inspect target, connectivity, privileges and scratch compatibility.');
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
