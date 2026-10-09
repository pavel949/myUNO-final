import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory } from './audit-platform-inventory.mjs';

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myuno-inventory-'));
  const add = (name, body = '') => {
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, body, 'utf8');
  };
  try { run({ root, add }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('discovers routes, group-free URLs, domains, models and migration files', () => withFixture(({ root, add }) => {
  add('src/app/(public)/page.tsx');
  add('src/app/(public)/projects/[slug]/page.tsx');
  add('src/app/(admin)/app/admin/units/page.tsx');
  add('src/app/api/bookings/[id]/route.ts');
  add('src/modules/booking/booking.service.ts');
  add('src/modules/booking/booking.test.ts');
  add('src/modules/core/core.ts');
  add('prisma/schema.prisma', 'model Project {\n id String @id\n}\nenum Status {\n active\n}');
  add('prisma/migrations/20260929000000_init/migration.sql');
  const report = inventory(root);
  assert.deepEqual(report.summary, {
    pages: 3, handlers: 1, apiHandlers: 1, modules: 2,
    tests: 1, prismaModels: 1, migrations: 1, routeCollisions: 0,
  });
  assert.ok(report.routes.some((r) => r.path === '/' && r.area === 'public'));
  assert.ok(report.routes.some((r) => r.path === '/projects/[slug]'));
  assert.ok(report.routes.some((r) => r.path === '/app/admin/units' && r.area === 'platform-admin'));
  assert.ok(report.routes.some((r) => r.path === '/api/bookings/[id]' && r.kind === 'handler'));
  assert.deepEqual(report.models, ['Project']);
  assert.deepEqual(report.enums, ['Status']);
  assert.equal(report.modules.find((m) => m.name === 'booking').testFiles, 1);
}));

test('reports normalized URL collisions instead of treating files as separate public pages', () => withFixture(({ root, add }) => {
  add('src/app/(public)/search/page.tsx');
  add('src/app/(alternate)/search/page.tsx');
  const report = inventory(root);
  assert.equal(report.summary.routeCollisions, 1);
  assert.equal(report.collisions[0].route, '/search');
  assert.equal(report.collisions[0].sources.length, 2);
}));

test('empty sources yield no fabricated evidence', () => withFixture(({ root }) => {
  const report = inventory(root);
  assert.equal(report.summary.pages, 0);
  assert.equal(report.summary.prismaModels, 0);
  assert.match(report.disclaimer, /No authorization/);
}));

test('CLI writes the requested inventory on the current platform', () => withFixture(({ root, add }) => {
  add('src/app/(public)/page.tsx');
  const output = path.join(root, 'inventory.json');
  const cli = fileURLToPath(new URL('./audit-platform-inventory.mjs', import.meta.url));
  const response = execFileSync(process.execPath, [cli, '--root', root, '--out', output], {
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(response).summary.pages, 1);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).summary.pages, 1);
}));
