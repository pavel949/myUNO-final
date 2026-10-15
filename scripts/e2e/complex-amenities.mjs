import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Refuse any real database, external application or configured integration.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const report = { headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], pageErrors: [], serverErrors: [], reservationResponses: [], blockedBrowserOrigins: [], result: 'running',
  limits: ['Only synthetic localhost data is used. No real employee grants, production writes or uploads. One separate synthetic live reservation is a positive control.', 'The existing admin shell blocks non-admin staff even when the content API permits the exact project. Employee proposal UX is a separate slice.'] };
const contexts = [];
const clone = value => JSON.parse(JSON.stringify(value));
const customHours = { monday: [['08:00', '12:00'], ['14:00', '20:00']], timezone: 'Asia/Bangkok' };
let fixture, browser, project, unit, reception, cinema, gym, native, ordinaryDraft, originalUnit, originalProject;
let originalExistingPeople, originalExistingRoles, createdRoleIds = [];
async function persist() { await writeFile('browser-results/complex-amenities-result.json', JSON.stringify(report, null, 2)); }
async function step(name, page, work) {
  const item = { name, status: 'running' }; report.steps.push(item);
  try {
    await work(); item.status = 'passed'; console.log(`PASS ${name}`);
    if (page) await page.screenshot({ path: `browser-results/complex-amenities-${report.steps.length}.png`, fullPage: true });
  } catch (error) {
    item.status = 'failed'; item.error = String(error);
    if (page) await page.screenshot({ path: `browser-results/complex-amenities-${report.steps.length}-failed.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await persist(); }
}
async function context(name, mobile = false) {
  const ctx = await browser.newContext({ baseURL: baseUrl, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
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
      if (new URL(response.url()).origin === baseUrl && response.status() >= 500) report.serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false }); return ctx;
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email); await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await response).status(), 200); await page.waitForURL(url => url.pathname === next);
}
function editor(page) { return page.locator('form').filter({ has: page.getByRole('button', { name: 'Save amenity', exact: true }) }); }
async function select(page, name) { await page.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click(); }
async function save(page, id, status = 200) {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/projects/${project.id}/amenities/${id}` && res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save amenity', exact: true }).click(); const res = await response;
  assert.equal(res.status(), status, await res.text());
  await page.getByRole('status').filter({ hasText: status === 200 ? /^Amenity saved\.$/ : /changed since you opened/ }).waitFor();
  if (status === 200) await page.getByRole('button', { name: 'Save amenity', exact: true }).waitFor({ state: 'visible' });
}
async function canonical(id) { return db.projectAmenity.findUniqueOrThrow({ where: { id } }); }
async function expectNotFound(page, path) {
  const response = await page.goto(path); const text = await page.locator('body').innerText();
  assert.ok(response.status() === 404 || /not found|couldn.t find|doesn.t exist|страница не найдена/i.test(text), `Expected not-found page for ${path}, got ${response.status()}`);
}
try {
  await mkdir('browser-results', { recursive: true }); fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  await step('Prepare distinct synthetic managed draft complex without modifying prior inventory or identities', null, async () => {
    assert.equal(fixture.staffEmail, 'staff@browser.example.test'); assert.equal(fixture.founderEmail, 'founder@browser.example.test');
    const founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } }); assert.equal(founder.isAdmin, true);
    originalExistingPeople = clone(await db.identity.findMany({ select: { id: true, email: true, isAdmin: true, status: true }, orderBy: { id: 'asc' } }));
    originalExistingRoles = clone(await db.roleAssignment.findMany({ orderBy: { id: 'asc' } }));
    assert.equal(await db.project.count({ where: { slug: 'synthetic-amenities-complex' } }), 0, 'No reset or reuse of modified fixtures');
    const data = { name: 'Synthetic Amenities Complex', projectType: 'condominium', areaLabelKey: 'browser.amenities.area',
      descriptionKey: 'browser.amenities.description', handbookKey: 'browser.amenities.handbook', latitude: '8.01', longitude: '98.30',
      address: 'Synthetic amenity address only', timezone: 'Asia/Bangkok', status: 'draft' };
    project = await db.project.create({ data: { ...data, slug: 'synthetic-amenities-complex' } });
    ordinaryDraft = await db.project.create({ data: { ...data, slug: 'synthetic-unmanaged-amenities', name: 'Synthetic Unmanaged Draft' } });
    unit = await db.unit.create({ data: { projectId: project.id, name: 'Synthetic Amenities Condo', unitType: 'condo', bedrooms: 1,
      bathrooms: 1, maxGuests: 2, addressSupplement: 'A101', amenityKeys: ['wifi'], baseNightlyThb: 100000, minNights: 1, instantBook: false, status: 'draft' } });
    const system = await db.externalSystem.create({ data: { system_key: 'layantara_os', environment: 'synthetic_amenity_browser', display_name: 'Synthetic browser only' } });
    await db.externalMapping.createMany({ data: [['project', project.id], ['unit', unit.id]].map(([entity_type, internal_id]) => ({ external_system_id: system.id, entity_type, internal_id, external_id: `synthetic-${internal_id}` })) });
    for (const [identityId, role] of [[fixture.staffId, 'staff_ops'], [fixture.serviceCustomerId, 'content_contributor']]) {
      const assignment = await db.roleAssignment.create({ data: { identityId, role, scopeType: 'project', projectId: project.id, status: 'active', grantedByIdentityId: founder.id } });
      createdRoleIds.push(assignment.id);
    }
    await db.projectStaffPermission.create({ data: { projectId: project.id, identityId: fixture.staffId, departments: ['content'] } });
    const amenity = { projectId: project.id, published: true, accessType: 'not_specified', pricingType: 'not_specified' };
    reception = await db.projectAmenity.create({ data: { ...amenity, slug: 'reception', name: 'Synthetic Reception', sort: 1,
      openingHours: { daily: '00:00–24:00', staffContact: '09:00–24:00', timezone: 'Asia/Bangkok' } } });
    cinema = await db.projectAmenity.create({ data: { ...amenity, slug: 'cinema', name: 'Synthetic Cinema', sort: 2 } });
    gym = await db.projectAmenity.create({ data: { ...amenity, slug: 'gym', name: 'Synthetic Gym', sort: 3, openingHours: customHours } });
    native = await db.projectAmenity.create({ data: { ...amenity, slug: 'native-sentinel', name: 'Synthetic Native Sentinel', sort: 4,
      bookingRequired: true, bookingMode: 'time_slot', reservationConfig: { slotMinutes: 60, autoConfirm: true } } });
    originalUnit = clone(unit); originalProject = clone(project);
    report.fixture = { projectId: project.id, unitId: unit.id, amenityIds: [reception.id, cinema.id, gym.id, native.id], createdRoleIds };
  });
  browser = await chromium.launch({ headless: true });
  const adminEditor = await context('amenities-admin-editor'); const sp = await adminEditor.newPage();
  const publicContext = await context('amenities-public-mobile', true); const pp = await publicContext.newPage();
  const admin = await context('amenities-admin'); const ap = await admin.newPage();
  const path = `/app/admin/projects/${project.id}/experience`;
  await step('Administrator opens the real editor and unchanged midnight schedule round-trips', sp, async () => {
    await login(sp, fixture.founderEmail, path);
    await sp.getByRole('heading', { name: project.name, exact: true }).waitFor();
    assert.equal(await editor(sp).getByRole('combobox', { name: /^Schedule format/ }).inputValue(), 'daily');
    assert.equal(await editor(sp).getByLabel('Open / accessible 24 hours', { exact: true }).isChecked(), true);
    assert.equal(await editor(sp).getByLabel('Staff contact until (optional)', { exact: true }).inputValue(), '00:00');
    await save(sp, reception.id);
    const row = await canonical(reception.id);
    assert.deepEqual(row.openingHours.daily, [['00:00', '24:00']]); assert.deepEqual(row.openingHours.staffContact, [['09:00', '24:00']]);
    assert.equal(row.bookingMode, 'none'); assert.equal(row.priceThb, null);
  });
  await step('Save daily access and separate staff hours, then reload exact persisted input', sp, async () => {
    await editor(sp).getByLabel('Location / floor inside complex', { exact: true }).fill('Floor 1');
    await editor(sp).getByLabel('Staff contact until (optional)', { exact: true }).fill('18:00');
    await save(sp, reception.id); await sp.reload();
    assert.equal(await editor(sp).getByLabel('Location / floor inside complex', { exact: true }).inputValue(), 'Floor 1');
    assert.equal(await editor(sp).getByLabel('Staff contact until (optional)', { exact: true }).inputValue(), '18:00');
    assert.equal(await editor(sp).getByLabel('Open / accessible 24 hours', { exact: true }).isChecked(), true);
  });
  await step('Two actual editor tabs detect stale saves and retain the losing input without overwriting canonical content', sp, async () => {
    const stale = await adminEditor.newPage(); await stale.goto(path);
    await editor(stale).getByLabel('Location / floor inside complex', { exact: true }).fill('Unsaved Floor 9');
    await editor(sp).getByLabel('Full guest description', { exact: true }).fill('Synthetic reception: access all day; staff contact 09:00–18:00.');
    await save(sp, reception.id); const before = clone(await canonical(reception.id));
    await save(stale, reception.id, 409);
    assert.equal(await editor(stale).getByLabel('Location / floor inside complex', { exact: true }).inputValue(), 'Unsaved Floor 9');
    assert.deepEqual(clone(await canonical(reception.id)), before); await stale.close();
  });
  await step('Existing weekly split schedule remains custom and unchanged on an unrelated descriptive edit', sp, async () => {
    await select(sp, gym.name);
    assert.equal(await editor(sp).getByRole('combobox', { name: /^Schedule format/ }).inputValue(), 'custom');
    await editor(sp).getByLabel('Full guest description', { exact: true }).fill('Bring your own exercise equipment.');
    await save(sp, gym.id); assert.deepEqual((await canonical(gym.id)).openingHours, customHours);
  });
  await step('Cinema rules and one-day advance notice save through ordinary controls without activating reservations', sp, async () => {
    await select(sp, cinema.name);
    await editor(sp).getByLabel('Location / floor inside complex', { exact: true }).fill('Floor 2');
    await editor(sp).getByLabel('Opens at', { exact: true }).fill('08:00'); await editor(sp).getByLabel('Closes at', { exact: true }).fill('20:00');
    await editor(sp).getByLabel('Advance booking / reservation required', { exact: true }).check();
    await editor(sp).getByLabel('Booking method', { exact: true }).fill('none');
    await editor(sp).getByLabel('Minimum booking notice', { exact: true }).fill('1');
    await editor(sp).getByRole('combobox', { name: /^Notice unit/ }).selectOption('1440');
    await editor(sp).getByLabel('Visitor and usage rules', { exact: true }).fill('Bring your own streaming account.\nNo food or drinks.');
    await save(sp, cinema.id); const row = await canonical(cinema.id);
    assert.equal(row.bookingRequired, true); assert.equal(row.bookingMode, 'other'); assert.equal(row.reservationConfig.minLeadMinutes, 1440);
    assert.deepEqual(row.openingHours.daily, [['08:00', '20:00']]); assert.deepEqual(row.rules, ['Bring your own streaming account.', 'No food or drinks.']);
    assert.equal(row.pricingType, 'not_specified'); assert.equal(row.priceThb, null);
  });
  await step('Common facility picker creates only an unpublished draft with unknown costs and no native booking', sp, async () => {
    const form = sp.locator('form').filter({ has: sp.getByRole('heading', { name: 'Add amenity or facility', exact: true }) });
    await form.getByRole('combobox', { name: /^Choose a common facility/ }).selectOption('Sauna');
    const response = sp.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/projects/${project.id}/amenities` && res.request().method() === 'POST');
    await form.getByRole('button', { name: 'Add draft', exact: true }).click(); assert.equal((await response).status(), 201);
    await sp.getByRole('status').filter({ hasText: 'Amenity created as draft.' }).waitFor();
    const row = await db.projectAmenity.findUniqueOrThrow({ where: { projectId_slug: { projectId: project.id, slug: 'sauna' } } });
    assert.equal(row.published, false); assert.equal(row.bookingMode, 'none'); assert.equal(row.bookingRequired, false);
    assert.equal(row.pricingType, 'not_specified'); assert.equal(row.priceThb, null);
  });
  await step('Managed draft public complex and linked unit show canonical shared facilities on mobile', pp, async () => {
    await pp.goto(`/projects/${project.slug}`); await pp.getByRole('heading', { name: project.name, exact: true }).waitFor();
    await pp.getByRole('heading', { name: reception.name, exact: true }).waitFor();
    const receptionCard = pp.getByRole('link').filter({ has: pp.getByRole('heading', { name: reception.name, exact: true }) });
    await receptionCard.getByText('Floor 1', { exact: true }).waitFor(); await receptionCard.getByText('00:00–24:00', { exact: true }).waitFor();
    await pp.goto(`/units/${unit.id}`); await pp.getByRole('heading', { name: 'Shared complex facilities', exact: true }).waitFor();
    await pp.getByRole('heading', { name: cinema.name, exact: true }).waitFor();
    assert.ok(await pp.locator('body').evaluate(node => node.scrollWidth <= window.innerWidth), 'Shared facilities must fit a 390px viewport');
    assert.deepEqual(clone(await db.unit.findUniqueOrThrow({ where: { id: unit.id } })), originalUnit, 'Complex facilities never mutate unit facts or amenityKeys');
  });
  await step('Public details distinguish 24-hour access, staff hours, notice, rules and unknown fee/contact', pp, async () => {
    await pp.goto(`/projects/${project.slug}/amenities/reception`);
    await pp.getByText('Daily access: 24 hours', { exact: true }).waitFor();
    await pp.getByText('Staff contact hours: 09:00–18:00', { exact: true }).waitFor();
    await pp.goto(`/projects/${project.slug}/amenities/cinema`);
    await pp.getByText('Daily access: 08:00–20:00', { exact: true }).waitFor();
    await pp.getByText('Book at least 1 day(s) in advance', { exact: true }).waitFor();
    await pp.getByText('No food or drinks.', { exact: true }).waitFor();
    await pp.getByText('Advance booking required; booking method not specified', { exact: false }).waitFor();
    assert.equal(await pp.getByRole('link', { name: 'Book this amenity', exact: true }).count(), 0);
    await pp.goto(`/projects/${project.slug}/amenities`);
    await pp.getByRole('heading', { name: cinema.name, exact: true }).waitFor();
    assert.equal(await pp.getByRole('heading', { name: 'Sauna', exact: true }).count(), 0, 'Unpublished drafts must not leak');
  });
  await step('Existing staff shell boundary is explicit: exact-project content API reads work but the admin page redirects', null, async () => {
    const sc = await context('amenities-staff-boundary'); const staffPage = await sc.newPage();
    await login(staffPage, fixture.staffEmail, '/');
    await staffPage.goto(path); await staffPage.waitForURL(url => url.pathname === '/');
    assert.equal((await staffPage.request.get(`/api/admin/projects/${project.id}/amenities`)).status(), 200);
    assert.equal(await staffPage.getByRole('button', { name: 'Save amenity', exact: true }).count(), 0);
  });
  await step('Contributor-only identity cannot use direct complex editor API or change canonical facilities', null, async () => {
    const cc = await context('amenities-contributor'); const cp = await cc.newPage(); await login(cp, fixture.serviceCustomerEmail, '/property/content');
    const before = clone(await canonical(cinema.id));
    const response = await cp.request.patch(`/api/admin/projects/${project.id}/amenities/${cinema.id}`, { data: { expectedUpdatedAt: before.updatedAt, name: 'Forbidden' } });
    assert.equal(response.status(), 403); assert.deepEqual(clone(await canonical(cinema.id)), before);
  });
  await step('Native booking stays unavailable for managed draft and archived projects, including privileged direct API calls', pp, async () => {
    await pp.goto(`/projects/${project.slug}/amenities/${native.slug}`); await pp.getByRole('heading', { name: native.name, exact: true }).waitFor();
    assert.equal(await pp.getByRole('link', { name: 'Book this amenity', exact: true }).count(), 0);
    await expectNotFound(pp, `/projects/${project.slug}/amenities/${native.slug}/book`);
    await expectNotFound(pp, `/projects/${ordinaryDraft.slug}/amenities`);
    await login(ap, fixture.founderEmail, path);
    const startAt = new Date(Date.now() + 3 * 86400000); const endAt = new Date(startAt.getTime() + 3600000);
    const rejectReservation = async () => {
      const res = await ap.request.post(`/api/project-amenities/${native.id}/reservations`, { data: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), partySize: 1 } });
      report.reservationResponses.push({ projectStatus: (await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, status: res.status() });
      assert.equal(res.status(), 404, await res.text());
      assert.equal((await res.json()).error, 'Resource not found.');
      assert.equal(await db.projectAmenityReservation.count({ where: { amenityId: native.id } }), 0);
    };
    await rejectReservation();
    // A distinct live control proves authentication and this same time/party payload
    // can reach the real writer. Neither draft nor archived target is made live.
    const controlProject = await db.project.create({ data: { slug: 'synthetic-amenities-live-control', name: 'Synthetic live control',
      areaLabelKey: 'browser.amenities.area', descriptionKey: 'browser.amenities.description', handbookKey: 'browser.amenities.handbook',
      latitude: '8.01', longitude: '98.30', address: 'Synthetic control only', timezone: 'Asia/Bangkok', status: 'live' } });
    const controlAmenity = await db.projectAmenity.create({ data: { projectId: controlProject.id, slug: 'control', name: 'Synthetic reservation control',
      published: true, bookingRequired: true, bookingMode: 'time_slot', reservationConfig: { slotMinutes: 60, autoConfirm: true } } });
    const control = await ap.request.post(`/api/project-amenities/${controlAmenity.id}/reservations`, { data: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), partySize: 1 } });
    assert.equal(control.status(), 201, await control.text());
    const controlBody = await control.json(); assert.equal(controlBody.reservation.amenityId, controlAmenity.id); assert.equal(controlBody.reservation.status, 'confirmed');
    assert.equal(await db.projectAmenityReservation.count({ where: { amenityId: controlAmenity.id } }), 1);
    report.reservationResponses.push({ projectStatus: 'live-control', status: control.status(), reservationId: controlBody.reservation.id });
    assert.deepEqual(clone(await db.project.findUniqueOrThrow({ where: { id: project.id } })), originalProject, 'Content editor never publishes the project');
    await db.project.update({ where: { id: project.id }, data: { status: 'archived' } });
    await rejectReservation(); await expectNotFound(pp, `/projects/${project.slug}/amenities/${native.slug}`);
    assert.deepEqual(clone(await db.identity.findMany({ select: { id: true, email: true, isAdmin: true, status: true }, orderBy: { id: 'asc' } })), originalExistingPeople);
    assert.deepEqual(clone(await db.roleAssignment.findMany({ where: { id: { notIn: createdRoleIds } }, orderBy: { id: 'asc' } })), originalExistingRoles);
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally {
  for (const { ctx, name } of contexts) { await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {}); await ctx.close().catch(() => {}); }
  if (browser) await browser.close(); await db.$disconnect(); await persist();
}
