import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Refuse any non-disposable browser/database target before creating a client.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const report = { headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true, steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running' };
const contexts = [];
let browser;
let orderId;
async function step(name, page, fn) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try { await fn(); entry.status = 'passed'; await page.screenshot({ path: `browser-results/guest-ux-${report.steps.length}.png`, fullPage: true }); console.log(`PASS ${name}`); }
  catch (error) { entry.status = 'failed'; entry.error = String(error); throw error; }
  finally { await writeFile('browser-results/guest-ux-result.json', JSON.stringify(report, null, 2)); }
}
async function newContext(name) {
  const ctx = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block', hasTouch: true });
  contexts.push({ name, ctx }); ctx.setDefaultTimeout(15000);
  await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
  // Real localhost responses only; external requests are blocked, never mocked.
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
    report.blockedBrowserOrigins.push(url.origin); return route.abort('blockedbyclient');
  });
  ctx.on('page', page => {
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('response', response => { if (response.url().startsWith(baseUrl) && response.status() >= 500) report.serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  return ctx;
}
try {
  await mkdir('browser-results', { recursive: true });
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  browser = await chromium.launch({ headless: true });
  const anonymous = await newContext('guest-ux-anonymous'); const ap = await anonymous.newPage();
  await step('Emergency contacts stay anonymous, mobile and directly callable', ap, async () => {
    await ap.goto('/help/emergency');
    assert.equal(new URL(ap.url()).pathname, '/help/emergency');
    await ap.locator('h1').waitFor();
    assert.ok(await ap.locator('a[href^="tel:"]').count() >= 3);
    assert.equal((await anonymous.cookies()).some(cookie => cookie.name === 'auth-session'), false);
    assert.ok(await ap.locator('main').evaluate(node => node.scrollWidth <= window.innerWidth), 'No mobile horizontal overflow');
  });
  await step('Mobile gallery opens, navigates with keyboard, traps focus and restores trigger', ap, async () => {
    await ap.goto('/projects/synthetic-browser-estate');
    const trigger = ap.locator('button[aria-haspopup="dialog"]').first();
    await trigger.waitFor(); await trigger.click();
    const dialog = ap.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.evaluate(node => node.open), true);
    const before = await dialog.getByRole('status').innerText();
    await ap.keyboard.press('ArrowRight');
    await dialog.getByRole('status').filter({ hasText: '2 / 3' }).waitFor();
    assert.notEqual(await dialog.getByRole('status').innerText(), before);
    await ap.keyboard.press('ArrowLeft'); await dialog.getByRole('status').filter({ hasText: '1 / 3' }).waitFor();
    for (let i = 0; i < 5; i++) { await ap.keyboard.press('Tab'); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
    await ap.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  });
  const customer = await newContext('guest-ux-customer'); const cp = await customer.newPage();
  await step('Standalone customer authenticates without any property role or stay', cp, async () => {
    assert.equal(await db.roleAssignment.count({ where: { identityId: fixture.serviceCustomerId } }), 0);
    assert.equal(await db.booking.count({ where: { guestIdentityId: fixture.serviceCustomerId } }), 0);
    await cp.goto(`/login?next=${encodeURIComponent(`/services/${fixture.standaloneServiceId}`)}`);
    await cp.getByLabel(/^Email\s*\*?$/).fill(fixture.serviceCustomerEmail);
    await cp.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
    const response = cp.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
    await cp.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
    assert.equal((await response).status(), 200);
    await cp.waitForURL(url => url.pathname === `/services/${fixture.standaloneServiceId}`);
  });
  await step('Real standalone address order persists canonical scope and money without a payment', cp, async () => {
    await cp.getByLabel('Choose a service area', { exact: true }).selectOption(fixture.standaloneAreaSlug);
    await cp.getByLabel('Full address and arrival instructions', { exact: true }).fill('Synthetic test address 47, no real delivery');
    await cp.getByLabel('Recipient name', { exact: true }).fill('Synthetic Customer');
    await cp.getByLabel('Recipient phone', { exact: true }).fill('+66000000000');
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await cp.locator('#wizard-when').fill(`${date}T14:00`);
    const response = cp.waitForResponse(res => res.url().endsWith('/api/service-orders') && res.request().method() === 'POST');
    await cp.getByRole('button', { name: /Order.*฿500/ }).click();
    const created = await response; assert.equal(created.status(), 201);
    const body = await created.json(); orderId = body.order?.id; assert.ok(orderId);
    await cp.getByRole('heading', { name: 'Order placed — choose how to pay' }).waitFor();
    const persisted = await db.serviceOrder.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(persisted.project_id, null); assert.equal(persisted.unit_id, null); assert.equal(persisted.booking_id, null);
    assert.equal(persisted.orderer_identity_id, fixture.serviceCustomerId); assert.equal(persisted.total_thb, 50000);
    assert.equal(persisted.scheduled_start.toISOString(), `${date}T07:00:00.000Z`);
    assert.equal(persisted.service_context.responsibleOrganizationId, fixture.standaloneOrganizationId);
    assert.equal(await db.payment.count({ where: { serviceOrderId: orderId } }), 0);
    await cp.getByRole('button', { name: 'Cash on fulfilment', exact: true }).click();
    await cp.waitForURL(url => url.pathname === `/services/orders/${orderId}`);
    await cp.getByText('Synthetic test address 47, no real delivery', { exact: true }).waitFor();
    report.orderId = orderId;
  });
  await step('Standalone customer creates and reads support linked to own service order', cp, async () => {
    await cp.locator(`a[href="/tickets/new?serviceOrderId=${orderId}"]`).click();
    await cp.getByLabel('Subject', { exact: false }).fill('Synthetic standalone service support');
    await cp.getByLabel('Describe the issue', { exact: true }).fill('Acceptance-only question about this synthetic order.');
    const response = cp.waitForResponse(res => res.url().endsWith('/api/tickets') && res.request().method() === 'POST');
    await cp.getByRole('button', { name: 'Send request', exact: true }).click();
    const created = await response; assert.equal(created.status(), 201);
    const body = await created.json(); const ticketId = body.ticket?.id; assert.ok(ticketId);
    await cp.waitForURL(url => url.pathname === `/tickets/${ticketId}`);
    await cp.getByText('Synthetic standalone service support', { exact: true }).waitFor();
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    assert.equal(ticket.projectId, null); assert.equal(ticket.serviceOrderId, orderId);
    assert.equal(ticket.responsibleOrganizationId, fixture.standaloneOrganizationId);
    assert.equal((await cp.request.get(`/api/tickets/${ticketId}`)).status(), 200);
    report.ticketId = ticketId;
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = String(error); process.exitCode = 1; console.error(error);
  for (const { name, ctx } of contexts) for (const page of ctx.pages()) await page.screenshot({ path: `browser-results/failure-${name}.png`, fullPage: true }).catch(() => {});
} finally {
  for (const { name, ctx } of contexts) await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {});
  await writeFile('browser-results/guest-ux-result.json', JSON.stringify(report, null, 2));
  await browser?.close(); await db.$disconnect();
}
