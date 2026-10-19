import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const out = 'browser-results';
const report = { testedCommit: process.env.GITHUB_SHA || null, headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true, browserTimeZone: 'Asia/Bangkok',
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
    if (page) await page.screenshot({ caret: 'initial', path: `${out}/${String(report.steps.length).padStart(2, '0')}.png`, fullPage: true });
    console.log(`PASS ${name}`);
  } catch (error) { entry.status = 'failed'; entry.error = String(error); throw error; }
  finally { await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2)); }
}
async function context(name, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ baseURL: baseUrl, locale: 'en-US', timezoneId: 'Asia/Bangkok', viewport, serviceWorkers: 'block' });
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
    await fp.screenshot({ caret: 'initial', path: `${out}/calendar-released.png`, fullPage: true });
  });
  await step('Founder records a manual reservation through the operational desk', fp, async () => {
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId, channel: 'manual' } }), 0);
    await fp.goto(`/ops/reservations?${new URLSearchParams({ spaceId: fixture.operatingSpaceId })}`);
    const form = fp.locator('form').filter({ has: fp.getByRole('heading', { name: 'Create reservation', exact: true }) });
    await form.locator('select[name=unitId]').selectOption(fixture.unitId);
    await form.getByLabel('Check-in', { exact: true }).fill(fixture.manualStartDate);
    await form.getByLabel('Check-out', { exact: true }).fill(fixture.manualEndDate);
    await form.getByLabel('Adults', { exact: true }).fill('2');
    await form.getByLabel('Children', { exact: true }).fill('0');
    await form.getByLabel('Pets', { exact: true }).fill('0');
    await form.getByPlaceholder('Notes', { exact: true }).fill('Synthetic founder-entered reservation.');
    await form.getByRole('button', { name: 'Add a new guest', exact: true }).click();
    const contactForm = fp.getByRole('form', { name: 'Add a new guest', exact: true });
    await contactForm.getByLabel('First name', { exact: true }).fill('Manual');
    await contactForm.getByLabel('Last name', { exact: true }).fill('Guest');
    await contactForm.getByLabel('Email (optional if phone provided)', { exact: true }).fill(`manual-${fixture.unitId}@example.test`);
    const contactResponse = fp.waitForResponse(r => r.url().endsWith('/api/ops/reservation-guests') && r.request().method() === 'POST');
    contactResponse.catch(() => {});
    await contactForm.getByRole('button', { name: 'Save guest', exact: true }).click();
    const savedContact = await contactResponse;
    assert.equal(savedContact.status(), 201);
    const contact = (await savedContact.json()).guest;
    await poll(async () => await form.locator('select[name=guestIdentityId]').inputValue() === contact.id, 'New guest was not selected');
    assert.equal(await form.getByLabel('Check-in', { exact: true }).inputValue(), fixture.manualStartDate);
    assert.equal(await form.getByPlaceholder('Notes', { exact: true }).inputValue(), 'Synthetic founder-entered reservation.');
    assert.equal(await db.authAccount.count({ where: { identityId: contact.id } }), 0);
    assert.equal(await db.roleAssignment.count({ where: { identityId: contact.id } }), 0);
    assert.equal(await db.oneTimeToken.count({ where: { identityId: contact.id } }), 0);
    report.manualGuest = { id: contact.id, contactOnly: true, roles: 0, tokens: 0, registrationNotRequired: true };

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
    assert.equal(reservation.guestIdentityId, contact.id);
    assert.equal(reservation.startDate.toISOString().slice(0, 10), fixture.manualStartDate);
    assert.equal(reservation.endDate.toISOString().slice(0, 10), fixture.manualEndDate);
    assert.equal(reservation.totalThb, 370200, 'Manual reservation must use the saved 1234 THB nightly tariff');
    assert.equal(reservation.status, 'pending_payment');
    assert.equal(reservation.paymentMethod, null, 'Manual desk does not record a payment method');
    assert.ok(reservation.holdExpiresAt && reservation.holdExpiresAt.getTime() > Date.now());
    assert.equal(await db.payment.count({ where: { bookingId: reservation.id } }), 0);
    report.manualReservation = { bookingId: reservation.id, status: reservation.status, totalSatang: reservation.totalThb, startDate: fixture.manualStartDate, endDate: fixture.manualEndDate, persisted: true };
    await fp.screenshot({ caret: 'initial', path: `${out}/manual-reservation-after-submit.png`, fullPage: true });

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
      await calendar.screenshot({ caret: 'initial', path: `${out}/manual-calendar-held.png`, fullPage: true });
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
    assert.match(await row.innerText(), /Manual Guest/);
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId, channel: 'manual' } }), 1);
    report.manualReservation.formVerified = true;
  });
  await step('Founder assigns a task and scoped staff starts and completes it', fp, async () => {
    const taskTitle = `Synthetic shift task ${fixture.unitId}`;
    const taskWhere = { unitId: fixture.unitId, operatingSpaceId: fixture.operatingSpaceId, taskType: 'custom', title: taskTitle };
    assert.equal(await db.operationalTask.count({ where: taskWhere }), 0);
    const queueUrl = `/ops/tasks?${new URLSearchParams({ spaceId: fixture.operatingSpaceId })}`;
    await fp.goto(queueUrl);
    const form = fp.locator('form').filter({ has: fp.locator('input[name=title]') });
    await form.locator('input[name=title]').fill(taskTitle);
    await form.locator('select[name=unitId]').selectOption(fixture.unitId);
    await form.locator('select[name=taskType]').selectOption('custom');
    await form.locator('input[name=dueAt]').fill(fixture.taskDueAt);
    await form.locator('select[name=assignedIdentityId]').selectOption(fixture.staffId);
    const response = fp.waitForResponse(r => r.url().endsWith('/api/ops/tasks') && r.request().method() === 'POST');
    response.catch(() => {});
    await form.getByRole('button', { name: 'Create task', exact: true }).click();
    const saved = await response;
    assert.equal(saved.status(), 201);
    const result = await saved.json();
    const tasks = await db.operationalTask.findMany({ where: taskWhere });
    assert.equal(tasks.length, 1, 'One form submission must create exactly one canonical task');
    const task = tasks[0];
    assert.equal(task.id, result.task?.id);
    assert.equal(task.status, 'assigned');
    assert.equal(task.projectId, fixture.projectId);
    assert.equal(task.assignedIdentityId, fixture.staffId);
    report.taskTimeZone = { spaceTimeZone: fixture.taskTimeZone, enteredLocalTime: fixture.taskDueAt, actualDueAt: task.dueAt.toISOString(), expectedDueAt: fixture.taskExpectedDueAt };
    assert.equal(task.dueAt.toISOString(), fixture.taskExpectedDueAt, 'Task due time must use the canonical operating-space timezone, not server or browser defaults');
    assert.ok(task.dueAt.getTime() > Date.now());
    assert.equal(task.bookingId, null);
    assert.equal(task.blocksInventory, false);
    assert.equal(await db.operationalTaskMedia.count({ where: { operationalTaskId: task.id } }), 0, 'No photo upload belongs to this task slice');
    report.staffTask = { taskId: task.id, staffId: fixture.staffId, title: taskTitle, persisted: true, status: task.status };
    await fp.screenshot({ caret: 'initial', path: `${out}/task-after-submit.png`, fullPage: true });

    // Keep the founder form untouched so separate staff evidence cannot hide a
    // committed-but-stuck create form by navigating or refreshing that page.
    const staff = await context('staff');
    const sp = await staff.newPage();
    await login(sp, fixture.staffEmail, '/ops/tasks');
    await sp.goto(queueUrl);
    const article = sp.locator(`article#task-${task.id}`);
    await article.getByRole('heading', { name: taskTitle, exact: true }).waitFor();
    assert.match(await article.innerText(), /Synthetic Staff/);
    assert.match(await article.innerText(), /Due[^\n]*12:00/, 'Staff queue must display the entered operating-space noon');
    const startedResponse = sp.waitForResponse(r => r.url().endsWith(`/api/ops/tasks/${task.id}`) && r.request().method() === 'PATCH');
    startedResponse.catch(() => {});
    await article.getByRole('button', { name: 'Start', exact: true }).click();
    const started = await startedResponse;
    assert.equal(started.status(), 200);
    assert.equal((await started.json()).task?.status, 'in_progress');
    const inProgress = await db.operationalTask.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(inProgress.status, 'in_progress');
    assert.equal(inProgress.assignedIdentityId, fixture.staffId);
    assert.ok(inProgress.startedAt);
    await article.getByRole('button', { name: 'Ready', exact: true }).waitFor();
    await sp.screenshot({ caret: 'initial', path: `${out}/staff-task-in-progress.png`, fullPage: true });
    const readyResponse = sp.waitForResponse(r => r.url().endsWith(`/api/ops/tasks/${task.id}`) && r.request().method() === 'PATCH');
    readyResponse.catch(() => {});
    await article.getByRole('button', { name: 'Ready', exact: true }).click();
    const ready = await readyResponse;
    assert.equal(ready.status(), 200);
    assert.equal((await ready.json()).task?.status, 'ready');
    const completed = await db.operationalTask.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(completed.status, 'ready');
    assert.equal(completed.assignedIdentityId, fixture.staffId);
    assert.ok(completed.readyAt && completed.completedAt);
    assert.ok(completed.readyAt.getTime() >= inProgress.startedAt.getTime());
    await article.waitFor({ state: 'detached' });
    await sp.reload();
    assert.equal(await sp.locator(`article#task-${task.id}`).count(), 0, 'Ready task must stay out of the open queue after reload');
    assert.equal(await db.operationalTask.count({ where: taskWhere }), 1);
    report.staffTask.status = completed.status;
    report.staffTask.staffFlowVerified = true;
    report.staffTask.readyAt = completed.readyAt.toISOString();
    report.staffTask.completedAt = completed.completedAt.toISOString();
    await sp.screenshot({ caret: 'initial', path: `${out}/staff-task-ready.png`, fullPage: true });

    await poll(async () => {
      const submit = form.getByRole('button', { name: 'Create task', exact: true });
      return await submit.count() === 1 && await submit.isEnabled()
        && await form.locator('input[name=title]').inputValue() === ''
        && await form.locator('select[name=unitId]').inputValue() === ''
        && await form.locator('select[name=assignedIdentityId]').inputValue() === ''
        && await form.locator('input[name=dueAt]').inputValue() === '';
    }, 'Task committed, but the task create form stayed busy or failed to reset');
    assert.equal(await form.getByRole('alert').count(), 0);
    report.staffTask.formVerified = true;
    await fp.reload();
    assert.equal(await fp.locator(`article#task-${task.id}`).count(), 0, 'Founder reload must reflect the staff completion');
  });
  await step('Founder saves and reloads year-round base plus bounded holiday prices', fp, async () => {
    await fp.goto(`/app/admin/units/${fixture.tariffUnitId}#unit-tariffs`);
    const rates = fp.getByRole('region', { name: 'Rates and seasons' });
    await rates.getByRole('button', { name: 'Add year-round base rate', exact: true }).first().click();
    await rates.getByLabel('THB per night', { exact: true }).first().fill('1234');
    await rates.getByLabel('Price includes taxes (VAT)', { exact: true }).check();
    await rates.getByLabel('Price includes service charge', { exact: true }).check();
    await rates.getByRole('button', { name: 'Add season', exact: true }).first().click();
    await rates.getByLabel('Season code', { exact: true }).nth(1).fill('HOLIDAY');
    await rates.getByLabel('From', { exact: true }).nth(1).fill('12-20');
    await rates.getByLabel('To', { exact: true }).nth(1).fill('01-10');
    await rates.getByLabel('THB per night', { exact: true }).nth(1).fill('2345');
    await rates.getByLabel('Min. nights', { exact: true }).nth(1).fill('1');
    await rates.getByRole('button', { name: 'Use for dates outside other seasons', exact: true }).first().click();
    const review = rates.getByRole('region', { name: 'Review base-rate dates', exact: true });
    await review.waitFor();
    assert.match(await review.innerText(), /01-11\s*–\s*12-19/);
    assert.equal(await rates.getByLabel('From', { exact: true }).first().inputValue(), '01-01', 'Preview must not silently change draft dates');
    await fp.screenshot({ caret: 'initial', path: `${out}/seasonal-review-base-dates.png`, fullPage: true });
    await review.getByRole('button', { name: 'Apply these dates to draft', exact: true }).click();
    assert.equal(await rates.getByLabel('From', { exact: true }).first().inputValue(), '01-11');
    assert.equal(await rates.getByLabel('To', { exact: true }).first().inputValue(), '12-19');
    assert.equal(await rates.getByLabel('THB per night', { exact: true }).first().inputValue(), '1234');
    const savedResponse = fp.waitForResponse(r => r.url().endsWith(`/api/admin/units/${fixture.tariffUnitId}/tariff`) && r.request().method() === 'PUT');
    savedResponse.catch(() => {});
    await rates.getByRole('button', { name: 'Save for this villa', exact: true }).click();
    const saved = await savedResponse; assert.equal(saved.status(), 200); assert.equal((await saved.json()).saved, 1);
    await rates.getByText('Saved for 1 villa(s). New quotes use these rates now.', { exact: true }).waitFor();
    const offering = await db.commercialOffering.findFirstOrThrow({ where: { unitId: fixture.tariffUnitId, offeringType: 'short_term_stay' } });
    const grid = offering.pricingTerms.tariffGrid;
    assert.equal(grid.length, 2);
    assert.equal(new Set(grid.map(row => row.sourceRateId)).size, 2);
    assert.ok(grid.every(row => typeof row.sourceRateId === 'string' && row.sourceRateId.length));
    assert.equal(grid.find(row => row.seasonCode === 'BASE').amountSatang, 123400);
    assert.equal(grid.find(row => row.seasonCode === 'HOLIDAY').amountSatang, 234500);
    await fp.reload();
    await rates.getByLabel('THB per night', { exact: true }).nth(1).waitFor();
    assert.deepEqual(await rates.getByLabel('THB per night', { exact: true }).evaluateAll(inputs => inputs.map(input => input.value)), ['1234', '2345']);
    assert.deepEqual(await rates.getByLabel('Season code', { exact: true }).evaluateAll(inputs => inputs.map(input => input.value)), ['BASE', 'HOLIDAY']);
    assert.deepEqual(await rates.getByLabel('From', { exact: true }).evaluateAll(inputs => inputs.map(input => input.value)), ['01-11', '12-20']);
    assert.deepEqual(await rates.getByLabel('To', { exact: true }).evaluateAll(inputs => inputs.map(input => input.value)), ['12-19', '01-10']);
    const reloadResponse = await fp.request.get(`/api/admin/units/${fixture.tariffUnitId}/tariff`);
    assert.equal(reloadResponse.status(), 200);
    const reloaded = await reloadResponse.json();
    assert.deepEqual(reloaded.draft.daily.map(row => row.sourceRateId), grid.map(row => row.sourceRateId));
    await fp.screenshot({ caret: 'initial', path: `${out}/seasonal-saved-reloaded.png`, fullPage: true });
    await rates.screenshot({ caret: 'initial', path: `${out}/seasonal-rates-region.png` });
    const preview = fp.locator('section').filter({ has: fp.getByRole('heading', { name: 'Seasonal tariff and booking-policy preview', exact: true }) });
    await preview.locator('select').selectOption('stay');
    await preview.getByLabel('Check-in', { exact: true }).fill(fixture.tariffStartDate);
    await preview.getByLabel('Check-out', { exact: true }).fill(fixture.tariffEndDate);
    await preview.getByLabel('Guests', { exact: true }).fill('2');
    const previewResponse = fp.waitForResponse(r => r.url().endsWith(`/api/admin/units/${fixture.tariffUnitId}/tariff-preview`) && r.request().method() === 'POST');
    previewResponse.catch(() => {});
    await preview.getByRole('button', { name: 'Preview quote', exact: true }).click();
    const calculated = await previewResponse; assert.equal(calculated.status(), 200);
    const result = await calculated.json();
    assert.equal(result.pricingScope, 'canonical_quote');
    assert.equal(result.totalSatang, 592400);
    await poll(async () => /5,924/.test(await preview.innerText()), 'Saved-price preview must show the base/holiday total');
    report.seasonalTariff = { unitId: fixture.tariffUnitId, baseSatang: 123400, holidaySatang: 234500, startDate: fixture.tariffStartDate, endDate: fixture.tariffEndDate, previewTotalSatang: result.totalSatang, savedAndReloaded: true };
    await fp.screenshot({ caret: 'initial', path: `${out}/seasonal-canonical-preview.png`, fullPage: true });
    await preview.screenshot({ caret: 'initial', path: `${out}/seasonal-preview-region.png` });
  });
  await step('Guest selects seasonal dates and books the same 5924 THB quote', gp, async () => {
    await fp.goto('/app/admin/units');
    const row = fp.locator('div.flex.flex-col.lg\\:flex-row').filter({ has: fp.getByRole('link', { name: fixture.tariffUnitName, exact: true }) });
    const publication = fp.waitForResponse(r => r.url().endsWith(`/api/admin/units/${fixture.tariffUnitId}`) && r.request().method() === 'PUT');
    publication.catch(() => {});
    await row.getByRole('button', { name: 'Set live', exact: true }).click();
    const published = await publication; assert.equal(published.status(), 200); assert.equal((await published.json()).status, 'live');
    await fp.getByRole('status').filter({ hasText: `${fixture.tariffUnitName} is set to live.` }).waitFor();
    await fp.getByRole('link', { name: /Review publication and bookings/ }).click();
    assert.equal(await fp.getByRole('link', { name: /View public listing/ }).getAttribute('href'), `/units/${fixture.tariffUnitId}`);
    await gp.goto(`/units/${fixture.tariffUnitId}?adults=2&children=0`);
    await gp.getByRole('button', { name: 'Check-in → Check-out', exact: true }).click();
    const picker = gp.getByRole('dialog', { name: /Check-in.*Check-out/ });
    const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { dateStyle: 'full', timeZone: 'UTC' });
    for (let month = 0; month < 14 && await picker.getByRole('button', { name: dayLabel(fixture.tariffStartDate), exact: true }).count() === 0; month++) {
      await picker.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await picker.getByRole('button', { name: dayLabel(fixture.tariffStartDate), exact: true }).click();
    await gp.waitForURL(url => url.searchParams.get('startDate') === fixture.tariffStartDate);
    const quoteResponse = gp.waitForResponse(r => r.url().endsWith('/api/pricing/breakdown') && r.request().method() === 'POST');
    quoteResponse.catch(() => {});
    await picker.getByRole('button', { name: dayLabel(fixture.tariffEndDate), exact: true }).click();
    await gp.waitForURL(url => url.searchParams.get('endDate') === fixture.tariffEndDate);
    const priced = await quoteResponse; assert.equal(priced.status(), 200);
    const guestQuote = await priced.json();
    assert.equal(guestQuote.isAvailable, true); assert.equal(guestQuote.nights, 3);
    assert.equal(guestQuote.acceptedTotalSatang, 592400);
    await poll(async () => /5,924/.test(await body(gp)), 'Guest card must show saved base/holiday pricing');
    await gp.screenshot({ caret: 'initial', path: `${out}/seasonal-guest-quote.png`, fullPage: true });
    await gp.getByRole('button', { name: 'Reserve', exact: true }).first().click();
    await gp.waitForURL(url => url.pathname === '/book/review' && url.searchParams.has('bookingIntent'));
    await poll(async () => /5,924/.test(await body(gp)), 'Booking review must keep the same seasonal total');
    await gp.locator('main input[type=checkbox]').check();
    await gp.locator('select').filter({ hasText: 'Cash on arrival' }).selectOption('cash');
    const bookingResponse = gp.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    bookingResponse.catch(() => {});
    await gp.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    assert.equal((await bookingResponse).status(), 201);
    await gp.waitForURL(/\/trips(?:\/|$)/);
    const reservations = await db.booking.findMany({ where: { unitId: fixture.tariffUnitId, guestIdentityId: fixture.guestId } });
    assert.equal(reservations.length, 1);
    const reservation = reservations[0];
    assert.equal(reservation.totalThb, 592400); assert.equal(reservation.status, 'pending_payment'); assert.equal(reservation.paymentMethod, 'cash');
    assert.equal(reservation.startDate.toISOString().slice(0, 10), fixture.tariffStartDate);
    assert.equal(reservation.endDate.toISOString().slice(0, 10), fixture.tariffEndDate);
    assert.equal(await db.payment.count({ where: { bookingId: reservation.id } }), 0);
    await gp.goto(`/trips/${reservation.id}`); await gp.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    await fp.goto(`/ops/calendar/board?${new URLSearchParams({ projectId: fixture.projectId, unitId: fixture.tariffUnitId, start: fixture.tariffStartDate, days: '7' })}`);
    const cell = fp.getByRole('button', { name: new RegExp(`${fixture.tariffUnitName} · ${fixture.tariffStartDate} ·`) });
    await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), /Hold/i); await cell.click();
    const detail = fp.getByRole('region', { name: 'Night details' });
    const canonicalLink = detail.getByRole('link', { name: /Open canonical stay/ });
    await canonicalLink.waitFor(); assert.equal(await canonicalLink.getAttribute('href'), `/ops/stays/${reservation.id}`);
    await fp.screenshot({ caret: 'initial', path: `${out}/seasonal-booking-calendar.png`, fullPage: true });
    report.seasonalTariff.guestQuoteSatang = guestQuote.acceptedTotalSatang;
    report.seasonalTariff.bookingId = reservation.id;
    report.seasonalTariff.bookingTotalSatang = reservation.totalThb;
    report.seasonalTariff.calendarVerified = true;
  });
  // Synthetic fixture enrollment happens only after proving contact creation itself
  // issued no credentials, tokens or roles. Authentication still uses the real UI.
  const manualContact = await db.identity.findUniqueOrThrow({ where: { id: report.manualGuest.id } });
  assert.equal(manualContact.hashedPassword, null);
  const { hash } = require('bcryptjs');
  await db.identity.update({ where: { id: manualContact.id }, data: {
    hashedPassword: await hash(fixture.password, 10), emailVerifiedAt: new Date(),
  } });
  const manualGuestContext = await context('manual-guest');
  const mgp = await manualGuestContext.newPage();
  await step('Manual guest signs in; a different guest cannot read this booking', mgp, async () => {
    await login(mgp, manualContact.email, '/trips');
    const id = report.manualReservation.bookingId;
    assert.equal((await gp.request.get(`/api/bookings/${id}`)).status(), 404);
    await gp.goto(`/trips/${id}`);
    await gp.getByText('Booking not found', { exact: true }).waitFor();
    report.manualGuest.syntheticEnrollment = true;
    report.manualGuest.foreignGuestDenied = true;
  });
  await step('Operator confirms the manual commitment with payment still outstanding', fp, async () => {
    const id = report.manualReservation.bookingId;
    const original = await db.booking.findUniqueOrThrow({ where: { id } });
    assert.equal(original.status, 'pending_payment'); assert.equal(original.balanceDueThb, 0);
    assert.ok(original.holdExpiresAt);
    for (const model of [db.payment, db.ledgerEntry, db.depositPreauth]) assert.equal(await model.count({ where: { bookingId: id } }), 0);
    await fp.goto(`/ops/stays/${id}`);
    const reason = 'Synthetic accepted commitment; no money received.';
    await fp.getByLabel('Reason for confirming before payment', { exact: true }).fill(reason);
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/bookings/${id}/confirm-unpaid`) && r.request().method() === 'POST');
    response.catch(() => {});
    await fp.getByRole('button', { name: 'Confirm reservation — payment outstanding', exact: true }).click();
    const saved = await response; assert.equal(saved.status(), 200);
    const command = saved.request().postDataJSON();
    const result = await saved.json();
    assert.equal(result.booking.id, id); assert.equal(result.booking.status, 'confirmed');
    assert.equal(result.booking.balanceDueSatang, original.totalThb); assert.equal(result.booking.holdExpiresAt, null);
    const confirmed = await db.booking.findUniqueOrThrow({ where: { id } });
    assert.equal(confirmed.status, 'confirmed'); assert.equal(confirmed.balanceDueThb, original.totalThb); assert.equal(confirmed.holdExpiresAt, null);
    for (const model of [db.payment, db.ledgerEntry, db.depositPreauth]) assert.equal(await model.count({ where: { bookingId: id } }), 0, 'Confirmation alone must not create financial/deposit records');
    const founderIdentity = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } });
    const audits = await db.auditLog.findMany({ where: { entityType: 'Booking', entityId: id, action: 'bookings:confirm_unpaid' } });
    assert.equal(audits.length, 1); assert.equal(audits[0].actorIdentityId, founderIdentity.id); assert.equal(audits[0].data.reason, reason);
    assert.equal((await fp.request.post(`/api/bookings/${id}/confirm-unpaid`, { data: command })).status(), 200, 'A retry of the same command must be idempotent');
    assert.equal(await db.auditLog.count({ where: { entityType: 'Booking', entityId: id, action: 'bookings:confirm_unpaid' } }), 1);
    assert.equal((await gp.request.post(`/api/bookings/${id}/confirm-unpaid`, { data: command })).status(), 403, 'A guest cannot exercise the operator confirmation');
    await fp.reload();
    await fp.getByText(/^Reservation confirmed\. Payment is still outstanding\./).waitFor();
    await fp.screenshot({ caret: 'initial', path: `${out}/manual-confirmed-unpaid.png`, fullPage: true });
    await mgp.goto(`/trips/${id}`);
    await mgp.getByText('Reservation confirmed — payment outstanding', { exact: true }).waitFor();
    const displayedBalance = (original.totalThb / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.ok((await body(mgp)).includes(`Outstanding balance: ฿${displayedBalance}`));
    await mgp.screenshot({ caret: 'initial', path: `${out}/guest-confirmed-unpaid-balance.png`, fullPage: true });
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e/expire-synthetic-holds.ts', id], { env: process.env, stdio: 'pipe' });
    report.unpaidExpiry = JSON.parse(await readFile(`${out}/unpaid-expiry.json`, 'utf8'));
    assert.equal(report.unpaidExpiry.bookingId, id);
    await fp.goto(`/ops/calendar/board?${new URLSearchParams({ projectId: fixture.projectId, unitId: fixture.unitId, start: fixture.manualStartDate, days: '7' })}`);
    const cell = fp.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.manualStartDate} ·`) });
    await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), /Reserved/); await cell.click();
    const link = fp.getByRole('region', { name: 'Night details' }).getByRole('link', { name: /Open canonical stay/ });
    await link.waitFor(); assert.equal(await link.getAttribute('href'), `/ops/stays/${id}`);
    const blocked = await ap.request.post('/api/pricing/breakdown', { data: { unitId: fixture.unitId, startDate: fixture.manualStartDate, endDate: fixture.manualEndDate, guestCount: 2 } });
    assert.equal(blocked.status(), 200); assert.equal((await blocked.json()).isAvailable, false);
    report.manualReservation.confirmedUnpaid = true;
    report.manualReservation.outstandingSatang = confirmed.balanceDueThb;
    report.manualReservation.holdExpiresAt = null;
    await fp.screenshot({ caret: 'initial', path: `${out}/manual-durable-calendar.png`, fullPage: true });
  });
  await step('A separate deliberate synthetic cash receipt settles the real outstanding balance', fp, async () => {
    const id = report.manualReservation.bookingId;
    await fp.goto(`/ops/stays/${id}`);
    const receiptRef = `SYNTHETIC-CASH-${id}`;
    await fp.getByLabel('Receipt reference', { exact: true }).fill(receiptRef);
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/bookings/${id}/record-cash-payment`) && r.request().method() === 'POST');
    response.catch(() => {});
    await fp.getByRole('button', { name: 'Record cash payment', exact: true }).click();
    const saved = await response; assert.equal(saved.status(), 200);
    const result = await saved.json(); assert.equal(result.receiptRecorded, true); assert.equal(result.bookingStatus, 'confirmed');
    const settled = await db.booking.findUniqueOrThrow({ where: { id } });
    assert.equal(settled.status, 'confirmed'); assert.equal(settled.balanceDueThb, 0); assert.equal(settled.holdExpiresAt, null);
    const payments = await db.payment.findMany({ where: { bookingId: id } });
    assert.equal(payments.length, 1);
    const payment = payments[0];
    assert.equal(payment.id, result.payment.id); assert.equal(payment.purpose, 'stay_balance');
    assert.equal(payment.method, 'cash'); assert.equal(payment.provider, 'cash'); assert.equal(payment.status, 'succeeded');
    assert.equal(payment.receiptRef, receiptRef); assert.equal(payment.amountThb, settled.totalThb);
    const founderIdentity = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } });
    assert.equal(payment.receivedByIdentityId, founderIdentity.id); assert.ok(payment.receivedAt && payment.succeededAt);
    const ledger = await db.ledgerEntry.findMany({ where: { bookingId: id } });
    assert.equal(ledger.length, 1); assert.equal(ledger[0].paymentId, payment.id);
    assert.equal(ledger[0].entryType, 'rental_revenue'); assert.equal(ledger[0].amountThb, settled.totalThb);
    assert.equal(await db.depositPreauth.count({ where: { bookingId: id } }), 0);
    await fp.reload();
    assert.equal(await fp.getByRole('button', { name: 'Record cash payment', exact: true }).count(), 0);
    assert.equal((await fp.request.post(`/api/bookings/${id}/record-cash-payment`, { data: { receiptRef } })).status(), 400);
    assert.equal(await db.payment.count({ where: { bookingId: id } }), 1);
    assert.equal(await db.ledgerEntry.count({ where: { bookingId: id } }), 1);
    await mgp.reload();
    await mgp.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    assert.equal(await mgp.getByText('Reservation confirmed — payment outstanding', { exact: true }).count(), 0);
    report.manualReservation.receipt = { synthetic: true, paymentId: payment.id, amountSatang: payment.amountThb, ledgerId: ledger[0].id, outstandingSatang: 0 };
  });
  let requestPage;
  let registeredGuest;
  let firstRequest;
  async function setBookingMode(instant) {
    const region = fp.getByRole('region', { name: 'How guests book', exact: true });
    await region.getByRole('radio', { name: instant ? 'Instant booking' : 'Request to book', exact: true }).click();
    const endpoint = `/api/property-booking-mode/${fixture.unitId}`;
    const previewResponse = fp.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'POST');
    previewResponse.catch(() => {});
    await region.getByRole('button', { name: 'Preview this unit', exact: true }).click();
    const inspected = await previewResponse; assert.equal(inspected.status(), 200);
    const preview = await inspected.json();
    assert.equal(preview.instantBook, instant);
    assert.deepEqual(preview.units.map(unit => unit.id), [fixture.unitId]);
    assert.deepEqual(preview.blocked, []);
    assert.equal(typeof preview.baseline, 'string');
    // Preview is read-only; confirmation is required before the canonical write.
    assert.notEqual((await db.unit.findUniqueOrThrow({ where: { id: fixture.unitId } })).instantBook, instant);
    const apply = region.getByRole('button', { name: 'Apply reviewed change', exact: true });
    assert.equal(await apply.isDisabled(), true);
    await region.getByLabel('I reviewed every affected unit and the selected booking mode.', { exact: true }).check();
    const savedResponse = fp.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'PUT');
    savedResponse.catch(() => {});
    await apply.click();
    const saved = await savedResponse; assert.equal(saved.status(), 200);
    const result = await saved.json(); assert.equal(result.instantBook, instant); assert.equal(result.updated, 1);
    assert.equal((await db.unit.findUniqueOrThrow({ where: { id: fixture.unitId } })).instantBook, instant);
  }
  async function openRequestReview(page) {
    await page.goto(unitUrl);
    await page.getByRole('button', { name: 'Request to book', exact: true }).first().click();
    await page.waitForURL(url => url.pathname === '/book/review' && url.searchParams.has('bookingIntent'));
    await page.getByRole('heading', { name: 'Review your booking request', exact: true }).waitFor();
    await page.getByLabel('I have read the cancellation terms and agree to request these dates.', { exact: true }).check();
    // A preferred later method is retained; requesting itself must create no payment.
    await page.locator('select').filter({ hasText: 'Cash on arrival' }).selectOption('cash');
  }
  async function submitRequest(page) {
    const response = page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    response.catch(() => {});
    await page.getByRole('button', { name: 'Send booking request', exact: true }).click();
    const saved = await response; assert.equal(saved.status(), 201);
    await page.waitForURL(/\/trips(?:\/|$)/);
    const rows = await db.booking.findMany({ where: { unitId: fixture.unitId, guestIdentityId: registeredGuest.id, status: 'requested' } });
    assert.equal(rows.length, 1);
    const request = rows[0]; assert.equal(request.holdExpiresAt, null); assert.ok(request.requestExpiresAt);
    assert.equal(request.totalThb, 370200);
    for (const model of [db.payment, db.ledgerEntry, db.depositPreauth]) assert.equal(await model.count({ where: { bookingId: request.id } }), 0);
    assert.equal((await publicQuote(ap)).isAvailable, true, 'Request alone must not occupy the dates');
    return request;
  }
  async function requestCalendar(state) {
    await fp.goto(calendarUrl);
    const cell = fp.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.startDate} ·`) });
    await cell.waitFor(); assert.match(await cell.getAttribute('aria-label'), state);
  }
  async function runRequestExpiry(id, kind) {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e/expire-synthetic-request.ts', id, kind], { env: process.env, stdio: 'pipe' });
    return JSON.parse(await readFile(`${out}/request-expiry-${id}.json`, 'utf8'));
  }
  await step('Per-unit mode persists and can reverse its saved value in the same session', fp, async () => {
    await fp.goto(`/app/admin/units/${fixture.unitId}`);
    await setBookingMode(false);
    await setBookingMode(true); // Previously disabled because the initial prop was still true.
    await setBookingMode(false);
    await fp.reload();
    const region = fp.getByRole('region', { name: 'How guests book', exact: true });
    assert.equal(await region.getByRole('radio', { name: 'Request to book', exact: true }).getAttribute('aria-checked'), 'true');
    const response = await ap.request.get(`/api/units/${fixture.unitId}`); assert.equal(response.status(), 200);
    assert.equal((await response.json()).instantBook, false);
    report.bookingModes = { unitId: fixture.unitId, savedReversalVerified: true, requestIds: [] };
  });
  await step('Guest registration preserves review intent and mode changes require fresh consent', fp, async () => {
    const ctx = await context('registered-request-guest'); requestPage = await ctx.newPage();
    await openRequestReview(requestPage);
    const originalReview = new URL(requestPage.url());
    const unauthorizedResponse = requestPage.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    unauthorizedResponse.catch(() => {});
    await requestPage.getByRole('button', { name: 'Send booking request', exact: true }).click();
    assert.equal((await unauthorizedResponse).status(), 401);
    await requestPage.waitForURL(url => url.pathname === '/login');
    const next = new URL(requestPage.url()).searchParams.get('next');
    assert.equal(next, originalReview.pathname + originalReview.search);
    await requestPage.locator('form').getByRole('link', { name: 'Sign up', exact: true }).click();
    await requestPage.waitForURL(url => url.pathname === '/register');
    assert.equal(new URL(requestPage.url()).searchParams.get('next'), next);
    await requestPage.getByLabel(/^First name\s*\*?$/).fill('Synthetic');
    await requestPage.getByLabel(/^Last name\s*\*?$/).fill('Registered');
    await requestPage.getByLabel(/^Email\s*\*?$/).fill('registered@browser.example.test');
    await requestPage.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
    const registerResponse = requestPage.waitForResponse(r => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST');
    registerResponse.catch(() => {});
    await requestPage.locator('form').getByRole('button', { name: 'Sign up', exact: true }).click();
    assert.equal((await registerResponse).status(), 201);
    await requestPage.waitForURL(url => url.pathname === '/book/review');
    assert.equal(new URL(requestPage.url()).searchParams.get('bookingIntent'), originalReview.searchParams.get('bookingIntent'));
    assert.equal(new URL(requestPage.url()).searchParams.get('unitId'), fixture.unitId);
    assert.equal(new URL(requestPage.url()).searchParams.get('startDate'), fixture.startDate);
    assert.equal(new URL(requestPage.url()).searchParams.get('endDate'), fixture.endDate);
    const cookie = (await ctx.cookies()).find(c => c.name === 'auth-session');
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    assert.equal((await requestPage.request.get('/api/auth/me')).status(), 200);
    registeredGuest = await db.identity.findUniqueOrThrow({ where: { email: 'registered@browser.example.test' } });
    assert.equal(registeredGuest.emailVerifiedAt, null, 'Suppressed test email must not falsely verify the identity');
    await requestPage.getByRole('heading', { name: 'Review your booking request', exact: true }).waitFor();
    await requestPage.locator('main input[type=checkbox]').check();
    await setBookingMode(true);
    const requoteResponse = requestPage.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
    requoteResponse.catch(() => {});
    await requestPage.getByRole('button', { name: 'Send booking request', exact: true }).click();
    const requoted = await requoteResponse; assert.equal(requoted.status(), 409); assert.equal((await requoted.json()).code, 'REQUOTE_REQUIRED');
    await requestPage.getByRole('button', { name: 'Confirm booking', exact: true }).waitFor();
    assert.equal(await requestPage.locator('main input[type=checkbox]').isChecked(), false);
    assert.equal(await db.booking.count({ where: { guestIdentityId: registeredGuest.id } }), 0);
    await setBookingMode(false);
    await requestPage.reload();
    await requestPage.getByRole('heading', { name: 'Review your booking request', exact: true }).waitFor();
    await requestPage.locator('main input[type=checkbox]').check();
    await requestPage.locator('select').filter({ hasText: 'Cash on arrival' }).selectOption('cash');
    await requestPage.screenshot({ caret: 'initial', path: `${out}/request-review-before-payment.png`, fullPage: true });
    firstRequest = await submitRequest(requestPage);
    report.bookingModes.registeredGuestId = registeredGuest.id;
    report.bookingModes.intentPreserved = true; report.bookingModes.requoteConsentVerified = true;
    report.bookingModes.requestIds.push(firstRequest.id);
    await requestCalendar(/Request only/);
  });
  await step('Operator approval opens a real payment hold which expires at its canonical deadline', fp, async () => {
    await fp.goto(`/ops/requests?projectId=${fixture.projectId}`);
    const row = fp.locator('li').filter({ hasText: 'Synthetic Registered' });
    await row.getByRole('button', { name: 'Approve', exact: true }).waitFor();
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/bookings/${firstRequest.id}/respond`) && r.request().method() === 'POST');
    response.catch(() => {});
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    assert.equal((await response).status(), 200);
    const approved = await db.booking.findUniqueOrThrow({ where: { id: firstRequest.id } });
    assert.equal(approved.status, 'pending_payment'); assert.ok(approved.holdExpiresAt); assert.equal(approved.requestExpiresAt, null);
    assert.equal(await db.payment.count({ where: { bookingId: approved.id } }), 0);
    assert.equal((await publicQuote(ap)).isAvailable, false);
    await requestCalendar(/Hold/);
    await fp.screenshot({ caret: 'initial', path: `${out}/approved-request-calendar-hold.png`, fullPage: true });
    await requestPage.goto(`/trips/${approved.id}`);
    await requestPage.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    report.bookingModes.approvalExpiry = await runRequestExpiry(approved.id, 'hold');
    await requestPage.reload();
    await requestPage.getByRole('heading', { name: 'This reservation has expired', exact: true }).waitFor();
    assert.equal(await requestPage.getByRole('button', { name: 'Cancel booking', exact: true }).count(), 0);
    assert.equal((await publicQuote(ap)).isAvailable, true);
    await requestCalendar(/Available/);
  });
  await step('Decline and unanswered request expiry both leave the calendar free', fp, async () => {
    await openRequestReview(requestPage); const declinedRequest = await submitRequest(requestPage);
    report.bookingModes.requestIds.push(declinedRequest.id);
    await fp.goto(`/ops/requests?projectId=${fixture.projectId}`);
    const row = fp.locator('li').filter({ hasText: 'Synthetic Registered' });
    await row.getByRole('button', { name: 'Decline', exact: true }).waitFor();
    const reason = await row.getByLabel(/^Decline reason/).inputValue(); assert.ok(reason);
    fp.once('dialog', dialog => dialog.accept());
    const response = fp.waitForResponse(r => r.url().endsWith(`/api/bookings/${declinedRequest.id}/respond`) && r.request().method() === 'POST');
    response.catch(() => {});
    await row.getByRole('button', { name: 'Decline', exact: true }).click();
    assert.equal((await response).status(), 200);
    const declined = await db.booking.findUniqueOrThrow({ where: { id: declinedRequest.id } });
    assert.equal(declined.status, 'declined'); assert.equal(declined.holdExpiresAt, null); assert.equal(declined.requestExpiresAt, null);
    assert.equal(await db.payment.count({ where: { bookingId: declined.id } }), 0);
    assert.equal((await publicQuote(ap)).isAvailable, true);
    await requestCalendar(/Available/);
    await openRequestReview(requestPage); const unanswered = await submitRequest(requestPage);
    report.bookingModes.requestIds.push(unanswered.id);
    report.bookingModes.unansweredExpiry = await runRequestExpiry(unanswered.id, 'request');
    assert.equal((await publicQuote(ap)).isAvailable, true);
    await requestCalendar(/Available/);
    await requestPage.goto(`/trips/${unanswered.id}`);
    await requestPage.getByRole('heading', { name: 'This request was not approved', exact: true }).waitFor();
    assert.equal(await requestPage.getByRole('button', { name: 'Cancel booking', exact: true }).count(), 0);
    await fp.goto(`/app/admin/units/${fixture.unitId}`); await setBookingMode(true); await fp.reload();
    assert.equal(await fp.getByRole('region', { name: 'How guests book', exact: true }).getByRole('radio', { name: 'Instant booking', exact: true }).getAttribute('aria-checked'), 'true');
    await ap.goto(unitUrl); await ap.getByRole('button', { name: 'Reserve', exact: true }).first().waitFor();
    report.bookingModes.finalInstantModeVerified = true;
  });
  await step('A real protective block disables guest card and direct review until the dates reopen', fp, async () => {
    const before = await db.booking.count({ where: { unitId: fixture.unitId } });
    const note = 'Synthetic browser occupancy protection; no payment imported';
    await fp.goto(`/app/admin/units/${fixture.unitId}`);
    const blockForm = fp.locator('form').filter({ has: fp.getByRole('button', { name: 'Block these dates', exact: true }) });
    await blockForm.getByLabel('Start date', { exact: true }).fill(fixture.startDate);
    await blockForm.getByLabel('End date', { exact: true }).fill(fixture.endDate);
    await blockForm.getByRole('combobox').selectOption('other');
    await blockForm.getByLabel('Note (optional)', { exact: true }).fill(note);
    const savedResponse = fp.waitForResponse(r => r.url().endsWith(`/api/units/${fixture.unitId}/availability-blocks`) && r.request().method() === 'POST');
    savedResponse.catch(() => {});
    await blockForm.getByRole('button', { name: 'Block these dates', exact: true }).click();
    const saved = await savedResponse; assert.equal(saved.status(), 201);
    const block = await saved.json(); assert.equal(block.note, note);
    await fp.locator('li').filter({ hasText: note }).waitFor();
    const unavailableQuote = await publicQuote(ap); assert.equal(unavailableQuote.isAvailable, false);
    await requestCalendar(/Blocked/);
    const reviewUrl = `/book/review?${new URLSearchParams({ unitId: fixture.unitId, projectId: fixture.projectId,
      startDate: fixture.startDate, endDate: fixture.endDate, adults: '2', children: '0', instantBook: '1' })}`;
    const unavailableCopy = 'This home cannot be booked for these dates. Please choose other dates.';
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await ap.setViewportSize(viewport);
      await ap.goto(unitUrl);
      await ap.getByText(unavailableCopy, { exact: true }).waitFor();
      const actions = ap.getByRole('button', { name: 'Reserve', exact: true });
      assert.equal(await actions.count(), 1, 'Unavailable quote must not render the sticky reserve action');
      assert.equal(await actions.isEnabled(), false);
      assert.equal(await ap.getByText('Total', { exact: true }).count(), 0);
      assert.equal(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await ap.screenshot({ caret: 'initial', path: `${out}/blocked-unit-${viewport.width}.png`, fullPage: true });
      await ap.goto(reviewUrl);
      await ap.getByText(unavailableCopy, { exact: true }).waitFor();
      assert.equal(await ap.getByRole('checkbox').isEnabled(), false);
      assert.equal(await ap.getByRole('button', { name: 'Confirm booking', exact: true }).isEnabled(), false);
      assert.equal(await ap.getByText('Total', { exact: true }).count(), 0);
      assert.equal(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await ap.screenshot({ caret: 'initial', path: `${out}/blocked-review-${viewport.width}.png`, fullPage: true });
    }
    // Supplemental authenticated HTTP negative probe: a hand-crafted attempt
    // must still fail under the canonical writer, even if a client ignores UI.
    const refused = await gp.request.post('/api/bookings', { data: {
      unitId: fixture.unitId, projectId: fixture.projectId, startDate: fixture.startDate, endDate: fixture.endDate,
      adultsCount: 2, childrenCount: 0, instantBook: true, paymentMethod: 'cash',
      acceptedTotalSatang: unavailableQuote.acceptedTotalSatang, idempotencyKey: randomUUID(),
    } });
    assert.equal(refused.status(), 409);
    const refusal = await refused.json();
    assert.equal(refusal.code, 'DOUBLE_BOOK');
    assert.match(refusal.error, /unit is blocked \(other\)/);
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId } }), before);
    await fp.goto(`/app/admin/units/${fixture.unitId}`);
    const removedResponse = fp.waitForResponse(r => r.url().endsWith(`/api/units/${fixture.unitId}/availability-blocks/${block.id}`) && r.request().method() === 'DELETE');
    removedResponse.catch(() => {});
    await fp.locator('li').filter({ hasText: note }).getByRole('button', { name: 'Remove', exact: true }).click();
    assert.equal((await removedResponse).status(), 200);
    assert.equal((await publicQuote(ap)).isAvailable, true);
    await ap.goto(unitUrl); await ap.getByRole('button', { name: 'Reserve', exact: true }).first().waitFor();
    await poll(() => ap.getByRole('button', { name: 'Reserve', exact: true }).first().isEnabled(), 'Released dates must become bookable again');
    await ap.goto(reviewUrl);
    await ap.getByText('Total', { exact: true }).waitFor();
    assert.equal(await ap.getByRole('checkbox').isChecked(), false);
    assert.equal(await ap.getByRole('button', { name: 'Confirm booking', exact: true }).isEnabled(), false);
    await ap.setViewportSize({ width: 1440, height: 1000 });
    report.protectiveBlock = { blockId: block.id, disabledCardAndReview: true, rejectedCanonicalWrite: 409,
      testedViewports: ['1440x900', '390x844'], removedThroughUi: true, newBookings: 0 };
  });
  const { runTenUserSmoke } = await import('./ten-user-smoke.mjs');
  await runTenUserSmoke({ db, fixture, founderPage: fp, context, login, step, report, publicQuote, out });
  assert.deepEqual(report.blockedBrowserOrigins, [], 'Unexpected external browser requests');
  assert.deepEqual(report.serverErrors, [], 'Unexpected local 5xx responses');
  assert.deepEqual(report.pageErrors, [], 'Unexpected browser runtime errors');
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1;
  for (const { ctx, name } of contexts) for (const [i, page] of ctx.pages().entries()) await page.screenshot({ caret: 'initial', path: `${out}/failure-${name}-${i}.png`, fullPage: true }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  for (const { ctx, name } of contexts) await ctx.tracing.stop({ path: `${out}/trace-${name}.zip` }).catch(() => {});
  await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2));
  await browser?.close(); await db.$disconnect();
}
