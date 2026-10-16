import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Run from the repository root after the existing seed/journeys, with the same
// localhost application already running. Never start/reset a DB or server here.
// This exact disposable guard must run BEFORE loading Prisma or Chromium.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const API = '/api/property-content-proposals';
const stem = 'project-amenity-content';
const report = {
  headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running',
  limits: [
    'Requires the existing isolated CI fixture, PostgreSQL, Chromium, and running localhost application. This script does not install, start, reset, publish, deploy or contact external services.',
    'Tests EN/RU content and mobile Chromium; TH/ZH visual parity, upload transport, native booking success and older v1 proposals remain covered separately or unverified here.',
  ],
};
const contexts = [];
const clone = value => JSON.parse(JSON.stringify(value));
const BASE_DESCRIPTION = 'Canonical synthetic reception description. No real property data.';
const EN_DESCRIPTION = 'Existing English reception translation must remain unchanged.';
const RU_DESCRIPTION = 'Исходное русское описание синтетической приёмной.';
const RU_NAME = 'Синтетическая приёмная для проверки';
const EN_SUMMARY = 'Existing English summary remains the public fallback.';
const RU_SUMMARY = 'Исходное краткое описание приёмной.';
const NEW_DESCRIPTION = 'Синтетическая приёмная доступна круглосуточно.\nСотрудники отвечают с 09:00 до 18:00.\nПосетителям следует соблюдать правила комплекса.';
const LOCATION = 'Level 2, East Wing, beside the lift';
const RULES = ['Bring your synthetic access pass.', 'No food or drinks.', 'Keep the passage clear.'];
const NEW_NAME = 'Synthetic Proposal Reading Room';
const GYM_DESCRIPTION = 'Synthetic gym description updated without replacing its weekly split schedule.';
const customHours = {
  monday: [['08:00', '12:00'], ['14:00', '20:00']],
  thursday: [['07:30', '11:30'], ['16:00', '21:00']],
  seasonal: { rainySeason: 'Ask the synthetic desk' },
  staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok',
};
const customRules = { visitors: ['Bring a towel'], equipment: { ownEquipment: true } };
let fixture, browser, project, unit, reception, gym, untouched, foreignProject, foreignAmenity;
let founderId, contributorId, roleId, proposalId, saved, submitted, newFacility;
let original, existingPeople, existingRoles, existingProjects, existingUnits, existingAmenities, existingStaffPermissions;

