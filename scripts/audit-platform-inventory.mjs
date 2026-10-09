#!/usr/bin/env node
/**
 * Inventory discovery, not production-readiness evidence.
 * Filesystem-only: does not connect to DB, network, deployment or .env.
 * Usage: node scripts/audit-platform-inventory.mjs [--root path] [--out path]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function walk(dir, root) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, root);
    return entry.isFile() ? [path.relative(root, full).split(path.sep).join('/')] : [];
  });
}

function publicPath(file) {
  const segments = file.replace(/^src\/app\//, '').split('/');
  segments.pop();
  return '/' + segments.filter((segment) =>
    !/^\(.+\)$/.test(segment) && !segment.startsWith('@')
  ).join('/');
}

function area(file) {
  if (file.startsWith('src/app/api/')) return 'api';
  if (file.includes('/(admin)/') || file.startsWith('src/app/app/admin/')) return 'platform-admin';
  if (file.includes('/(public)/')) return 'public';
  const first = publicPath(file).split('/')[1] || 'home';
  if (['owner', 'mc', 'ops', 'provider', 'app'].includes(first)) return first;
  if (['auth', 'login', 'register'].includes(first)) return 'auth';
  return 'guest-or-shared';
}

export function inventory(root) {
  const all = walk(path.join(root, 'src'), root).sort();
  const routes = all.filter((file) => file.startsWith('src/app/') &&
    /\/(page\.[jt]sx?|route\.[jt]s)$/.test(file)).map((file) => ({
      path: publicPath(file),
      source: file,
      kind: /\/page\./.test(file) ? 'page' : 'handler',
      area: area(file),
    })).sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind) || a.source.localeCompare(b.source));
  const grouped = new Map();
  for (const route of routes) {
    const key = route.path;
    grouped.set(key, [...(grouped.get(key) || []), route.source]);
  }
  const collisions = [...grouped].filter(([, sources]) => sources.length > 1)
    .map(([route, sources]) => ({ route, sources }));
  const tests = all.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
  const modules = [...new Set(all.filter((file) => file.startsWith('src/modules/'))
    .map((file) => file.split('/')[2]).filter(Boolean))].sort().map((name) => ({
      name,
      files: all.filter((file) => file.startsWith('src/modules/' + name + '/')).length,
      testFiles: tests.filter((file) => file.startsWith('src/modules/' + name + '/')).length,
    }));
  const prismaFile = path.join(root, 'prisma/schema.prisma');
  const schema = fs.existsSync(prismaFile) ? fs.readFileSync(prismaFile, 'utf8') : '';
  const models = [...schema.matchAll(/^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)].map((m) => m[1]).sort();
  const enums = [...schema.matchAll(/^\s*enum\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)].map((m) => m[1]).sort();
  const migrations = walk(path.join(root, 'prisma/migrations'), root)
    .filter((file) => file.endsWith('/migration.sql')).sort();
  return {
    disclaimer: 'Static file discovery only. No authorization, caller reachability, functional testing, data migration or deployed runtime has been verified.',
    root: '.',
    summary: {
      pages: routes.filter((r) => r.kind === 'page').length,
      handlers: routes.filter((r) => r.kind === 'handler').length,
      apiHandlers: routes.filter((r) => r.source.startsWith('src/app/api/')).length,
      modules: modules.length,
      tests: tests.length,
      prismaModels: models.length,
      migrations: migrations.length,
      routeCollisions: collisions.length,
    },
    routes, collisions, modules, models, enums, migrations, tests,
  };
}

function cli(args) {
  let root = process.cwd();
  let out = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
    else if (args[i] === '--out' && args[i + 1]) out = path.resolve(args[++i]);
    else throw new Error('Usage: audit-platform-inventory.mjs [--root path] [--out path]');
  }
  const result = inventory(root);
  const report = JSON.stringify(result, null, 2) + '\n';
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, report, 'utf8');
    process.stdout.write(JSON.stringify({ output: out, summary: result.summary }) + '\n');
  } else process.stdout.write(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2));
}
