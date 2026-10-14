import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const out = 'browser-results';
const report = { testedCommit: process.env.GITHUB_SHA || null, headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], blockedBrowserOrigins: [], serverErrors: [], pageErrors: [], result: 'running' };
const contexts = [];
let browser;
let booking;
let quote;
const description = 'Synthetic acceptance villa: quiet bedroom, private terrace, verified browser save.';
const dates = new URLSearchParams({ startDate: fixture.startDate, endDate: fixture.endDate, adults: '2', children: '0' });
const unitUrl = `/units/${fixture.unitId}?${dates}`;
const calendarUrl = `/ops/calendar/board?${new URLSearchParams({ projectId: fixture.projectId, unitId: fixture.unitId, start: fixture.startDate, days: '7' })}`;
const body = page => page.locator('body').innerText();
async function poll(fn, message) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 150)); }
  assert.fail(message);
}
async function step(name, page, fn) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try {
    await fn(); entry.status = 'passed';
    if (page) await page.screenshot({ path: `${out}/${String(report.steps.length).padStart(2, '0')}.png`, fullPage: true });
    console.log(`PASS ${name}`);
  } catch (error) { entry.status = 'failed'; entry.error = String(error); throw error; }
  finally { await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2)); }
}
async function context(name) {
  const ctx = await browser.newContext({ baseURL: baseUrl, locale: 'en-US', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  contexts.push({ ctx, name });
  ctx.setDefaultTimeout(15000);
  ctx.setDefaultNavigationTimeout(30000);
  // Locale preference only. Authentication must come from the real login form.
  await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
    if (!report.blockedBrowserOrigins.includes(url.origin)) report.blockedBrowserOrigins.push(url.origin);
    return route.abort('blockedbyclient');
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  ctx.on('page', page => {
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('response', response => {
      if (response.url().startsWith(baseUrl) && response.status() >= 500) report.serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
  });
  return ctx;
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  response.catch(() => {});
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.waitForURL(url => url.pathname === next);
  const session = (await page.context().cookies()).find(c => c.name === 'auth-session');
  assert.ok(session?.httpOnly && session.sameSite === 'Lax', 'Real HttpOnly browser session must be issued');
  assert.equal(session.secure, true, 'Production server session must be Secure');
  assert.equal((await page.request.get('/api/auth/me')).status(), 200, 'Browser must round-trip the issued cookie');
}
async function publicQuote(page) {
  const res = await page.request.post('/api/pricing/breakdown', { data: { unitId: fixture.unitId, startDate: fixture.startDate, endDate: fixture.endDate, guestCount: 2 } });
  assert.equal(res.status(), 200); return res.json();
}
try {
  await mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const founder = await context('founder'); const fp = await founder.newPage();
  const guest = await context('guest'); const gp = await guest.newPage();
  const anonymous = await context('anonymous'); const ap = await anonymous.newPage();

  await step('Draft is private before any founder mutation', ap, async () => {
    assert.equal((await ap.request.get(`/api/units/${fixture.unitId}`)).status(), 404);
    await ap.goto(`/app/admin/units/${fixture.unitId}`);
    await ap.waitForURL(/\/login\?/);
    assert.ok(!(await body(ap)).includes(fixture.unitName));
  });
  await step('Founder signs in through the real browser form', fp, () => login(fp, fixture.founderEmail, `/app/admin/units/${fixture.unitId}`));
  await step('Description deep link saves by content ID and survives reload', fp, async () => {
    await fp.getByRole('link', { name: /Edit description/ }).click();
    await fp.waitForURL(url => url.pathname === '/app/admin/content' && url.searchParams.get('key') === fixture.descriptionKey);
    await fp.getByText(fixture.descriptionKey, { exact: true }).waitFor();
    // The focused editor renders the established ru,en,th,zh column order.
    const english = fp.locator('textarea').nth(1);
    await english.fill(description);
    const saveResponse = fp.waitForResponse(r => r.url().endsWith(`/api/admin/content/${fixture.contentId}`) && r.request().method() === 'PUT');
    saveResponse.catch(() => {});
    await english.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
    const saved = await saveResponse;
    assert.equal(saved.status(), 200);
    const result = await saved.json(); assert.equal(result.success, true); assert.equal(result.key.id, fixture.contentId);
    await fp.reload(); await english.waitFor(); assert.equal(await english.inputValue(), description);
    assert.equal((await db.translation.findFirstOrThrow({ where: { contentKeyId: fixture.contentId, locale: 'en' } })).value, description);
  });
  await step('Founder saves real nightly tariff, then reloads it', fp, async () => {
    await fp.goto(`/app/admin/units/${fixture.unitId}`);
    await fp.getByRole('link', { name: /Edit rates and booking rules/ }).click();
    const rates = fp.getByRole('region', { name: 'Rates and seasons' });
    await rates.getByRole('button', { name: 'Add season', exact: true }).first().click();
    await rates.getByLabel('Season code', { exact: true }).fill('ALL_YEAR');
    await rates.getByLabel('From', { exact: true }).fill('01-01');
    await rates.getByLabel('To', { exact: true }).fill('12-31');
    await rates.getByLabel('THB per night', { exact: true }).fill('1234');
    await rates.getByLabel('Min. nights', { exact: true }).fill('1');
    await rates.getByLabel('Price includes taxes (VAT)', { exact: true }).check();
    await rates.getByLabel('Price includes service charge', { exact: true }).check();
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/admin/units/${fixture.unitId}/tariff`) && r.request().method() === 'PUT');
    response.catch(() => {});
    await rates.getByRole('button', { name: 'Save for this villa', exact: true }).click();
    assert.equal((await response).status(), 200);
    await rates.getByText('Saved for 1 villa(s). New quotes use these rates now.', { exact: true }).waitFor();
    await fp.reload(); await rates.getByLabel('THB per night', { exact: true }).waitFor();
    assert.equal(await rates.getByLabel('THB per night', { exact: true }).inputValue(), '1234');
    const saved = await db.commercialOffering.findFirstOrThrow({ where: { unitId: fixture.unitId, offeringType: 'short_term_stay' } });
    assert.equal(saved.pricingTerms.tariffGrid[0].amountSatang, 123400);
  });
  await step('Publication action confirms persisted live state and public link', fp, async () => {
    await fp.goto('/app/admin/units');
    const row = fp.locator('div.flex.flex-col.lg\\:flex-row').filter({ has: fp.getByRole('link', { name: fixture.unitName, exact: true }) });
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/admin/units/${fixture.unitId}`) && r.request().method() === 'PUT');
    response.catch(() => {});
    await row.getByRole('button', { name: 'Set live', exact: true }).click();
    const saved = await response; assert.equal(saved.status(), 200); assert.equal((await saved.json()).status, 'live');
    await fp.getByRole('status').filter({ hasText: `${fixture.unitName} is set to live.` }).waitFor();
    await fp.getByRole('link', { name: /Review publication and bookings/ }).click();
    const publicLink = fp.getByRole('link', { name: /View public listing/ });
    await publicLink.waitFor();
    assert.equal(await publicLink.getAttribute('href'), `/units/${fixture.unitId}`);
    assert.equal((await db.unit.findUniqueOrThrow({ where: { id: fixture.unitId } })).status, 'live');
  });
  await step('Anonymous guest card shows saved description and exact tariff quote', ap, async () => {
    await ap.goto(unitUrl);
    await ap.getByText(description, { exact: true }).waitFor();
    await ap.getByRole('button', { name: 'Reserve', exact: true }).first().waitFor();
    quote = await publicQuote(ap);
    assert.equal(quote.isAvailable, true); assert.equal(quote.nights, 3); assert.equal(quote.subtotal, 3702);
    assert.equal(quote.acceptedTotalSatang, 370200);
    await poll(async () => /3,702/.test(await body(ap)), 'Guest did not see the edited tariff total');
  });
  await step('Guest signs in and is denied the founder workspace', gp, async () => {
    await login(gp, fixture.guestEmail, '/trips');
    await gp.goto(`/app/admin/units/${fixture.unitId}`); await gp.waitForURL(url => url.pathname === '/');
    assert.equal((await gp.request.get(`/api/admin/content/${fixture.contentId}`)).status(), 403);
  });
  await step('Guest books through card → review → consent → cash confirmation', gp, async () => {
    await gp.goto(unitUrl);
    await gp.getByRole('button', { name: 'Reserve', exact: true }).first().click();
    await gp.waitForURL(url => url.pathname === '/book/review' && url.searchParams.has('bookingIntent'));
    await poll(async () => /3,702/.test(await body(gp)), 'Review quote did not finish loading');
    await gp.locator('main input[type=checkbox]').check();
    await gp.locator('select').filter({ hasText: 'Cash on arrival' }).selectOption('cash');
    const response = gp.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    response.catch(() => {});
    await gp.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    assert.equal((await response).status(), 201);
    await gp.waitForURL(/\/trips(?:\/|$)/);
    const bookings = await db.booking.findMany({ where: { unitId: fixture.unitId, guestIdentityId: fixture.guestId } });
    assert.equal(bookings.length, 1); booking = bookings[0];
    assert.equal(booking.status, 'pending_payment'); assert.equal(booking.paymentMethod, 'cash');
    assert.equal(booking.totalThb, quote.acceptedTotalSatang);
    assert.equal(booking.startDate.toISOString().slice(0, 10), fixture.startDate);
    assert.equal(booking.endDate.toISOString().slice(0, 10), fixture.endDate);
    assert.ok(booking.holdExpiresAt && booking.holdExpiresAt.getTime() - Date.now() > 23 * 3600000);
    assert.equal(await db.payment.count({ where: { bookingId: booking.id } }), 0, 'No payment provider used');
    await gp.goto(`/trips/${booking.id}`); await gp.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    await gp.reload(); await gp.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId, guestIdentityId: fixture.guestId } }), 1, 'Reload must not create another booking');
  });
  await step('Founder calendar resolves held night to the same canonical booking', fp, async () => {
    await fp.goto(calendarUrl);
    const cell = fp.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.startDate} ·`) });
    await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), /Hold/i);
    await cell.click();
    const detail = fp.getByRole('region', { name: 'Night details' });
    await detail.getByRole('link', { name: /Open canonical stay/ }).waitFor();
    assert.equal(await detail.getByRole('link', { name: /Open canonical stay/ }).getAttribute('href'), `/ops/stays/${booking.id}`);
    assert.match(await detail.innerText(), /Synthetic Guest/);
    await fp.getByRole('button', { name: 'Close details' }).click();
    await detail.waitFor({ state: 'detached' });
    assert.equal((await publicQuote(ap)).isAvailable, false, 'The booking must actually block these dates');
  });
  await step('Cancellation through guest UI releases the dates and calendar hold', gp, async () => {
    gp.once('dialog', dialog => dialog.accept());
    const response = gp.waitForResponse(r => r.url().endsWith(`/api/bookings/${booking.id}/cancel`) && r.request().method() === 'POST');
    response.catch(() => {});
    await gp.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    assert.equal((await response).status(), 200);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, 'cancelled');
    assert.equal((await publicQuote(ap)).isAvailable, true);
    await fp.goto(calendarUrl);
    const cell = fp.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.startDate} ·`) });
    await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), /Available/);
    await cell.click(); await fp.getByText('No reservation or closure for this date.', { exact: true }).waitFor();
    await fp.screenshot({ path: `${out}/calendar-released.png`, fullPage: true });
  });
  await step('Founder records a manual reservation through the operational desk', fp, async () => {
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId, channel: 'manual' } }), 0);
    await fp.goto(`/ops/reservations?${new URLSearchParams({ spaceId: fixture.operatingSpaceId })}`);
    const form = fp.locator('form').filter({ has: fp.getByRole('heading', { name: 'Create reservation', exact: true }) });
    await form.locator('select[name=unitId]').selectOption(fixture.unitId);
    await form.locator('select[name=guestIdentityId]').selectOption(fixture.guestId);
    await form.getByLabel('Check-in', { exact: true }).fill(fixture.manualStartDate);
    await form.getByLabel('Check-out', { exact: true }).fill(fixture.manualEndDate);
    await form.getByLabel('Adults', { exact: true }).fill('2');
    await form.getByLabel('Children', { exact: true }).fill('0');
    await form.getByLabel('Pets', { exact: true }).fill('0');
    await form.getByPlaceholder('Notes', { exact: true }).fill('Synthetic founder-entered reservation.');
    const response = fp.waitForResponse(r => r.url().endsWith('/api/ops/reservations') && r.request().method() === 'POST');
    response.catch(() => {});
    await form.getByRole('button', { name: 'Create reservation', exact: true }).click();
    const saved = await response;
    assert.equal(saved.status(), 201);
    const result = await saved.json();
    const reservations = await db.booking.findMany({ where: { unitId: fixture.unitId, channel: 'manual' } });
    assert.equal(reservations.length, 1, 'One form submission must create exactly one canonical manual booking');
    const reservation = reservations[0];
    assert.equal(reservation.id, result.booking?.id);
    assert.equal(reservation.guestIdentityId, fixture.guestId);
    assert.equal(reservation.startDate.toISOString().slice(0, 10), fixture.manualStartDate);
    assert.equal(reservation.endDate.toISOString().slice(0, 10), fixture.manualEndDate);
    assert.equal(reservation.totalThb, 370200, 'Manual reservation must use the saved 1234 THB nightly tariff');
    assert.equal(reservation.status, 'pending_payment');
    assert.equal(reservation.paymentMethod, null, 'Manual desk does not record a payment method');
    assert.ok(reservation.holdExpiresAt && reservation.holdExpiresAt.getTime() > Date.now());
    assert.equal(await db.payment.count({ where: { bookingId: reservation.id } }), 0);
    report.manualReservation = { bookingId: reservation.id, status: reservation.status, totalSatang: reservation.totalThb, startDate: fixture.manualStartDate, endDate: fixture.manualEndDate, persisted: true };
    await fp.screenshot({ path: `${out}/manual-reservation-after-submit.png`, fullPage: true });

    // Inspect the persisted hold in a second real page so a stuck submission
    // form is preserved for diagnosis rather than repaired by navigation.
    const calendar = await founder.newPage();
    try {
      await calendar.goto(`/ops/calendar/board?${new URLSearchParams({ projectId: fixture.projectId, unitId: fixture.unitId, start: fixture.manualStartDate, days: '7' })}`);
      const cell = calendar.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.manualStartDate} ·`) });
      await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), /Hold/i);
      await cell.click();
      const detail = calendar.getByRole('region', { name: 'Night details' });
      const stay = detail.getByRole('link', { name: /Open canonical stay/ });
      await stay.waitFor();
      assert.equal(await stay.getAttribute('href'), `/ops/stays/${reservation.id}`);
      await calendar.screenshot({ path: `${out}/manual-calendar-held.png`, fullPage: true });
      report.manualReservation.calendarVerified = true;
    } finally { await calendar.close(); }

    await poll(async () => {
      const submit = form.getByRole('button', { name: 'Create reservation', exact: true });
      return await submit.count() === 1 && await submit.isEnabled()
        && await form.locator('select[name=unitId]').inputValue() === ''
        && await form.locator('select[name=guestIdentityId]').inputValue() === ''
        && await form.getByLabel('Check-in', { exact: true }).inputValue() === ''
        && await form.getByPlaceholder('Notes', { exact: true }).inputValue() === '';
    }, 'Reservation committed, but the manual form stayed busy or failed to reset');
    const row = fp.locator('article').filter({ has: fp.locator(`a[href="/ops/stays/${reservation.id}"]`) });
    await row.waitFor();
    assert.match(await row.innerText(), /Synthetic Guest/);
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId, channel: 'manual' } }), 1);
    report.manualReservation.formVerified = true;
  });
  assert.deepEqual(report.serverErrors, [], 'Unexpected local 5xx responses');
  assert.deepEqual(report.pageErrors, [], 'Unexpected browser runtime errors');
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1;
  for (const { ctx, name } of contexts) for (const [i, page] of ctx.pages().entries()) await page.screenshot({ path: `${out}/failure-${name}-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  for (const { ctx, name } of contexts) await ctx.tracing.stop({ path: `${out}/trace-${name}.zip` }).catch(() => {});
  await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2));
  await browser?.close(); await db.$disconnect();
}
