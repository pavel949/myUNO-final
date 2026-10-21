import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const previous = JSON.parse(await readFile('browser-results/guest-ux-result.json', 'utf8'));
assert.equal(previous.result, 'passed');
assert.ok(previous.orderId, 'Requires the preceding real standalone order journey');
const report = { headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  result: 'running', steps: [], pageErrors: [], serverErrors: [], blockedBrowserOrigins: [],
  limits: ['Disposable database and localhost only. Real API cash records are synthetic, no merchant or outbound delivery.',
    'Admin fulfils the existing synthetic provider order; provider-member permissions and races are covered separately by PostgreSQL integration tests.'] };
const contexts = [];
let browser;
async function persist() { await writeFile('browser-results/service-fulfilment-result.json', JSON.stringify(report, null, 2)); }
async function step(name, page, fn) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try { await fn(); entry.status = 'passed'; await page.screenshot({ caret: 'initial', path: `browser-results/service-fulfilment-${report.steps.length}.png`, fullPage: true }); console.log(`PASS ${name}`); }
  catch (error) { entry.status = 'failed'; entry.error = String(error); throw error; }
  finally { await persist(); }
}
async function page() {
  const ctx = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block', hasTouch: true });
  contexts.push(ctx); ctx.setDefaultTimeout(15000);
  await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
    report.blockedBrowserOrigins.push(url.origin); return route.abort('blockedbyclient');
  });
  const p = await ctx.newPage();
  p.on('pageerror', error => report.pageErrors.push(String(error)));
  p.on('response', res => { if (new URL(res.url()).origin === baseUrl && res.status() >= 500) report.serverErrors.push(`${res.status()} ${new URL(res.url()).pathname}`); });
  return p;
}
async function login(p, email) {
  await p.goto('/login?next=%2Fservices%2Forders');
  await p.getByLabel(/^Email\s*\*?$/).fill(email);
  await p.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = p.waitForResponse(res => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST');
  await p.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await response).status(), 200);
  await p.waitForURL(url => url.pathname === '/services/orders');
}
async function post(p, path, data = {}, status = 200) {
  const response = await p.request.post(path, { data });
  assert.equal(response.status(), status, `${path}: unexpected HTTP ${response.status()}`);
  return response.json();
}
async function fulfil(p, id) {
  await post(p, `/api/service-orders/${id}/record-cash-payment`, { receiptRef: `SYNTHETIC-BROWSER-${id}` });
  await post(p, `/api/service-orders/${id}/accept`);
  await post(p, `/api/service-orders/${id}/fulfil`);
  const order = await db.serviceOrder.findUniqueOrThrow({ where: { id } });
  assert.equal(order.status, 'fulfilled'); assert.ok(order.fulfilled_at);
  assert.equal(await db.ledgerEntry.count({ where: { serviceOrderId: id, entryType: 'service_commission' } }), 1);
  return order;
}
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  browser = await chromium.launch({ headless: true });
  const customer = await page(); const admin = await page();
  await step('Authenticate actual synthetic customer and admin sessions', customer, async () => {
    await login(customer, fixture.serviceCustomerEmail); await login(admin, fixture.founderEmail);
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: previous.orderId } });
    assert.equal(order.status, 'placed'); assert.equal(order.orderer_identity_id, fixture.serviceCustomerId);
  });
  const id = previous.orderId;
  let fulfilled;
  await step('Real cash, acceptance and fulfilment routes create one paid canonical order', customer, async () => {
    fulfilled = await fulfil(admin, id);
    await customer.goto(`/services/orders/${id}`);
    await customer.getByText('Confirmation or dispute deadline', { exact: true }).waitFor();
    await customer.getByRole('button', { name: 'Confirm service completed', exact: true }).waitFor();
    assert.equal(await customer.getByText('Paid', { exact: true }).count() > 0, true);
    assert.ok(await customer.locator('main').evaluate(node => node.scrollWidth <= window.innerWidth), 'Mobile order page fits viewport');
    assert.equal((await admin.request.post(`/api/service-orders/${id}/confirm`)).status(), 403, 'Admin cannot confirm as the customer');
  });
  await step('Customer confirms in UI; refresh and duplicate acknowledgement preserve money', customer, async () => {
    const before = await db.ledgerEntry.count({ where: { serviceOrderId: id } });
    const response = customer.waitForResponse(res => new URL(res.url()).pathname === `/api/service-orders/${id}/confirm`);
    await customer.getByRole('button', { name: 'Confirm service completed', exact: true }).click();
    assert.equal((await response).status(), 200);
    await customer.getByText('Closed', { exact: true }).waitFor();
    assert.equal(await customer.getByRole('button', { name: 'Confirm service completed', exact: true }).count(), 0);
    await customer.getByRole('button', { name: 'Rate this service', exact: true }).waitFor();
    await post(customer, `/api/service-orders/${id}/confirm`);
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id } });
    assert.equal(order.closed_by_identity_id, fixture.serviceCustomerId);
    assert.equal(order.fulfilled_at.toISOString(), fulfilled.fulfilled_at.toISOString());
    assert.equal(await db.ledgerEntry.count({ where: { serviceOrderId: id } }), before);
    assert.equal(await db.payment.count({ where: { serviceOrderId: id } }), 1);
    await post(customer, '/api/disputes', { subjectType: 'service_order', subjectId: id, title: 'After confirmation', description: 'Synthetic rejected request' }, 409);
  });
  let disputedId;
  await step('New fulfilled order exposes a customer dispute and removes confirmation after refresh', customer, async () => {
    const original = await db.serviceOrder.findUniqueOrThrow({ where: { id } });
    const created = await post(customer, '/api/service-orders', { serviceId: fixture.standaloneServiceId, serviceContext: original.service_context, scheduledStart: new Date(Date.now() + 8 * 86400000).toISOString(), quantity: 1 }, 201);
    disputedId = created.order.id;
    await fulfil(admin, disputedId);
    await customer.goto(`/services/orders/${disputedId}`);
    await customer.getByRole('button', { name: 'Raise a dispute', exact: true }).click();
    await customer.locator('#order-dispute-title').fill('Synthetic incomplete service');
    await customer.locator('#order-dispute-description').fill('The synthetic agreed work is incomplete. No real service was delivered.');
    const response = customer.waitForResponse(res => new URL(res.url()).pathname === '/api/disputes' && res.request().method() === 'POST');
    await customer.getByRole('button', { name: 'Submit dispute', exact: true }).click();
    assert.equal((await response).status(), 201);
    await customer.getByRole('link', { name: 'View the ticket', exact: true }).waitFor();
    assert.equal(await customer.getByRole('button', { name: 'Confirm service completed', exact: true }).count(), 0);
    assert.equal((await customer.request.post(`/api/service-orders/${disputedId}/confirm`)).status(), 409);
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: disputedId } });
    assert.equal(order.status, 'fulfilled'); assert.equal(order.closed_at, null);
    assert.equal(await db.dispute.count({ where: { subjectType: 'service_order', subjectId: disputedId, decidedAt: null } }), 1);
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.orderId = id; report.disputedOrderId = disputedId; report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); process.exitCode = 1; console.error(error); }
finally { await persist(); await Promise.all(contexts.map(ctx => ctx.close().catch(() => {}))); await browser?.close(); await db.$disconnect(); }
