import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

const base = 'http://127.0.0.1:3017';
const fixture = JSON.parse(readFileSync('/tmp/myuno-review-browser-fixture.json', 'utf8'));
const database = new URL(process.env.DATABASE_URL || 'invalid:');
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.port, '55439');
assert.equal(database.pathname, '/myuno_security_browser_test');
const db = new PrismaClient();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const checks = [];
const failures = [];
const record = (name, evidence) => { checks.push({ name, evidence }); console.log('PASS', name); };
mkdirSync('docs/evidence/security-local', { recursive: true });

async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: 'locale', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await ctx.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('dialog', dialog => dialog.accept());
  return { ctx, page };
}
async function login(page, email, password, next) {
  await page.goto(base + '/login?next=' + encodeURIComponent(next));
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.locator('form button[type=submit]').click();
  assert.equal((await response).status(), 200);
  await page.waitForURL(base + next);
}
async function status(request, method, path, data, expected) {
  const response = await request[method](base + path, data ? { data } : undefined);
  assert.equal(response.status(), expected, `${method} ${path}`);
  return response;
}
async function patchFromForm(page, form, button) {
  const response = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/people/'));
  await form.getByRole('button', { name: button, exact: true }).click();
  assert.equal((await response).status(), 200);
  await form.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
}

try {
  const manager = await context();
  const localPage = `/ops/spaces/${fixture.spaceId}/administration`;
  await login(manager.page, fixture.managerEmail, fixture.password, localPage);
  const form = manager.page.locator('form').filter({ hasText: 'Synthetic Employee' });
  await form.getByLabel('Name in this workspace').fill('Browser reception colleague');
  await patchFromForm(manager.page, form, 'Save');
  const local = await db.operatingSpaceMember.findUniqueOrThrow({ where: {
    operatingSpaceId_identityId: { operatingSpaceId: fixture.spaceId, identityId: fixture.employeeId },
  } });
  assert.equal(local.displayName, 'Browser reception colleague');
  record('Manager password login → local profile UI → PATCH → database → Saved', 'displayName persisted on selected membership only');
  await patchFromForm(manager.page, form, 'Disable access');
  assert.equal((await db.identity.findUniqueOrThrow({ where: { id: fixture.employeeId } })).status, 'active');
  assert.equal((await db.operatingSpaceMember.findUniqueOrThrow({ where: {
    operatingSpaceId_identityId: { operatingSpaceId: fixture.otherSpaceId, identityId: fixture.employeeId },
  } })).active, true);
  await manager.page.screenshot({ path: 'docs/evidence/security-local/local-member-management.png', fullPage: true });
  record('Local disable leaves global identity and other workspace active', 'database assertions; local member screenshot');
  for (const [method, path, data] of [
    ['get', `/api/ops/spaces/${fixture.otherSpaceId}/people`],
    ['patch', `/api/admin/people/${fixture.rootId}/manage`, { action: 'block' }],
    ['put', `/api/ops/spaces/${fixture.spaceId}/people/${fixture.employeeId}/administrator`, { enabled: true, expectedUpdatedAt: local.updatedAt.toISOString() }],
  ]) await status(manager.ctx.request, method, path, data, 403);
  record('Manager cannot reach another workspace, disable owner or appoint administrators', 'all three HTTP boundaries returned 403');

  const root = await context();
  await login(root.page, fixture.rootEmail, fixture.password, `/app/admin/people/${fixture.employeeId}`);
  const rootForm = root.page.locator('form').filter({ hasText: 'Synthetic Employee' });
  await rootForm.getByLabel('First name', { exact: true }).fill('BrowserUpdated');
  await patchFromForm(root.page, rootForm, 'Save');
  assert.equal((await db.identity.findUniqueOrThrow({ where: { id: fixture.employeeId } })).firstName, 'BrowserUpdated');
  await root.page.screenshot({ path: 'docs/evidence/security-local/global-profile-management.png', fullPage: true });
  record('Owner global profile UI → PATCH → database → Saved', 'firstName persisted; global editor screenshot');
  await status(root.ctx.request, 'patch', `/api/admin/people/${fixture.rootId}/manage`, { action: 'block' }, 403);
  await status(root.ctx.request, 'patch', `/api/admin/people/${fixture.employeeId}/manage`, { action: ['unblock'] }, 400);
  assert.equal(await db.identity.count({ where: { isSuperAdmin: true, status: 'active' } }), 1);
  record('Owner cannot self-disable; malformed action denied', '403, 400, exactly one active owner');

  const inviteBody = { email: 'invitee@browser.example.test', firstName: 'Synthetic', lastName: 'Invitee', preferredLocale: 'en', destination: 'property' };
  const invited = await (await status(root.ctx.request, 'post', '/api/admin/people/invite', inviteBody, 201)).json();
  assert.equal(invited.emailStatus, 'unavailable');
  const reused = await (await status(root.ctx.request, 'post', '/api/admin/people/invite', inviteBody, 200)).json();
  assert.equal(reused.identity.id, invited.identity.id); assert.equal(reused.created, false);
  const recipient = await context();
  const chosenPassword = crypto.randomBytes(24).toString('base64url');
  await recipient.page.goto(reused.claimUrl);
  await recipient.page.locator('#claim-password').fill(chosenPassword);
  await recipient.page.locator('#claim-confirm').fill(chosenPassword);
  const claimResponse = recipient.page.waitForResponse(r => r.url().endsWith('/api/auth/claim') && r.request().method() === 'POST');
  const autoLogin = recipient.page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await recipient.page.locator('form button[type=submit]').click();
  assert.equal((await claimResponse).status(), 200); assert.equal((await autoLogin).status(), 200);
  const activeReuse = await (await status(root.ctx.request, 'post', '/api/admin/people/invite', inviteBody, 200)).json();
  assert.equal(activeReuse.alreadyActive, true); assert.equal(activeReuse.claimUrl, null);
  await status(root.ctx.request, 'put', `/api/ops/spaces/${fixture.spaceId}/people/${invited.identity.id}/administrator`,
    { enabled: true, expectedUpdatedAt: null }, 200);
  const me = await (await status(recipient.ctx.request, 'get', '/api/auth/me', undefined, 200)).json();
  assert.equal(me.isAdmin, false); assert.equal(me.isSuperAdmin, false);
  await recipient.page.goto(base + localPage);
  await recipient.page.getByRole('heading', { name: /Account management/ }).waitFor();
  record('Invitation reuse → recipient password claim → automatic login → scoped appointment', 'same identity reused; active invite sends no claim; global flags remain false');
  record('Email delivery explicitly unverified', 'mail transport disabled in isolated environment; emailStatus unavailable');

  await root.page.goto(base + `/app/admin/people/${fixture.managerId}`);
  const managerForm = root.page.locator('form').filter({ hasText: 'Synthetic Manager' });
  await patchFromForm(root.page, managerForm, 'Disable access');
  await status(manager.ctx.request, 'get', '/api/auth/me', undefined, 401);
  await patchFromForm(root.page, managerForm, 'Restore access');
  await status(manager.ctx.request, 'get', '/api/auth/me', undefined, 401);
  await login(manager.page, fixture.managerEmail, fixture.password, localPage);
  const roster = await (await status(root.ctx.request, 'get', `/api/ops/spaces/${fixture.spaceId}/people`, undefined, 200)).json();
  const currentGrant = roster.members.find(m => m.identityId === fixture.managerId);
  await status(root.ctx.request, 'put', `/api/ops/spaces/${fixture.spaceId}/people/${fixture.managerId}/administrator`,
    { enabled: false, expectedUpdatedAt: currentGrant.updatedAt }, 200);
  await status(manager.ctx.request, 'get', `/api/ops/spaces/${fixture.spaceId}/people`, undefined, 403);
  record('Global block ends session; unblock does not revive old cookie; local role revocation is immediate', '401 after block and restore; fresh login succeeds; 403 after local revocation');

  const refreshed = await db.operatingSpaceMember.findUniqueOrThrow({ where: { id: currentGrant.id } });
  await status(root.ctx.request, 'put', `/api/ops/spaces/${fixture.spaceId}/people/${fixture.managerId}/administrator`,
    { enabled: true, expectedUpdatedAt: refreshed.updatedAt.toISOString() }, 200);
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: fixture.otherSpaceId, unitId: fixture.unitId, startsOn: new Date(0) } });
  await manager.page.goto(base + `/ops/spaces/${fixture.spaceId}`);
  await manager.page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
  assert.equal(await manager.page.getByText('Isolated review villa', { exact: true }).count(), 0);
  record('Shared physical inventory fails closed without displaying false availability', 'server notFound boundary renders; no unit data (streamed HTTP may be 200)');
  assert.equal(failures.length, 0, 'Browser page errors must be resolved');
  writeFileSync('docs/evidence/security-local/browser-results.json', JSON.stringify({ baseRevision: 'aa696a66 plus reviewed local fixes',
    environment: 'isolated local PostgreSQL and Next dev; synthetic users only', checks, pageErrors: failures }, null, 2));
} catch (error) {
  console.error('Browser verification stopped at first broken boundary:', error.message);
  writeFileSync('/tmp/myuno-review-browser-failure.json', JSON.stringify({ completed: checks, pageErrors: failures,
    error: error.message }, null, 2));
  process.exitCode = 1;
} finally { await browser.close(); await db.$disconnect(); }
