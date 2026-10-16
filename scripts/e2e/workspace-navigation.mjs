import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Fail before loading Prisma or Chromium unless both targets are the exact disposable fixture.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const stem = 'workspace-navigation';
const report = {
  headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true, result: 'running',
  steps: [], screenshots: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [],
  limits: [
    'Requires the preceding successful isolated browser journeys. Reuses their synthetic accounts, permissions, inventory and conversation; never seeds or repairs missing fixtures.',
    'Navigation and read boundaries only. No new accounts, grants, messages, property drafts, publication, payment, upload, external service or deployment.',
    'Opening an existing conversation may acknowledge it and materialize its current authorized participants. Login may write normal authentication analytics.',
    'Authored browser coverage is not execution evidence. Only a passed workspace-navigation-result.json for the tested commit proves execution. No browser result or screenshot is fabricated.',
    'EN at 320/390/430 CSS pixels in Chromium; native devices, other locales, provider and MC accounts are outside this bounded fixture.',
  ],
};
const contexts = [];
const personalTabs = ['Explore', 'Saved', 'My', 'Messages', 'Profile'];
const propertyTabs = ['Today', 'Calendar', 'Properties', 'Messages', 'More'];
const CONTENT = '/api/property-content-proposals';
const CREATION = '/api/property-creation';
const clone = value => JSON.parse(JSON.stringify(value));
const nav = page => page.getByRole('navigation', { name: 'Workspace navigation', exact: true });
const switcher = page => page.getByRole('navigation', { name: 'Choose workspace', exact: true });
const get = (page, path) => page.request.get(path, { maxRedirects: 0 });
let browser, fixture, creationFixture, contentFixture, supportThread, staffSpace, before, founder, staff, contributor, creator;
async function persist() { await writeFile(`browser-results/${stem}-result.json`, JSON.stringify(report, null, 2)); }
async function screenshot(page, suffix) {
  const path = `browser-results/${stem}-${suffix}.png`;
  await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
}
async function step(name, page, work) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try {
    await work();
    if (page) await screenshot(page, report.steps.length);
    entry.status = 'passed'; console.log(`PASS ${name}`);
  } catch (error) {
    entry.status = 'failed'; entry.error = String(error);
    if (page) await screenshot(page, `${report.steps.length}-failed`).catch(() => {});
    throw error;
  } finally { await persist(); }
}
async function json(response, status = 200) {
  assert.equal(response.status(), status, `${new URL(response.url()).pathname}: unexpected HTTP ${response.status()}`);
  assert.match(response.headers()['content-type'] || '', /application\/json/);
  return response.json();
}
async function denied(response, status, error) { assert.deepEqual(await json(response, status), { error }); }
async function context(name) {
  const ctx = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 },
    hasTouch: true, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  contexts.push({ ctx, name }); ctx.setDefaultTimeout(15000); ctx.setDefaultNavigationTimeout(30000);
  await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
    report.blockedBrowserOrigins.push(url.origin); return route.abort('blockedbyclient');
  });
  ctx.on('page', page => {
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === baseUrl && response.status() >= 500) report.serverErrors.push(`${response.status()} ${url.pathname}`);
    });
  });
  // No trace of credentials, cookies, tokens or password entry is produced.
  return ctx.newPage();
}
async function login(page, person) {
  await page.goto('/login?next=%2Fapp');
  await page.getByLabel(/^Email\s*\*?$/).fill(person.email);
  await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await json(await response)).id, person.id);
  await page.waitForURL(url => url.pathname === '/app');
  await page.getByRole('heading', { name: 'Everything connected to you.', exact: true }).waitFor();
  const me = await json(await get(page, '/api/auth/me')); assert.equal(me.id, person.id); assert.equal(me.isAdmin, person.isAdmin);
}
async function assertTabs(page, mode, current) {
  await nav(page).waitFor();
  await page.waitForFunction(({ mode, current }) => {
    const chooser = document.querySelector('nav[aria-label="Choose workspace"]');
    const tabs = document.querySelector('nav[aria-label="Workspace navigation"]');
    return [...(chooser?.querySelectorAll('button') || [])].some(button => button.textContent.trim() === mode && button.getAttribute('aria-pressed') === 'true') &&
      [...(tabs?.querySelectorAll('[aria-current="page"]') || [])].some(tab => tab.textContent.trim() === current);
  }, { mode, current });
  assert.deepEqual(await nav(page).locator('li').allTextContents(), mode === 'Personal' ? personalTabs : propertyTabs);
  assert.equal(await nav(page).locator('[aria-current="page"]').count(), 1);
  assert.equal((await nav(page).locator('[aria-current="page"]').innerText()).trim(), current);
  assert.equal(await nav(page).evaluate(element => getComputedStyle(element).position), 'fixed');
  assert.equal(await switcher(page).getByRole('button', { name: mode, exact: true }).getAttribute('aria-pressed'), 'true');
}
async function keyboardMode(page, mode, destination, heading) {
  const button = switcher(page).getByRole('button', { name: mode, exact: true });
  await button.focus(); assert.equal(await button.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Enter'); await page.waitForURL(url => url.pathname === destination);
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
}
async function noOverflow(page, name, mode, current) {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 }); await assertTabs(page, mode, current);
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ width: innerWidth,
      document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
      nav: document.querySelector('nav[aria-label="Workspace navigation"]').getBoundingClientRect().toJSON(),
      switcher: document.querySelector('nav[aria-label="Choose workspace"]').getBoundingClientRect().toJSON(),
      tabs: [...document.querySelectorAll('nav[aria-label="Workspace navigation"] li')].map(element => element.getBoundingClientRect().toJSON()),
    }));
    assert.equal(dimensions.width, width);
    assert.ok(dimensions.document <= width && dimensions.body <= width, `${name} overflows at ${width}px: ${JSON.stringify(dimensions)}`);
    for (const box of [dimensions.nav, dimensions.switcher, ...dimensions.tabs]) {
      assert.ok(box.left >= -1 && box.right <= width + 1 && box.width > 0, `${name}: navigation escapes ${width}px viewport`);
    }
    assert.ok(Math.abs(dimensions.nav.bottom - 844) <= 1, 'Tabs must stay at the bottom of the mobile viewport');
    await screenshot(page, `${name}-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}
async function unavailable(page, name, target) {
  const button = nav(page).getByRole('button', { name, exact: true }); const beforeUrl = page.url();
  assert.equal(await nav(page).getByRole('link', { name, exact: true }).count(), 0);
  await button.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name, exact: true }); await dialog.waitFor();
  await dialog.getByText('This workspace does not have this section yet. Open the available property tools instead.', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('link', { name: 'Open available workspace', exact: true }).getAttribute('href'), target);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  assert.equal(await close.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.getByRole('link').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await close.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(page.url(), beforeUrl); assert.equal(await button.evaluate(element => element === document.activeElement), true);
}
async function openMore(page) {
  await nav(page).getByRole('button', { name: 'More', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'More', exact: true }); await dialog.waitFor(); return dialog;
}
function assertScope(href, expected, absent = []) {
  const url = new URL(href, baseUrl); assert.equal(url.origin, baseUrl);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(url.searchParams.getAll(key), [value], `${key} on ${href}`);
  for (const key of absent) assert.equal(url.searchParams.has(key), false, `${key} must not leak into ${href}`);
  return url;
}
async function snapshot() {
  const result = { identity: clone(await db.identity.findMany({ select: { id: true, email: true, status: true, isAdmin: true, updatedAt: true }, orderBy: { id: 'asc' } })) };
  for (const model of ['roleAssignment', 'operatingSpace', 'operatingSpaceMember', 'operatingSpaceUnit', 'projectOrganizationRole', 'project', 'unit', 'projectAmenity', 'commercialOffering', 'booking', 'blockedDate', 'operationalTask', 'crmOpportunity', 'message']) {
    result[model] = clone(await db[model].findMany({ orderBy: { id: 'asc' } }));
  }
  result.projectStaffPermission = clone(await db.projectStaffPermission.findMany({ orderBy: [{ projectId: 'asc' }, { identityId: 'asc' }] }));
  return result;
}
async function existingPerson(email, id, isAdmin = false) {
  assert.match(email, /^[^@]+@browser\.example\.test$/);
  const person = await db.identity.findUniqueOrThrow({ where: { email } });
  if (id) assert.equal(person.id, id);
  assert.equal(person.status, 'active'); assert.equal(person.isAdmin, isAdmin); assert.ok(person.hashedPassword);
  return { id: person.id, email: person.email, isAdmin: person.isAdmin };
}
async function prior(name) {
  const result = JSON.parse(await readFile(`browser-results/${name}.json`, 'utf8'));
  assert.equal(result.result, 'passed', `${name} must pass first; do not invent or repair missing accounts`);
  assert.equal(result.synthetic, true); assert.equal(result.baseUrl, baseUrl);
  if (report.headCommit) assert.equal(result.headCommit, report.headCommit, 'Prior evidence must be from the same commit');
  return result;
}
async function noOpsOrPricing(page, person, ownSpace) {
  await denied(await get(page, `/api/admin/units/${fixture.unitId}/tariff`), 403, 'Assigned property capability required');
  await denied(await get(page, '/api/property-access'), 403, 'No current delegable property rights');
  await denied(await page.request.post(`/api/property-booking-mode/${fixture.unitId}`, { maxRedirects: 0, data: { scope: 'unit', instantBook: false } }), 403, 'Assigned property capability required');
  // Exact scoped API denial is checked with a well-formed command. No write is expected.
  await denied(await page.request.post('/api/ops/tasks', { maxRedirects: 0, data: {
    operatingSpaceId: ownSpace, unitId: ownSpace === staffSpace.id ? fixture.unitId : creationFixture.existingUnitId,
    taskType: 'turnover_inspection', dueAt: fixture.taskExpectedDueAt, title: 'Must never create a navigation acceptance task',
  } }), 403, 'Operating space capability required');
  await page.goto('/ops'); await page.waitForURL(url => url.pathname === '/');
  assert.equal((await json(await get(page, '/api/auth/me'))).id, person.id, 'A denied destination must not be mistaken for logout');
  assert.equal(await page.getByRole('heading', { name: 'Needs attention now', exact: true }).count(), 0);
  await assertTabs(page, 'Personal', 'Explore');
  await page.goto(`/ops/spaces/${ownSpace}`);
  await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, `/ops/spaces/${ownSpace}`);
  assert.equal(await nav(page).count(), 0, 'Denied work URLs must not acquire guest tabs');
  assert.equal(await page.getByRole('heading', { name: 'Managed homes', exact: true }).count(), 0);
  await page.goto('/property/pricing');
  await page.getByRole('status').filter({ hasText: /^No units are assigned for pricing\./ }).waitFor();
  assert.equal(await page.locator('main a[href^="/property/pricing/"]').count(), 0);
  assert.equal(await nav(page).count(), 0, 'No unrelated property or guest tabs on an unassigned capability route');
}

try {
  await mkdir('browser-results', { recursive: true });
  await step('Validate existing bounded synthetic fixtures and snapshot authority and canonical state', null, async () => {
    fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
    assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
    assert.equal(fixture.founderEmail, 'founder@browser.example.test'); assert.equal(fixture.staffEmail, 'staff@browser.example.test');
    assert.equal(fixture.serviceCustomerEmail, 'service-customer@browser.example.test'); assert.ok(fixture.password);
    const guest = await prior('guest-ux-result');
    await prior('employee-workspaces-result');
    creationFixture = (await prior('employee-creation-result')).fixture;
    contentFixture = (await prior('project-amenity-content-result')).fixture;
    founder = await existingPerson(fixture.founderEmail, creationFixture.founderId, true);
    staff = await existingPerson(fixture.staffEmail, fixture.staffId);
    contributor = await existingPerson(fixture.serviceCustomerEmail, fixture.serviceCustomerId);
    creator = await existingPerson('employee-create-complex@browser.example.test', creationFixture.complexCreatorId);
    staffSpace = await db.operatingSpace.findUniqueOrThrow({ where: { id: fixture.operatingSpaceId } });
    assert.equal(staffSpace.key, 'synthetic-browser-operations'); assert.equal(staffSpace.status, 'active');
    const member = await db.operatingSpaceMember.findUniqueOrThrow({ where: { operatingSpaceId_identityId: { operatingSpaceId: staffSpace.id, identityId: staff.id } } });
    assert.equal(member.active, true); assert.ok(member.capabilities.includes('view_calendar')); assert.ok(member.capabilities.includes('manage_tasks'));
    assert.equal(member.capabilities.includes('manage_reservations'), false);
    const creatorMember = await db.operatingSpaceMember.findUniqueOrThrow({ where: { operatingSpaceId_identityId: { operatingSpaceId: creationFixture.spaceId, identityId: creator.id } } });
    assert.equal(creatorMember.active, true); assert.deepEqual(creatorMember.capabilities, ['create_complex']);
    assert.equal(await db.roleAssignment.count({ where: { identityId: creator.id } }), 0);
    const contentRoles = await db.roleAssignment.findMany({ where: { identityId: contributor.id, status: 'active' } });
    assert.ok(contentRoles.length); assert.ok(contentRoles.every(role => role.role === 'content_contributor'));
    assert.ok(contentRoles.some(role => role.id === contentFixture.roleId && role.projectId === contentFixture.projectId));
    assert.equal(await db.operatingSpaceMember.count({ where: { identityId: contributor.id, active: true } }), 0);
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id: guest.ticketId } });
    assert.equal(ticket.serviceOrderId, guest.orderId); assert.ok(ticket.threadId);
    supportThread = await db.thread.findUniqueOrThrow({ where: { id: ticket.threadId } });
    assert.equal(supportThread.contextType, 'ticket'); assert.equal(supportThread.contextId, ticket.id);
    assert.ok(await db.threadParticipant.findUnique({ where: { threadId_identityId: { threadId: supportThread.id, identityId: contributor.id } } }));
    before = await snapshot();
    report.fixture = { staffId: staff.id, contributorId: contributor.id, creatorId: creator.id, spaceId: staffSpace.id,
      creationSpaceId: creationFixture.spaceId, projectId: fixture.projectId, unitId: fixture.unitId, supportThreadId: supportThread.id };
  });
  browser = await chromium.launch({ headless: true });
  const staffPage = await context('staff'); const contentPage = await context('content');
  const creatorPage = await context('creator'); const adminPage = await context('admin');
  await step('Staff starts Personal, switches by keyboard to real Operations, and retains five stable tabs', staffPage, async () => {
    await login(staffPage, staff); await assertTabs(staffPage, 'Personal', 'My');
    await noOverflow(staffPage, 'personal-home', 'Personal', 'My');
    await keyboardMode(staffPage, 'Property', '/ops', 'Today'); await assertTabs(staffPage, 'Property', 'Today');
    const choose = switcher(staffPage).getByRole('combobox', { name: 'Property workspace', exact: true });
    const values = await choose.locator('option').evaluateAll(options => options.map(option => option.value));
    assert.ok(values.includes(`space:${staffSpace.id}`));
    await choose.selectOption(`space:${staffSpace.id}`);
    await staffPage.waitForURL(url => url.pathname === `/ops/spaces/${staffSpace.id}`);
    await staffPage.getByRole('heading', { name: staffSpace.name, exact: true }).waitFor(); await assertTabs(staffPage, 'Property', 'Today');
    await noOverflow(staffPage, 'staff-space', 'Property', 'Today');
    await nav(staffPage).getByRole('link', { name: 'Properties', exact: true }).click();
    await staffPage.waitForURL(url => url.searchParams.get('workspaceTab') === 'properties');
    await assertTabs(staffPage, 'Property', 'Properties');
  });
  const boardScope = { spaceId: staffSpace.id, projectId: fixture.projectId, unitId: fixture.unitId, start: fixture.startDate, days: '7' };
  const board = `/ops/calendar/board?${new URLSearchParams(boardScope)}`;
  await step('Authorized calendar and Tasks keep exact property, home, space, dates and back destination', staffPage, async () => {
    await nav(staffPage).getByRole('link', { name: 'Calendar', exact: true }).click();
    await staffPage.waitForURL(url => url.pathname === '/ops/calendar/board');
    await staffPage.getByRole('heading', { name: 'Portfolio stay calendar', exact: true }).waitFor();
    assertScope(staffPage.url(), { spaceId: staffSpace.id, projectId: fixture.projectId }, ['organizationId', 'mc']);
    await staffPage.goto(board); await assertTabs(staffPage, 'Property', 'Calendar');
    const filters = staffPage.getByRole('region', { name: 'Calendar filters', exact: true });
    // Wrapped labels contain option text too. Identify each actual filter by its
    // canonical fixture option, within the labelled Calendar filters region.
    const projectFilter = filters.locator('select').filter({ has: staffPage.locator(`option[value="${fixture.projectId}"]`) });
    const unitFilter = filters.locator('select').filter({ has: staffPage.locator(`option[value="${fixture.unitId}"]`) });
    assert.equal(await projectFilter.count(), 1); assert.equal(await unitFilter.count(), 1);
    assert.equal(await projectFilter.inputValue(), fixture.projectId);
    assert.equal(await unitFilter.inputValue(), fixture.unitId);
    const agenda = staffPage.getByRole('region', { name: 'Mobile occupancy agenda', exact: true });
    await agenda.getByText(fixture.unitName, { exact: true }).waitFor();
    assert.equal(await agenda.getByText(fixture.tariffUnitName, { exact: true }).count(), 0);
    await noOverflow(staffPage, 'scoped-calendar', 'Property', 'Calendar');
    const more = await openMore(staffPage);
    assert.equal(await more.getByRole('link', { name: 'Reservations', exact: true }).count(), 0);
    assert.equal(await more.getByRole('link', { name: 'Administration', exact: true }).count(), 0);
    const tasks = more.getByRole('link', { name: 'Tasks', exact: true });
    const taskUrl = assertScope(await tasks.getAttribute('href'), { spaceId: staffSpace.id, projectId: fixture.projectId, unitId: fixture.unitId }, ['organizationId', 'mc']);
    assertScope(taskUrl.searchParams.get('returnTo'), boardScope, ['organizationId', 'mc']);
    await tasks.focus(); await staffPage.keyboard.press('Enter');
    await staffPage.waitForURL(url => url.pathname === '/ops/tasks');
    await staffPage.getByRole('heading', { name: 'Housekeeping & readiness', exact: true }).waitFor();
    await assertTabs(staffPage, 'Property', 'More');
    assert.equal(await staffPage.locator('form select[name="unitId"]').inputValue(), fixture.unitId);
    const back = staffPage.getByRole('link', { name: '← Calendar', exact: true });
    assertScope(await back.getAttribute('href'), boardScope, ['organizationId', 'mc']);
    await back.click(); await staffPage.waitForURL(url => url.pathname === '/ops/calendar/board');
    assertScope(staffPage.url(), boardScope, ['organizationId', 'mc']); await assertTabs(staffPage, 'Property', 'Calendar');
  });
  await step('Messages and browser Back preserve staff scope; forged IDs cannot expand navigation scope', staffPage, async () => {
    const messageScope = { workspace: 'property', workspaceOption: `space:${staffSpace.id}`, spaceId: staffSpace.id, projectId: fixture.projectId, unitId: fixture.unitId };
    const messages = nav(staffPage).getByRole('link', { name: 'Messages', exact: true });
    assertScope(await messages.getAttribute('href'), messageScope);
    await messages.click(); await staffPage.waitForURL(url => url.pathname === '/messages');
    await staffPage.getByRole('heading', { name: 'Messages', exact: true }).waitFor();
    assertScope(staffPage.url(), messageScope); await assertTabs(staffPage, 'Property', 'Messages');
    await staffPage.goBack(); await staffPage.waitForURL(url => url.pathname === '/ops/calendar/board');
    assertScope(staffPage.url(), boardScope); await assertTabs(staffPage, 'Property', 'Calendar');
    await staffPage.goto(`/messages?${new URLSearchParams({ ...messageScope, projectId: creationFixture.hiddenProjectId, unitId: creationFixture.hiddenUnitId, organizationId: creationFixture.organizationId })}`);
    await assertTabs(staffPage, 'Property', 'Messages');
    const href = await nav(staffPage).getByRole('link', { name: 'Calendar', exact: true }).getAttribute('href');
    assertScope(href, { spaceId: staffSpace.id, projectId: fixture.projectId }, ['unitId', 'organizationId', 'mc']);
    await nav(staffPage).getByRole('link', { name: 'Calendar', exact: true }).click();
    await staffPage.getByRole('heading', { name: 'Portfolio stay calendar', exact: true }).waitFor();
    assert.equal(await staffPage.getByText('Synthetic Employee Hidden Condo', { exact: true }).count(), 0);
    // This staff fixture has calendar/tasks but deliberately lacks reservations.
    await staffPage.goto(`/ops/reservations?spaceId=${staffSpace.id}`);
    await staffPage.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
    assert.equal(await staffPage.getByRole('button', { name: 'Create reservation', exact: true }).count(), 0);
    assert.equal((await json(await get(staffPage, '/api/auth/me'))).id, staff.id);
  });
  await step('Content-only employee chooses the actual editor; unavailable slots explain and restore keyboard focus', contentPage, async () => {
    await login(contentPage, contributor); await assertTabs(contentPage, 'Personal', 'My');
    await keyboardMode(contentPage, 'Property', '/property', 'Your property workspace');
    await assertTabs(contentPage, 'Property', 'Properties');
    for (const label of ['Today', 'Calendar']) await unavailable(contentPage, label, '/property');
    const more = await openMore(contentPage);
    assert.deepEqual(await more.getByRole('link').evaluateAll(links => links.map(link => new URL(link.href).pathname)), ['/property/content', '/account']);
    await more.getByRole('link', { name: 'Descriptions and photos', exact: true }).click();
    await contentPage.waitForURL(url => url.pathname === '/property/content');
    await contentPage.getByRole('heading', { name: 'Content proposals', exact: true }).waitFor();
    await contentPage.getByLabel('Property to edit', { exact: true }).waitFor();
    const targets = await json(await get(contentPage, CONTENT));
    assert.ok(targets.targets.some(target => target.scope === 'project' && target.id === contentFixture.projectId));
    assert.equal(targets.targets.some(target => target.id === creationFixture.hiddenProjectId), false);
    await assertTabs(contentPage, 'Property', 'More'); await noOverflow(contentPage, 'content-only', 'Property', 'More');
  });
  await step('Existing authorized conversation keeps work context through inbox, thread and Back; Personal clears it', contentPage, async () => {
    await nav(contentPage).getByRole('link', { name: 'Messages', exact: true }).click();
    await contentPage.getByRole('heading', { name: 'Messages', exact: true }).waitFor();
    const work = { workspace: 'property', workspaceOption: 'property' };
    const thread = contentPage.locator(`a[href^="/messages/${supportThread.id}?"]`);
    assert.equal(await thread.count(), 1); assertScope(await thread.getAttribute('href'), work, ['projectId', 'spaceId', 'unitId', 'organizationId']);
    const response = contentPage.waitForResponse(res => new URL(res.url()).pathname === `/api/threads/${supportThread.id}` && res.request().method() === 'GET');
    await thread.click(); assert.equal((await json(await response)).thread.id, supportThread.id);
    await contentPage.getByPlaceholder('Write a message…', { exact: true }).waitFor();
    await assertTabs(contentPage, 'Property', 'Messages'); assertScope(contentPage.url(), work);
    const back = contentPage.getByRole('link', { name: '← Messages', exact: true });
    assertScope(await back.getAttribute('href'), work); await back.click();
    await contentPage.waitForURL(url => url.pathname === '/messages'); await assertTabs(contentPage, 'Property', 'Messages');
    await keyboardMode(contentPage, 'Personal', '/app', 'Everything connected to you.'); await assertTabs(contentPage, 'Personal', 'My');
    await nav(contentPage).getByRole('link', { name: 'Messages', exact: true }).click();
    await contentPage.getByRole('heading', { name: 'Messages', exact: true }).waitFor();
    assertScope(contentPage.url(), { workspace: 'personal' }, ['workspaceOption', 'projectId', 'spaceId', 'unitId', 'organizationId']);
    const personalThread = contentPage.locator(`a[href^="/messages/${supportThread.id}?"]`);
    assertScope(await personalThread.getAttribute('href'), { workspace: 'personal' }, ['workspaceOption', 'projectId', 'spaceId']);
    await personalThread.click(); await contentPage.getByPlaceholder('Write a message…', { exact: true }).waitFor();
    await assertTabs(contentPage, 'Personal', 'Messages');
    assertScope(await contentPage.getByRole('link', { name: '← Messages', exact: true }).getAttribute('href'), { workspace: 'personal' }, ['workspaceOption', 'projectId', 'spaceId']);
  });
  await step('Creation-only membership opens the exact complex-draft workflow without operations grants', creatorPage, async () => {
    await login(creatorPage, creator); await assertTabs(creatorPage, 'Personal', 'My');
    await keyboardMode(creatorPage, 'Property', '/property/create', 'Create a property draft');
    await assertTabs(creatorPage, 'Property', 'Properties');
    const creation = await json(await get(creatorPage, CREATION));
    assert.equal(creation.spaces.length, 1); assert.equal(creation.spaces[0].id, creationFixture.spaceId);
    assert.equal(creation.spaces[0].canCreateComplex, true); assert.equal(creation.spaces[0].canCreateUnit, false);
    await creatorPage.getByLabel('Workspace', { exact: true }).selectOption(creationFixture.spaceId);
    assert.deepEqual(await creatorPage.getByLabel('What are you creating?', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean)), ['complex']);
    for (const label of ['Today', 'Calendar']) await unavailable(creatorPage, label, '/property/create');
    const more = await openMore(creatorPage);
    assert.deepEqual(await more.getByRole('link').evaluateAll(links => links.map(link => new URL(link.href).pathname)), ['/property/create', '/account']);
    await more.getByRole('button', { name: 'Close', exact: true }).click();
    await noOverflow(creatorPage, 'creation-only', 'Property', 'Properties');
  });
  await step('Content-only and creation-only identities cannot obtain pricing, delegation or operations through URLs or APIs', contentPage, async () => {
    await noOpsOrPricing(contentPage, contributor, staffSpace.id);
    await noOpsOrPricing(creatorPage, creator, creationFixture.spaceId);
    assert.deepEqual(await json(await get(contentPage, CREATION)), { spaces: [], items: [] });
    await denied(await get(creatorPage, `/api/threads/${supportThread.id}?workspace=property&workspaceOption=creation`), 404, 'Resource not found.');
    await denied(await get(contentPage, `${CONTENT}/target?scope=unit&id=${fixture.unitId}`), 403, 'This content target is not assigned to you.');
  });
  await step('A stored work preference never hijacks discovery; administration never shows guest tabs', adminPage, async () => {
    await keyboardMode(contentPage, 'Property', '/property', 'Your property workspace');
    await assertTabs(contentPage, 'Property', 'Properties');
    assert.deepEqual(await contentPage.evaluate(id => JSON.parse(localStorage.getItem(`myuno.workspace.v1:${encodeURIComponent(id)}`)), contributor.id), { mode: 'property', optionId: 'property' });
    await contentPage.goto('/search'); await assertTabs(contentPage, 'Personal', 'Explore');
    await login(adminPage, founder); await assertTabs(adminPage, 'Personal', 'My');
    await adminPage.goto('/app/admin/people');
    await adminPage.getByRole('link', { name: 'Employee sign-in link', exact: true }).waitFor();
    await adminPage.getByRole('navigation', { name: 'Admin workspace', exact: true }).waitFor();
    assert.equal(await nav(adminPage).count(), 0);
    assert.equal(await switcher(adminPage).locator('button[aria-pressed="true"]').count(), 0);
    await switcher(adminPage).getByText('Administration', { exact: true }).waitFor();
    await keyboardMode(adminPage, 'Personal', '/app', 'Everything connected to you.'); await assertTabs(adminPage, 'Personal', 'My');
  });
  await step('Navigation does not alter prior permissions, identities, inventory, booking snapshots, tasks or message content', null, async () => {
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  });
  report.result = 'passed'; console.log(`PASS workspace navigation journey: ${report.steps.length} checks`);
} catch (error) {
  report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1;
} finally {
  for (const { ctx } of contexts) await ctx.close().catch(() => {});
  await browser?.close(); await db.$disconnect(); await persist();
}