async function persist() {
  await writeFile(`browser-results/${stem}-result.json`, JSON.stringify(report, null, 2));
}
async function step(name, page, work) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try {
    await work(); entry.status = 'passed'; console.log(`PASS ${name}`);
    if (page) await page.screenshot({ path: `browser-results/${stem}-${report.steps.length}.png`, fullPage: true });
  } catch (error) {
    entry.status = 'failed'; entry.error = String(error);
    if (page) await page.screenshot({ path: `browser-results/${stem}-${report.steps.length}-failed.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await persist(); }
}
async function context(name, mobile = false, locale = 'en') {
  const ctx = await browser.newContext({ baseURL: baseUrl,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  contexts.push({ ctx, name }); ctx.setDefaultTimeout(15000); ctx.setDefaultNavigationTimeout(30000);
  await ctx.addCookies([{ name: 'locale', value: locale, url: baseUrl }]);
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
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  return ctx;
}
async function json(response, expected = 200) {
  assert.equal(response.status(), expected, `Unexpected response from ${new URL(response.url()).pathname}: ${await response.text()}`);
  return response.json();
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.waitForURL(url => url.pathname === next);
  assert.equal((await page.request.get('/api/auth/me', { maxRedirects: 0 })).status(), 200);
}
const facilities = page => page.getByRole('group', { name: 'Complex facilities', exact: true });
// Scope by the stable facility editor index; its legend changes with locale/name.
const facility = (page, index) => facilities(page).locator(':scope > fieldset').nth(index);
const combo = (scope, name) => scope.getByRole('combobox', { name });
const textbox = (scope, name) => scope.getByRole('textbox', { name });
async function save(page, status = 'draft') {
  const hadId = Boolean(proposalId);
  const response = page.waitForResponse(res => [API, `${API}/${proposalId}`].includes(new URL(res.url()).pathname) && ['POST', 'PATCH'].includes(res.request().method()));
  await page.getByRole('button', { name: status === 'draft' ? 'Save draft' : 'Save and submit for review', exact: true }).click();
  const detail = await json(await response, hadId ? 200 : 201);
  proposalId = detail.id; assert.equal(detail.status, status);
  await page.getByRole('status').filter({ hasText: status === 'draft' ? /^Draft saved\.$/ : /^Submitted for administrator review\.$/ }).waitFor();
  return detail;
}
async function openReview(page) {
  await page.goto('/app/admin/property-content-proposals');
  await page.getByRole('heading', { name: 'Review property content', exact: true }).waitFor();
  await page.getByRole('button').filter({ has: page.getByText(project.name, { exact: true }) }).click();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: project.name, exact: true }) });
  await card.waitFor(); return card;
}
async function approve(page, card, id, expected = 200) {
  const button = card.getByRole('button', { name: 'Approve and apply content', exact: true });
  assert.equal(await button.isDisabled(), true);
  await card.getByRole('checkbox', { name: /^I checked the facts, description, each photo and any proposed complex facilities/ }).check();
  const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/property-content-proposals/${id}/review` && res.request().method() === 'POST');
  await button.click(); return json(await response, expected);
}
async function canonical() {
  const amenities = await db.projectAmenity.findMany({ where: { projectId: project.id }, orderBy: { id: 'asc' } });
  const keys = amenities.flatMap(row => ['name', 'shortDescription', 'description', 'accessInstructions', 'terms'].map(field => `project_amenity.${row.id}.${field}`));
  return clone({
    project: await db.project.findUniqueOrThrow({ where: { id: project.id } }),
    unit: await db.unit.findUniqueOrThrow({ where: { id: unit.id } }), amenities,
    content: await db.contentKey.findMany({ where: { key: { in: keys } }, orderBy: { key: 'asc' }, include: { translations: { orderBy: { locale: 'asc' } } } }),
    gallery: await db.projectMedia.findMany({ where: { projectId: project.id }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] }),
  });
}
function omit(row, fields) { return Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key))); }
function protectedAmenity(row) {
  return omit(row, ['updatedAt', 'name', 'shortDescription', 'description', 'locationLabel', 'accessInstructions', 'openingHours', 'rules']);
}
async function assertOriginal() { assert.deepEqual(await canonical(), original, 'Saving/submitting/denial must not write canonical facilities, translations, project, linked unit or media'); }
async function translation(amenityId, field, locale) {
  const key = await db.contentKey.findUniqueOrThrow({ where: { key: `project_amenity.${amenityId}.${field}` }, include: { translations: true } });
  return clone(key.translations.find(row => row.locale === locale));
}
async function expectNotFound(page, path) {
  const response = await page.goto(path);
  // Next can stream its not-found boundary after committing HTTP 200.
  // The exact rendered boundary is required for either transport status.
  await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
  assert.ok([200, 404].includes(response.status()), `Expected not-found for ${path}, got ${response.status()}`);
  assert.equal(new URL(page.url()).pathname, path);
  const text = await page.locator('body').innerText();
  for (const value of [newFacility.name, newFacility.description, newFacility.locationLabel].filter(Boolean)) {
    assert.equal(text.includes(value), false, `Not-found must not expose facility details: ${path}`);
  }
  assert.equal(await page.getByRole('heading', { name: /^Reserve / }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Reserve', exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Start time', { exact: true }).count(), 0);
}

try {
  await mkdir('browser-results', { recursive: true });
  fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  await step('Prepare distinct synthetic facilities and one exact-project content grant, preserving earlier fixtures', null, async () => {
    assert.equal(fixture.serviceCustomerEmail, 'service-customer@browser.example.test');
    assert.equal(fixture.founderEmail, 'founder@browser.example.test');
    const contributor = await db.identity.findUniqueOrThrow({ where: { id: fixture.serviceCustomerId }, select: { id: true, email: true, isAdmin: true, status: true } });
    assert.equal(contributor.email, fixture.serviceCustomerEmail); assert.equal(contributor.isAdmin, false); assert.equal(contributor.status, 'active');
    contributorId = contributor.id;
    const founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail }, select: { id: true, isAdmin: true, status: true } });
    assert.equal(founder.isAdmin, true); assert.equal(founder.status, 'active'); founderId = founder.id;
    existingPeople = clone(await db.identity.findMany({ select: { id: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } }));
    existingRoles = clone(await db.roleAssignment.findMany({ orderBy: { id: 'asc' } }));
    existingStaffPermissions = clone(await db.projectStaffPermission.findMany({ orderBy: [{ projectId: 'asc' }, { identityId: 'asc' }] }));
    existingProjects = clone(await db.project.findMany({ orderBy: { id: 'asc' } }));
    existingUnits = clone(await db.unit.findMany({ orderBy: { id: 'asc' } }));
    existingAmenities = clone(await db.projectAmenity.findMany({ orderBy: { id: 'asc' } }));
    // Earlier runners may leave other exact-scope grants. Never widen, revoke,
    // overwrite, or assume this synthetic identity has zero previous assignments.
    assert.ok(existingRoles.filter(row => row.identityId === contributorId && row.status === 'active').every(row => row.role === 'content_contributor'), 'This journey requires a contributor-only synthetic identity');
    const slug = 'synthetic-amenity-content-proposal-estate';
    assert.equal(await db.project.count({ where: { slug: { in: [slug, `${slug}-foreign`] } } }), 0, 'Never reset/reuse a previously modified fixture');
    const projectData = { name: 'Synthetic Amenity Content Proposal Estate', projectType: 'condominium',
      areaLabelKey: 'browser.amenity_proposal.area', descriptionKey: 'browser.amenity_proposal.description', handbookKey: 'browser.amenity_proposal.handbook',
      latitude: '8.01', longitude: '98.30', address: 'Synthetic proposal address only', timezone: 'Asia/Bangkok', status: 'draft' };
    project = await db.project.create({ data: { ...projectData, slug } });
    foreignProject = await db.project.create({ data: { ...projectData, slug: `${slug}-foreign`, name: 'Synthetic Unassigned Amenity Proposal Estate' } });
    unit = await db.unit.create({ data: { projectId: project.id, name: 'Synthetic Amenity Proposal Condo Q401', unitType: 'condo', bedrooms: 1, bathrooms: 1,
      maxGuests: 2, floor: '4', addressSupplement: 'Q401', amenityKeys: ['wifi'], baseNightlyThb: 123456, minNights: 2, instantBook: false, status: 'draft' } });
    // Existing managed-import visibility seam; nothing in this journey is made live.
    const system = await db.externalSystem.create({ data: { system_key: 'layantara_os', environment: 'synthetic_amenity_content_proposal_browser', display_name: 'Synthetic content proposal browser only' } });
    await db.externalMapping.createMany({ data: [['project', project.id], ['unit', unit.id]].map(([entity_type, internal_id]) => ({ external_system_id: system.id, entity_type, internal_id, external_id: `synthetic-proposal-${internal_id}` })) });
    const common = { projectId: project.id, published: true, accessType: 'not_specified', pricingType: 'not_specified' };
    reception = await db.projectAmenity.create({ data: { ...common, slug: 'proposal-reception', name: 'Synthetic Proposal Reception', sort: 1,
      shortDescription: 'Original canonical synthetic summary.', description: BASE_DESCRIPTION, locationLabel: 'Original Floor 1',
      openingHours: { daily: [['08:00', '20:00']], staffContact: [['10:00', '16:00']], timezone: 'Asia/Bangkok' }, rules: ['Original synthetic visitor rule.'] } });
    gym = await db.projectAmenity.create({ data: { ...common, slug: 'proposal-split-gym', name: 'Synthetic Proposal Split Gym', sort: 2,
      description: 'Original synthetic gym description.', openingHours: customHours, rules: customRules,
      bookingRequired: true, bookingMode: 'other', reservationConfig: { minLeadMinutes: 1440, autoConfirm: false }, capacity: 6, minAge: 12, terms: 'Existing synthetic terms.' } });
    untouched = await db.projectAmenity.create({ data: { ...common, slug: 'proposal-untouched', name: 'Synthetic Unselected Facility', sort: 3,
      description: 'Omitted facility must never be deleted.', openingHours: customHours } });
    foreignAmenity = await db.projectAmenity.create({ data: { ...common, projectId: foreignProject.id, slug: 'foreign-proposal-facility', name: 'Synthetic Foreign Facility' } });
    for (const [field, en, ru] of [['name', reception.name, RU_NAME], ['description', EN_DESCRIPTION, RU_DESCRIPTION], ['shortDescription', EN_SUMMARY, RU_SUMMARY]]) {
      await db.contentKey.create({ data: { key: `project_amenity.${reception.id}.${field}`, namespace: 'project_amenity', description: 'Synthetic content proposal browser fixture', supportsRich: false,
        translations: { create: [{ locale: 'en', value: en, status: 'ok', updatedByIdentityId: founderId }, { locale: 'ru', value: ru, status: 'ok', updatedByIdentityId: founderId }] } } });
    }
    const role = await db.roleAssignment.create({ data: { identityId: contributorId, role: 'content_contributor', scopeType: 'project', projectId: project.id,
      status: 'active', grantedByIdentityId: founderId } });
    roleId = role.id; original = await canonical();
    report.fixture = { projectId: project.id, unitId: unit.id, amenityIds: [reception.id, gym.id, untouched.id], foreignProjectId: foreignProject.id, foreignAmenityId: foreignAmenity.id, contributorId, roleId };
  });

  browser = await chromium.launch({ headless: true });
  const cc = await context(`${stem}-contributor-mobile`, true); const cp = await cc.newPage();
  const rc = await context(`${stem}-reviewer`); const rp = await rc.newPage();
  const pc = await context(`${stem}-public-mobile`, true); const pp = await pc.newPage();
  const russian = await context(`${stem}-public-ru`, true, 'ru'); const ru = await russian.newPage();
  await step('Contributor opens the real mobile workspace and selects the exact assigned project and facility', cp, async () => {
    await login(cp, fixture.serviceCustomerEmail, '/property/content');
    await cp.getByRole('heading', { name: 'Content proposals', exact: true }).waitFor();
    const index = await json(await cp.request.get(API, { maxRedirects: 0 }));
    const targets = index.targets.filter(target => [project.id, unit.id, foreignProject.id].includes(target.id));
    assert.deepEqual(targets.map(target => ({ scope: target.scope, id: target.id, projectId: target.projectId })), [{ scope: 'project', id: project.id, projectId: project.id }]);
    await combo(cp, /^Property to edit/).selectOption(`project:${project.id}`);
    await cp.getByRole('button', { name: 'Start proposal', exact: true }).click();
    await facilities(cp).waitFor();
    await facilities(cp).getByRole('button', { name: `Edit facility: ${reception.name}`, exact: true }).click();
    await combo(facility(cp, 0), /^Facility text language/).selectOption('ru');
    assert.equal(await textbox(facility(cp, 0), /^Full description$/).inputValue(), RU_DESCRIPTION);
    assert.equal(await textbox(facility(cp, 0), /^Facility name$/).inputValue(), RU_NAME);
    assert.equal(await facilities(cp).getByRole('button', { name: `Edit facility: ${foreignAmenity.name}`, exact: true }).count(), 0);
  });
  await step('Contributor edits multiline Russian text, location, daily access, separate staff hours and visitor rules', cp, async () => {
    const editor = facility(cp, 0);
    await textbox(editor, /^Full description$/).fill(NEW_DESCRIPTION);
    await textbox(editor, /^Short description$/).fill('');
    await textbox(editor, /^Location \/ floor$/).fill(LOCATION);
    await combo(editor, /^Opening \/ access hours/).selectOption('daily');
    await editor.getByRole('checkbox', { name: /^Open \/ accessible 24 hours/ }).check();
    await textbox(editor, /^Time zone \(optional\)$/).fill('Asia/Bangkok');
    await combo(editor, /^Staff contact hours/).selectOption('range');
    await editor.getByLabel(/^Staff contact from$/).fill('09:00');
    await editor.getByLabel(/^Staff contact until$/).fill('18:00');
    await combo(editor, /^Usage rules/).selectOption('replace');
    await textbox(editor, /^Rules: one per line$/).fill(RULES.join('\n'));
    await facilities(cp).getByRole('button', { name: `Edit facility: ${gym.name}`, exact: true }).click();
    await textbox(facility(cp, 1), /^Full description$/).fill(GYM_DESCRIPTION);
    assert.equal(await combo(facility(cp, 1), /^Opening \/ access hours/).inputValue(), 'keep');
    assert.equal(await combo(facility(cp, 1), /^Staff contact hours/).inputValue(), 'keep');
    assert.equal(await combo(facility(cp, 1), /^Usage rules/).inputValue(), 'keep');
    await facilities(cp).getByRole('button', { name: 'Add facility', exact: true }).click();
    await textbox(facility(cp, 2), /^Facility name$/).fill(NEW_NAME);
    await textbox(facility(cp, 2), /^Full description$/).fill('New synthetic facility proposal.\nPublication requires a separate authorized decision.');
    await textbox(facility(cp, 2), /^Location \/ floor$/).fill('Level 3, synthetic quiet wing');
    // Staff-only contact hours do not invent access hours. This also exercises
    // the independent timezone control while access remains untouched.
    await combo(facility(cp, 2), /^Staff contact hours/).selectOption('range');
    await facility(cp, 2).getByLabel(/^Staff contact from$/).fill('10:00');
    await facility(cp, 2).getByLabel(/^Staff contact until$/).fill('16:00');
    await textbox(facility(cp, 2), /^Time zone \(optional\)$/).fill('Asia/Bangkok');
    saved = await save(cp);
    assert.equal(saved.proposal.amenities.length, 3);
    const proposed = saved.proposal.amenities[0];
    assert.equal(proposed.id, reception.id); assert.equal(proposed.locale, 'ru'); assert.equal(proposed.description, NEW_DESCRIPTION);
    assert.equal(proposed.name, RU_NAME); assert.equal(proposed.shortDescription, ''); assert.equal(proposed.locationLabel, LOCATION);
    assert.deepEqual(proposed.openingHours, { mode: 'daily', open: '00:00', close: '24:00', timezone: 'Asia/Bangkok' });
    assert.equal(proposed.staffHours.mode, 'range'); assert.equal(proposed.staffHours.open, '09:00'); assert.equal(proposed.staffHours.close, '18:00');
    assert.deepEqual(proposed.rules, { mode: 'replace', lines: RULES });
    assert.deepEqual(saved.proposal.amenities[1].openingHours, { mode: 'keep' });
    assert.deepEqual(saved.proposal.amenities[1].rules, { mode: 'keep' });
    assert.equal(saved.proposal.amenities[2].id, null);
    assert.deepEqual(saved.proposal.amenities[2].openingHours, { mode: 'keep' });
    assert.deepEqual(saved.proposal.amenities[2].staffHours, { mode: 'range', open: '10:00', close: '16:00', timezone: 'Asia/Bangkok' });
    assert.ok(await cp.locator('main').last().evaluate(node => node.scrollWidth <= window.innerWidth), 'Editor must fit a 390px viewport');
    await assertOriginal();
  });
  await step('Reload resumes the saved language, multiline text, daily and independent staff controls', cp, async () => {
    await cp.goto('/property/content');
    await cp.getByRole('button', { name: `Open proposal: ${project.name}`, exact: true }).click();
    const editor = facility(cp, 0);
    assert.equal(await combo(editor, /^Facility text language/).inputValue(), 'ru');
    assert.equal(await textbox(editor, /^Full description$/).inputValue(), NEW_DESCRIPTION);
    assert.equal(await textbox(editor, /^Short description$/).inputValue(), '');
    assert.equal(await textbox(editor, /^Location \/ floor$/).inputValue(), LOCATION);
    assert.equal(await combo(editor, /^Opening \/ access hours/).inputValue(), 'daily');
    assert.equal(await editor.getByRole('checkbox', { name: /^Open \/ accessible 24 hours/ }).isChecked(), true);
    assert.equal(await combo(editor, /^Staff contact hours/).inputValue(), 'range');
    assert.equal(await editor.getByLabel(/^Staff contact from$/).inputValue(), '09:00');
    assert.equal(await editor.getByLabel(/^Staff contact until$/).inputValue(), '18:00');
    assert.equal(await textbox(editor, /^Rules: one per line$/).inputValue(), RULES.join('\n'));
    assert.equal(await textbox(facility(cp, 1), /^Full description$/).inputValue(), GYM_DESCRIPTION);
    assert.equal(await combo(facility(cp, 1), /^Opening \/ access hours/).inputValue(), 'keep');
    assert.equal(await textbox(facility(cp, 2), /^Facility name$/).inputValue(), NEW_NAME);
    assert.equal(await combo(facility(cp, 2), /^Opening \/ access hours/).inputValue(), 'keep');
    assert.equal(await combo(facility(cp, 2), /^Staff contact hours/).inputValue(), 'range');
    assert.equal(await facility(cp, 2).getByLabel(/^Staff contact from$/).inputValue(), '10:00');
    assert.equal(await facility(cp, 2).getByLabel(/^Staff contact until$/).inputValue(), '16:00');
    assert.equal(await textbox(facility(cp, 2), /^Time zone \(optional\)$/).inputValue(), 'Asia/Bangkok');
    await assertOriginal();
  });
  await step('Commercial injection, foreign facility IDs, inherited unit scope and direct administrator writes fail closed', cp, async () => {
    for (const [scope, id] of [['project', foreignProject.id], ['unit', unit.id]]) {
      assert.equal((await cp.request.get(`${API}/target?scope=${scope}&id=${encodeURIComponent(id)}`, { maxRedirects: 0 })).status(), 403);
    }
    const patch = proposal => cp.request.patch(`${API}/${proposalId}`, { maxRedirects: 0, data: { expectedRevision: saved.revision, status: 'draft', proposal } });
    for (const [key, value] of Object.entries({ priceThb: 1, pricingType: 'free', published: true, bookingMode: 'time_slot', bookingRequired: true, reservationConfig: { autoConfirm: true }, projectId: foreignProject.id })) {
      const payload = clone(saved.proposal); payload.amenities[0][key] = value;
      assert.equal((await patch(payload)).status(), 400, `Reject contributor amenity field ${key}`);
    }
    const foreign = clone(saved.proposal); foreign.amenities[0].id = foreignAmenity.id;
    assert.equal((await patch(foreign)).status(), 403);
    const api = `/api/admin/projects/${project.id}/amenities`;
    assert.equal((await cp.request.get(api, { maxRedirects: 0 })).status(), 403);
    assert.equal((await cp.request.patch(`${api}/${reception.id}`, { maxRedirects: 0, data: { expectedUpdatedAt: reception.updatedAt.toISOString(), name: 'Forbidden direct change' } })).status(), 403);
    assert.equal((await cp.request.post(api, { maxRedirects: 0, data: { name: 'Forbidden direct facility' } })).status(), 403);
    assert.equal((await cp.request.post(`/api/admin/property-content-proposals/${proposalId}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: saved.revision } })).status(), 403);
    const unchanged = await json(await cp.request.get(`${API}/${proposalId}`, { maxRedirects: 0 }));
    assert.equal(unchanged.revision, saved.revision); assert.deepEqual(unchanged.proposal, saved.proposal);
    await assertOriginal();
  });
  await step('Submission locks the facility controls and still changes no canonical content', cp, async () => {
    submitted = await save(cp, 'submitted');
    assert.equal(await combo(facility(cp, 0), /^Facility text language/).isDisabled(), true);
    assert.equal(await textbox(facility(cp, 0), /^Full description$/).isDisabled(), true);
    assert.equal((await cp.request.patch(`${API}/${proposalId}`, { maxRedirects: 0, data: { expectedRevision: submitted.revision, status: 'draft', proposal: submitted.proposal } })).status(), 409);
    const row = await db.crmOpportunity.findUniqueOrThrow({ where: { id: proposalId } });
    assert.equal(row.identityId, contributorId); assert.equal(row.projectId, project.id); assert.equal(row.unitId, null);
    assert.equal(row.requirements.status, 'submitted'); assert.equal(row.requirements.version, 2);
    await assertOriginal();
  });
  await step('Administrator sees selected-language comparison, shared canonical fallback and effective public text', rp, async () => {
    await login(rp, fixture.founderEmail, '/app/admin/property-content-proposals');
    const card = await openReview(rp);
    const comparisons = card.getByRole('region', { name: 'Complex facilities', exact: true });
    const before = comparisons.getByRole('region', { name: 'Starting version', exact: true }).nth(0);
    const after = comparisons.getByRole('region', { name: 'Proposed version', exact: true }).nth(0);
    const preview = comparisons.getByRole('region', { name: 'Public text preview (when published)', exact: true }).nth(0);
    const fallback = comparisons.getByRole('region', { name: 'Shared fallback changes', exact: true }).nth(0);
    await comparisons.getByText(/^Facility text language: Russian/).waitFor();
    await before.getByText(RU_DESCRIPTION, { exact: true }).waitFor();
    await before.getByText(RU_SUMMARY, { exact: true }).waitFor();
    await after.getByText(NEW_DESCRIPTION, { exact: true }).waitFor();
    await after.getByText('Every day: Open / accessible 24 hours', { exact: true }).waitFor();
    await after.getByText('Staff contact hours: 09:00–18:00', { exact: true }).waitFor();
    await preview.getByText(NEW_DESCRIPTION, { exact: true }).waitFor();
    await preview.getByText(EN_SUMMARY, { exact: true }).waitFor();
    await fallback.getByText(BASE_DESCRIPTION, { exact: true }).waitFor();
    await fallback.getByText(NEW_DESCRIPTION, { exact: true }).waitFor();
    await comparisons.getByText('Not yet created', { exact: true }).waitFor();
    assert.equal(await comparisons.getByRole('region', { name: 'Proposed version', exact: true }).count(), 3);
    await assertOriginal();
  });
  await step('Approval applies descriptive facilities once, retains custom schedules and preserves commercial state', rp, async () => {
    const card = rp.locator('article').filter({ has: rp.getByRole('heading', { name: project.name, exact: true }) });
    const approved = await approve(rp, card, proposalId);
    assert.equal(approved.status, 'approved'); assert.equal(approved.alreadyApproved, false);
    const after = await canonical();
    const row = after.amenities.find(item => item.id === reception.id);
    assert.equal(row.name, reception.name, 'An untouched localized name is not promoted to canonical fallback');
    assert.equal(row.description, NEW_DESCRIPTION); assert.equal(row.shortDescription, ''); assert.equal(row.locationLabel, LOCATION);
    assert.deepEqual(row.openingHours, { daily: [['00:00', '24:00']], staffContact: [['09:00', '18:00']], timezone: 'Asia/Bangkok' });
    assert.deepEqual(row.rules, RULES); assert.deepEqual(protectedAmenity(row), protectedAmenity(clone(reception)));
    const gymAfter = after.amenities.find(item => item.id === gym.id);
    assert.equal(gymAfter.description, GYM_DESCRIPTION); assert.deepEqual(gymAfter.openingHours, customHours); assert.deepEqual(gymAfter.rules, customRules);
    assert.deepEqual(protectedAmenity(gymAfter), protectedAmenity(clone(gym)));
    assert.deepEqual(after.amenities.find(item => item.id === untouched.id), clone(untouched), 'Omission never deletes or overwrites a facility');
    const created = after.amenities.filter(item => !original.amenities.some(before => before.id === item.id));
    assert.equal(created.length, 1); newFacility = created[0]; report.fixture.newAmenityId = newFacility.id;
    assert.equal(newFacility.name, NEW_NAME); assert.equal(newFacility.published, false); assert.equal(newFacility.isFeatured, false);
    assert.equal(newFacility.accessType, 'not_specified'); assert.equal(newFacility.pricingType, 'not_specified'); assert.equal(newFacility.priceThb, null);
    assert.deepEqual(newFacility.openingHours, { staffContact: [['10:00', '16:00']], timezone: 'Asia/Bangkok' });
    assert.equal(Object.hasOwn(newFacility.openingHours, 'daily'), false, 'Staff-only hours never invent daily access');
    assert.equal(newFacility.bookingRequired, false); assert.equal(newFacility.bookingMode, 'none'); assert.equal(newFacility.bookingUrl, null); assert.equal(newFacility.reservationConfig, null);
    assert.deepEqual(omit(after.project, ['updatedAt']), omit(original.project, ['updatedAt']));
    assert.equal(after.project.status, 'draft'); assert.deepEqual(after.unit, original.unit); assert.deepEqual(after.unit.amenityKeys, ['wifi']);
    assert.deepEqual(after.gallery, original.gallery);
    const originalDescription = original.content.find(key => key.key === `project_amenity.${reception.id}.description`);
    assert.deepEqual(await translation(reception.id, 'description', 'en'), originalDescription.translations.find(value => value.locale === 'en'));
    const translated = await translation(reception.id, 'description', 'ru');
    assert.equal(translated.value, NEW_DESCRIPTION); assert.equal(translated.status, 'needs_review'); assert.equal(translated.updatedByIdentityId, founderId);
    assert.equal((await translation(reception.id, 'shortDescription', 'ru')).value, '');
    assert.equal((await translation(reception.id, 'shortDescription', 'en')).value, EN_SUMMARY);
    assert.deepEqual(after.content.find(key => key.key === `project_amenity.${reception.id}.name`), original.content.find(key => key.key === `project_amenity.${reception.id}.name`));
    const retried = await json(await rp.request.post(`/api/admin/property-content-proposals/${proposalId}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: submitted.revision } }));
    assert.equal(retried.alreadyApproved, true); assert.deepEqual(await canonical(), after);
    const audit = await db.auditLog.findMany({ where: { entityId: proposalId, action: 'property_content_proposal.approved' } });
    assert.equal(audit.length, 1); assert.equal(audit[0].data.amenityChanges.length, 3);
    assert.equal(audit[0].data.amenityChanges.filter(change => change.createsDraft).length, 1);
  });
  await step('Public complex and linked unit render each canonical shared facility once without changing Unit amenityKeys', pp, async () => {
    for (const path of [`/projects/${project.slug}`, `/units/${unit.id}`]) {
      await pp.goto(path);
      const card = pp.locator(`a[href="/projects/${project.slug}/amenities/${reception.slug}"]`);
      await card.getByRole('heading', { name: reception.name, exact: true }).waitFor();
      assert.equal(await card.count(), 1, `One canonical facility card on ${path}`);
      assert.equal(await pp.getByRole('heading', { name: gym.name, exact: true }).count(), 1);
      await card.getByText(LOCATION, { exact: true }).waitFor();
      await card.getByText('00:00–24:00', { exact: true }).waitFor();
      await card.getByText(EN_SUMMARY, { exact: true }).waitFor();
      assert.equal(await pp.getByRole('heading', { name: NEW_NAME, exact: true }).count(), 0);
      assert.ok(await pp.locator('body').evaluate(node => node.scrollWidth <= window.innerWidth), `No mobile overflow on ${path}`);
    }
    await pp.getByRole('heading', { name: 'Shared complex facilities', exact: true }).waitFor();
    assert.deepEqual(clone(await db.unit.findUniqueOrThrow({ where: { id: unit.id } })), original.unit);
  });
  await step('Public details resolve actual approved RU text, English fallback, daily access, staff hours and visitor rules', pp, async () => {
    const path = `/projects/${project.slug}/amenities/${reception.slug}`;
    await pp.goto(path); await pp.getByText(EN_DESCRIPTION, { exact: true }).waitFor();
    await pp.getByText('Daily access: 24 hours', { exact: true }).waitFor();
    await pp.getByText('Staff contact hours: 09:00–18:00', { exact: true }).waitFor();
    for (const rule of RULES) await pp.getByText(rule, { exact: true }).waitFor();
    await ru.goto(path); await ru.getByRole('heading', { name: RU_NAME, exact: true }).waitFor();
    await ru.getByText(NEW_DESCRIPTION, { exact: true }).waitFor();
    await ru.getByText(EN_SUMMARY, { exact: true }).waitFor();
    await ru.getByText(LOCATION, { exact: true }).waitFor();
    assert.equal(await ru.getByText(RU_SUMMARY, { exact: true }).count(), 0);
    await ru.screenshot({ path: `browser-results/${stem}-public-russian.png`, fullPage: true });
  });
  await step('The approved new facility remains hidden and cannot activate native reservations', pp, async () => {
    await pp.goto(`/projects/${project.slug}/amenities`);
    await pp.getByRole('heading', { name: reception.name, exact: true }).waitFor();
    assert.equal(await pp.getByRole('heading', { name: NEW_NAME, exact: true }).count(), 0);
    await expectNotFound(pp, `/projects/${project.slug}/amenities/${newFacility.slug}`);
    const bookingPath = `/projects/${project.slug}/amenities/${newFacility.slug}/book`;
    // Authentication precedes facility eligibility on booking pages.
    await pp.goto(bookingPath);
    await pp.waitForURL(url => url.pathname === '/login');
    const loginUrl = new URL(pp.url());
    assert.equal(loginUrl.origin, baseUrl);
    assert.equal(loginUrl.pathname, '/login');
    assert.equal(loginUrl.searchParams.get('next'), bookingPath);
    await pp.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    await expectNotFound(rp, bookingPath);
    const startAt = new Date(Date.now() + 3 * 86400000); const endAt = new Date(startAt.getTime() + 3600000);
    const rejected = await rp.request.post(`/api/project-amenities/${newFacility.id}/reservations`, { maxRedirects: 0,
      data: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), partySize: 1 } });
    assert.equal(rejected.status(), 404, await rejected.text());
    assert.equal((await rejected.json()).error, 'Resource not found.');
    assert.equal(await db.projectAmenityReservation.count({ where: { amenityId: { in: [reception.id, gym.id, untouched.id, newFacility.id] } } }), 0);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, 'draft');
  });
  await step('A real intervening administrator edit makes a submitted facility approval stale without partial writes', rp, async () => {
    const target = await json(await cp.request.get(`${API}/target?scope=project&id=${project.id}`, { maxRedirects: 0 }));
    const payload = { facts: target.snapshot.facts, description: null,
      gallery: { mediaIds: target.snapshot.gallery.mediaIds, coverMediaId: target.snapshot.gallery.coverMediaId },
      amenities: [{ ...submitted.proposal.amenities[0], description: 'Stale content must never be applied.', openingHours: { mode: 'keep' }, staffHours: { mode: 'keep' }, rules: { mode: 'keep' } }] };
    const stale = await json(await cp.request.post(API, { maxRedirects: 0, data: { scope: 'project', targetId: project.id, baselineVersion: target.baselineVersion, proposal: payload, status: 'submitted' } }), 201);
    report.fixture.staleProposalId = stale.id;
    const beforeRevisionAttempt = await canonical();
    assert.equal((await rp.request.post(`/api/admin/property-content-proposals/${stale.id}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: stale.revision + 1 } })).status(), 409);
    assert.deepEqual(await canonical(), beforeRevisionAttempt);
    const card = await openReview(rp);
    const currentGym = await db.projectAmenity.findUniqueOrThrow({ where: { id: gym.id } });
    await json(await rp.request.patch(`/api/admin/projects/${project.id}/amenities/${gym.id}`, { maxRedirects: 0,
      data: { expectedUpdatedAt: currentGym.updatedAt.toISOString(), pricingType: 'paid', priceBaht: 123.45 } }));
    const beforeStaleApproval = await canonical();
    assert.equal(beforeStaleApproval.amenities.find(row => row.id === gym.id).priceThb, 12345);
    await approve(rp, card, stale.id, 409);
    await rp.getByRole('alert').filter({ hasText: /The proposal or property changed\. Nothing was applied\./ }).waitFor();
    assert.deepEqual(await canonical(), beforeStaleApproval);
    const pending = await db.crmOpportunity.findUniqueOrThrow({ where: { id: stale.id } });
    assert.equal(pending.requirements.status, 'submitted'); assert.equal(pending.requirements.revision, stale.revision);
    assert.equal(await db.auditLog.count({ where: { entityId: stale.id, action: 'property_content_proposal.approved' } }), 0);
  });
  await step('Existing identities, earlier scopes, unrelated inventory and linked unit remain unchanged', null, async () => {
    assert.deepEqual(clone(await db.identity.findMany({ select: { id: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } })), existingPeople);
    assert.deepEqual(clone(await db.roleAssignment.findMany({ where: { id: { not: roleId } }, orderBy: { id: 'asc' } })), existingRoles);
    assert.deepEqual(clone(await db.projectStaffPermission.findMany({ orderBy: [{ projectId: 'asc' }, { identityId: 'asc' }] })), existingStaffPermissions);
    assert.deepEqual(clone(await db.project.findMany({ where: { id: { in: existingProjects.map(row => row.id) } }, orderBy: { id: 'asc' } })), existingProjects);
    assert.deepEqual(clone(await db.unit.findMany({ where: { id: { in: existingUnits.map(row => row.id) } }, orderBy: { id: 'asc' } })), existingUnits);
    assert.deepEqual(clone(await db.projectAmenity.findMany({ where: { id: { in: existingAmenities.map(row => row.id) } }, orderBy: { id: 'asc' } })), existingAmenities);
    assert.deepEqual(clone(await db.projectAmenity.findUniqueOrThrow({ where: { id: foreignAmenity.id } })), clone(foreignAmenity));
    assert.deepEqual(clone(await db.project.findUniqueOrThrow({ where: { id: foreignProject.id } })), clone(foreignProject));
    assert.deepEqual(clone(await db.unit.findUniqueOrThrow({ where: { id: unit.id } })), original.unit);
    const role = await db.roleAssignment.findUniqueOrThrow({ where: { id: roleId } });
    assert.equal(role.scopeType, 'project'); assert.equal(role.projectId, project.id); assert.equal(role.unitId, null);
    assert.equal(role.organizationId, null); assert.equal(role.providerId, null); assert.equal(role.role, 'content_contributor');
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally {
  for (const { ctx, name } of contexts) { await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {}); await ctx.close().catch(() => {}); }
  if (browser) await browser.close(); await db.$disconnect(); await persist();
}
