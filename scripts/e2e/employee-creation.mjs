import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Run after the existing isolated seed/journeys, from the repository root.
// Never reset a database, install dependencies, start a server, or publish here.
// The exact disposable guard must run BEFORE loading Prisma or Chromium.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const API = '/api/property-creation';
const CONTENT = '/api/property-content-proposals';
const stem = 'employee-creation';
const SOURCE = 'myuno_property_submission_v1';
const ACCESS_ERROR = 'Current property creation permission and an eligible workspace are required.';
const CONFLICT = 'This creation request changed. Reload it before continuing.';
const CONTENT_DENIED = 'This content target is not assigned to you.';
const UNIT_NAME = 'Synthetic Employee Created Condo E501';
const COMPLEX_NAME = 'Synthetic Employee Created Complex';
const UNIT_DESCRIPTION = 'Synthetic employee description. This is a draft for administrator review.';
const PROPOSED_DESCRIPTION = 'Уточнённое описание синтетической квартиры. Только проверка черновика.';
const report = {
  headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running',
  limits: [
    'Requires the existing disposable localhost PostgreSQL fixture, installed Chromium, and running app. Does not install, start, reset, deploy, publish, or contact external services.',
    'Checks creation, review, exact-target descriptive continuity, and negative authorization with synthetic accounts. Upload transport, invitation email, and native booking success are not exercised.',
    'This runner is execution evidence only when employee-creation-result.json reports passed for the tested commit. Source tests and syntax checks alone are not browser execution.',
  ],
};
const contexts = [];
const clone = value => JSON.parse(JSON.stringify(value));
const identitySelect = { id: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, updatedAt: true };
let fixture, browser, founder, unitCreator, complexCreator, unsupportedCreator, organization, space, emptySpace, project, hiddenProject, existingUnit, hiddenUnit, area;
let beforeFixtures, beforeConversion, savedUnit, submittedUnit, savedComplex, submittedComplex, convertedUnit, convertedComplex, contentProposal;
const ownIdentityIds = [];
const preservationModels = ['roleAssignment', 'projectStaffPermission', 'project', 'unit', 'projectAmenity', 'organization', 'projectOrganizationRole', 'operatingSpace', 'operatingSpaceMember', 'operatingSpaceUnit', 'unitEngagement', 'ownershipPeriod', 'commercialOffering', 'booking', 'pricingRule', 'mediaAsset', 'unitMedia', 'projectMedia', 'contentKey', 'translation'];
const rowKeys = model => ({ projectStaffPermission: ['projectId', 'identityId'], unitMedia: ['unitId', 'mediaId'], projectMedia: ['projectId', 'mediaId'] })[model] || ['id'];
const rowOrder = model => rowKeys(model).map(key => ({ [key]: 'asc' }));

async function persist() { await writeFile(`browser-results/${stem}-result.json`, JSON.stringify(report, null, 2)); }
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
async function json(response, expected = 200) {
  assert.equal(response.status(), expected, `${response.request?.()?.method?.() || ''} ${new URL(response.url()).pathname}: ${await response.text()}`);
  return response.json();
}
async function denied(response, status, error) { assert.deepEqual(await json(response, status), { error }); }
const get = (page, path) => page.request.get(path, { maxRedirects: 0 });
const post = (page, path, data) => page.request.post(path, { maxRedirects: 0, data });
const patch = (page, path, data) => page.request.patch(path, { maxRedirects: 0, data });
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
async function login(page, email, next, destination = next.split('?')[0]) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email); await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  await json(await response); await page.waitForURL(url => url.pathname === destination);
  assert.equal((await get(page, '/api/auth/me')).status(), 200);
}
async function discoverCreation(page) {
  await page.getByRole('heading', { name: 'Everything connected to you.', exact: true }).waitFor();
  const entry = page.getByRole('link', { name: /^Your property workspace/ });
  assert.equal(await entry.getAttribute('href'), '/property');
  assert.equal(await page.locator('main a[href="/ops"], main a[href="/app/admin"]').count(), 0);
  await entry.click(); await page.waitForURL(url => url.pathname === '/property');
  const creation = page.locator('li').filter({ has: page.getByRole('heading', { name: 'Create a property draft', exact: true }) });
  await creation.getByRole('link', { name: 'Open workspace', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/property/create');
  await page.getByRole('heading', { name: 'Create a property draft', exact: true }).waitFor();
}
async function snapshotExisting() {
  const result = { identity: clone(await db.identity.findMany({ select: identitySelect, orderBy: { id: 'asc' } })) };
  for (const model of preservationModels) result[model] = clone(await db[model].findMany({ orderBy: rowOrder(model) }));
  return result;
}
async function assertPreserved(snapshot) {
  for (const [model, rows] of Object.entries(snapshot)) {
    const keys = rowKeys(model);
    const where = keys.length === 1 ? { [keys[0]]: { in: rows.map(row => row[keys[0]]) } }
      : { OR: rows.map(row => Object.fromEntries(keys.map(key => [key, row[key]]))) };
    const current = rows.length ? clone(await db[model].findMany({ where,
      ...(model === 'identity' ? { select: identitySelect } : {}), orderBy: rowOrder(model) })) : [];
    assert.deepEqual(current, rows, `Pre-existing ${model} rows must remain unchanged`);
  }
}
async function inventory() {
  return clone({ projects: await db.project.findMany({ orderBy: { id: 'asc' } }), units: await db.unit.findMany({ orderBy: { id: 'asc' } }) });
}
async function assertNoCanonicalWrites() { assert.deepEqual(await inventory(), beforeConversion, 'Intake save/submit/rejection must not create or change canonical inventory'); }
async function assertNoRoles() {
  assert.equal(await db.roleAssignment.count({ where: { identityId: { in: ownIdentityIds } } }), 0);
  assert.equal(await db.projectStaffPermission.count({ where: { identityId: { in: ownIdentityIds } } }), 0);
  assert.equal(await db.operatingTeamMember.count({ where: { identityId: { in: ownIdentityIds } } }), 0);
  assert.equal(await db.identity.count({ where: { id: { in: ownIdentityIds }, isAdmin: true } }), 0);
}
async function member(page, person, capability, active = true) {
  // Each visit obtains a fresh expectedUpdatedAt. No direct DB grant or role is
  // used for either real creator. Only the empty unsupported fixture is seeded.
  await page.goto('/app/admin/access');
  await page.getByRole('heading', { name: 'Workspace access', exact: true }).waitFor();
  await page.getByLabel('Existing workspace', { exact: true }).selectOption(space.id);
  if (!active) {
    const row = page.locator('li').filter({ has: page.getByRole('button', { name: `${person.firstName} ${person.lastName} · Active`, exact: true }) });
    const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/operating-spaces/${space.id}/members` && res.request().method() === 'PUT');
    await row.getByRole('button', { name: 'Deactivate workspace access', exact: true }).click();
    const result = await json(await response); assert.equal(result.member.active, false);
  } else {
    await page.getByLabel('Find existing person', { exact: true }).fill(person.email);
    const search = page.waitForResponse(res => new URL(res.url()).pathname === '/api/admin/people/search');
    await page.getByRole('button', { name: 'Find existing person', exact: true }).click(); await json(await search);
    await page.getByRole('button', { name: `${person.firstName} ${person.lastName} · ${person.email}`, exact: true }).click();
    const form = page.getByRole('group', { name: `${person.firstName} ${person.lastName} · Explicit capabilities`, exact: true });
    const unitBox = form.getByRole('checkbox', { name: 'Create property drafts', exact: true });
    const complexBox = form.getByRole('checkbox', { name: 'Create complex drafts', exact: true });
    await unitBox.setChecked(capability === 'create_unit'); await complexBox.setChecked(capability === 'create_complex');
    const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/operating-spaces/${space.id}/members` && res.request().method() === 'PUT');
    await form.getByRole('button', { name: 'Save member access', exact: true }).click();
    const result = await json(await response); assert.equal(result.member.active, true); assert.deepEqual(result.member.capabilities, [capability]);
  }
  await page.getByRole('status').filter({ hasText: /^Saved\. Review the updated scope below\.$/ }).waitFor();
  const current = await db.operatingSpaceMember.findUniqueOrThrow({ where: { operatingSpaceId_identityId: { operatingSpaceId: space.id, identityId: person.id } } });
  assert.equal(current.active, active); assert.deepEqual(current.capabilities, [capability]); await assertNoRoles(); return current;
}
async function start(page, kind) {
  await page.getByLabel('Workspace', { exact: true }).selectOption(space.id);
  assert.deepEqual(await page.getByLabel('What are you creating?', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean)), [kind]);
  await page.getByLabel('What are you creating?', { exact: true }).selectOption(kind);
  if (kind === 'unit') {
    assert.deepEqual(await page.getByLabel('Eligible complex', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean)), [project.id]);
    await page.getByLabel('Eligible complex', { exact: true }).selectOption(project.id);
  }
  await page.getByRole('button', { name: 'Start draft', exact: true }).click();
}
async function saveCreation(page, status, expected, expectedId) {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === API && ['POST', 'PATCH'].includes(res.request().method()));
  await page.getByRole('button', { name: status === 'draft' ? 'Save draft' : 'Submit for review', exact: true }).click();
  const received = await response; const command = received.request().postDataJSON(); const item = await json(received, expected);
  assert.equal(item.status, status); if (expectedId) assert.equal(item.id, expectedId);
  assert.equal(item.hasCreationAccess, true); assert.equal(item.mayEdit, status === 'draft');
  assert.equal(item.lastRequestId, command.requestId);
  await page.getByRole('status').filter({ hasText: status === 'draft' ? /^Draft saved\.$/ : /^Application submitted\. You can view it here while an administrator reviews it\.$/ }).waitFor();
  const readback = await json(await get(page, `${API}?id=${item.id}`)); assert.deepEqual(readback, item);
  assert.deepEqual(await json(await get(page, `${API}?requestId=${command.requestId}`)), { item, requestReceipt: { requestId: command.requestId, revision: item.revision, status } });
  return { item, command };
}
async function openCreation(page, item, name) {
  await page.goto('/property/create'); await page.getByRole('heading', { name: 'Your applications', exact: true }).waitFor();
  const row = page.locator('li').filter({ has: page.getByText(name, { exact: true }) });
  const response = page.waitForResponse(res => new URL(res.url()).pathname === API && new URL(res.url()).searchParams.get('id') === item.id);
  await row.getByRole('button', { name: 'Open application', exact: true }).click();
  assert.equal((await json(await response)).id, item.id);
  await page.getByLabel(item.kind === 'unit' ? 'Unit name' : 'Complex name', { exact: true }).waitFor();
}
function unitDraft(name = UNIT_NAME) {
  return { unitName: name, unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 42, floor: '5', description: UNIT_DESCRIPTION, descriptionLocale: 'en', photos: [] };
}
function complexDraft(name = COMPLEX_NAME) {
  return { proposedProject: name, projectAddress: `Synthetic address for ${name}`, projectType: 'condominium', areaId: area.id, latitude: 8.01, longitude: 98.3,
    description: 'Synthetic employee complex. Administrator review required.', descriptionLocale: 'en', projectPhotos: [] };
}
function createBody(kind, draft, status = 'submitted', selectedSpace = space.id, selectedProject = kind === 'unit' ? project.id : null) {
  return { requestId: randomUUID(), spaceId: selectedSpace, kind, projectId: selectedProject, status, draft };
}
function reviewBody(item) { return { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false, organizationId: null,
  projectId: item.kind === 'unit' ? item.projectId : null, descriptionLocale: item.draft.descriptionLocale }; }
const convertUrl = id => `/api/admin/property-submissions/${id}/convert`;
async function convertUI(page, item, name, matchId = null) {
  await page.goto('/app/admin/property-submissions');
  await page.getByRole('heading', { name: 'Property applications', exact: true }).waitFor();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.getByRole('heading', { name: 'Review employee creation', exact: true }).waitFor();
  const selection = card.getByLabel(item.kind === 'unit' ? 'Existing unit match' : 'Existing complex match', { exact: true });
  if (item.kind === 'unit') assert.deepEqual(await selection.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean)), [existingUnit.id]);
  await selection.selectOption(matchId || '');
  const button = card.getByRole('button', { name: matchId ? 'Confirm existing match' : 'Create canonical draft', exact: true }); assert.equal(await button.isDisabled(), true);
  await card.getByRole('checkbox', { name: 'I checked the creator’s identity and current creation permission for this organization and workspace.', exact: true }).check();
  await card.getByRole('checkbox', { name: 'I checked duplicates and the selected new-draft or existing-record outcome.', exact: true }).check();
  await card.getByRole('checkbox', { name: 'I checked the submitted descriptive facts and photos for the requested scope.', exact: true }).check();
  const response = page.waitForResponse(res => new URL(res.url()).pathname === convertUrl(item.id) && res.request().method() === 'POST');
  await button.click(); const converted = await json(await response); assert.equal(converted.alreadyConverted, false);
  assert.equal(converted.matchedExisting, Boolean(matchId));
  if (matchId) {
    await card.getByRole('status').filter({ hasText: 'Matched to the reviewed existing record. No new draft or content access was created.' }).waitFor();
    assert.equal(await card.getByRole('link', { name: /Open new (unit|complex) draft/ }).count(), 0);
  } else {
    assert.equal(converted.createdUnitId, item.kind === 'unit' ? converted.unitId : null);
    assert.equal(converted.createdProjectId, item.kind === 'complex' ? converted.projectId : null);
    await card.getByRole('link', { name: item.kind === 'unit' ? 'Open new unit draft' : 'Open new complex draft', exact: true }).waitFor();
  }
  return converted;
}
async function assertDraftOnly(result, kind) {
  if (kind === 'unit') {
    const row = await db.unit.findUniqueOrThrow({ where: { id: result.unitId } });
    assert.equal(row.status, 'draft'); assert.equal(row.projectId, project.id); assert.equal(row.ownerIdentityId, null);
    assert.equal(row.instantBook, false); assert.equal(row.baseNightlyThb, 0); assert.equal(row.inventoryCategoryId, null);
    for (const model of ['unitEngagement', 'ownershipPeriod', 'operatingSpaceUnit', 'commercialOffering', 'booking', 'pricingRule']) {
      assert.equal(await db[model].count({ where: { unitId: row.id } }), 0, `Creation cannot write ${model}`);
    }
  } else {
    const row = await db.project.findUniqueOrThrow({ where: { id: result.projectId } });
    assert.equal(row.status, 'draft'); assert.equal(result.unitId, null);
    for (const model of ['unit', 'projectOrganizationRole', 'commercialOffering', 'booking']) assert.equal(await db[model].count({ where: { projectId: row.id } }), 0);
  }
  await assertNoRoles();
}
async function canonicalContent(unitId) {
  const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
  const description = unit.descriptionKey ? await db.contentKey.findUnique({ where: { key: unit.descriptionKey }, include: { translations: { orderBy: { locale: 'asc' } } } }) : null;
  return clone({ unit, description, gallery: await db.unitMedia.findMany({ where: { unitId }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] }) });
}

try {
  await mkdir('browser-results', { recursive: true });
  fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  await step('Prepare separate synthetic employees, verified organization scope and hidden inventory; preserve all earlier fixtures', null, async () => {
    assert.equal(fixture.founderEmail, 'founder@browser.example.test'); assert.ok(fixture.password);
    founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } });
    assert.equal(founder.isAdmin, true); assert.equal(founder.status, 'active'); assert.ok(founder.hashedPassword);
    const emails = ['employee-create-unit@browser.example.test', 'employee-create-complex@browser.example.test', 'employee-create-empty@browser.example.test'];
    assert.equal(await db.identity.count({ where: { email: { in: emails } } }), 0, 'Never reset/reuse a previously modified fixture');
    assert.equal(await db.operatingSpace.count({ where: { key: { startsWith: 'synthetic-employee-creation' } } }), 0);
    assert.equal(await db.project.count({ where: { slug: { startsWith: 'synthetic-employee-creation' } } }), 0);
    beforeFixtures = await snapshotExisting();
    const people = [];
    for (const [index, suffix] of ['UnitCreator', 'ComplexCreator', 'EmptyScope'].entries()) {
      const person = await db.identity.create({ data: { firstName: 'Synthetic', lastName: suffix, email: emails[index], status: 'active', isAdmin: false,
        preferredLocale: 'en', emailVerifiedAt: new Date(), hashedPassword: founder.hashedPassword } });
      people.push(person); ownIdentityIds.push(person.id);
    }
    [unitCreator, complexCreator, unsupportedCreator] = people;
    // Reuse the original local destination with its covered live project.
    // An otherwise empty live area invokes external editorial photography on
    // the homepage; the acceptance environment deliberately blocks egress.
    area = await db.area.findUniqueOrThrow({ where: { slug: 'synthetic-browser-area' } });
    assert.equal(area.status, 'live');
    const projectData = { projectType: 'condominium', areaId: area.id, areaLabelKey: 'browser.employee_creation.area', descriptionKey: 'browser.employee_creation.project.description',
      handbookKey: 'browser.employee_creation.handbook', latitude: '8.01', longitude: '98.30', timezone: 'Asia/Bangkok', status: 'draft' };
    project = await db.project.create({ data: { ...projectData, slug: 'synthetic-employee-creation-scope', name: 'Synthetic Employee Creation Scope', address: 'Synthetic scoped address only' } });
    hiddenProject = await db.project.create({ data: { ...projectData, slug: 'synthetic-employee-creation-hidden', name: 'Synthetic Employee Creation Hidden', address: 'Synthetic secret out-of-scope address' } });
    const unitData = { unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 40, floor: '2', baseNightlyThb: 777777, minNights: 4, instantBook: false, status: 'draft' };
    existingUnit = await db.unit.create({ data: { ...unitData, projectId: project.id, name: 'Synthetic Employee Existing Condo', addressSupplement: 'Existing-201' } });
    hiddenUnit = await db.unit.create({ data: { ...unitData, projectId: hiddenProject.id, name: 'Synthetic Employee Hidden Condo', addressSupplement: 'Hidden-909' } });
    organization = await db.organization.create({ data: { name: 'Synthetic Employee Creation Organization', orgType: 'management_company', contactEmail: 'employee-creation-org@browser.example.test', contactPhone: '', status: 'active' } });
    await db.projectOrganizationRole.create({ data: { projectId: project.id, organizationId: organization.id, roleKey: 'operator', provenance: 'verified', effectiveFrom: new Date(Date.now() - 60000) } });
    space = await db.operatingSpace.create({ data: { key: 'synthetic-employee-creation', name: 'Synthetic Employee Creation Workspace', organizationId: organization.id, status: 'active',
      units: { create: { unitId: existingUnit.id, active: true, startsOn: new Date(Date.now() - 60000) } } } });
    emptySpace = await db.operatingSpace.create({ data: { key: 'synthetic-employee-creation-empty', name: 'Synthetic Unsupported Empty Workspace', organizationId: organization.id, status: 'active' } });
    // A deliberately unsupported synthetic fixture proves that even a flag is
    // insufficient when no current, verified canonical unit scope exists.
    await db.operatingSpaceMember.create({ data: { identityId: unsupportedCreator.id, operatingSpaceId: emptySpace.id, capabilities: ['create_unit'], active: true } });
    await assertNoRoles(); beforeConversion = await inventory();
    report.fixture = { founderId: founder.id, unitCreatorId: unitCreator.id, complexCreatorId: complexCreator.id, unsupportedCreatorId: unsupportedCreator.id,
      organizationId: organization.id, spaceId: space.id, emptySpaceId: emptySpace.id, projectId: project.id, hiddenProjectId: hiddenProject.id, existingUnitId: existingUnit.id, hiddenUnitId: hiddenUnit.id, areaId: area.id };
  });
  browser = await chromium.launch({ headless: true });
  const founderContext = await context(`${stem}-founder`); const fp = await founderContext.newPage();
  const unitContext = await context(`${stem}-unit-mobile`, true); const up = await unitContext.newPage();
  const complexContext = await context(`${stem}-complex`); const cp = await complexContext.newPage();
  const emptyContext = await context(`${stem}-unsupported`); const ep = await emptyContext.newPage();
  const anonymous = await context(`${stem}-anonymous`); const ap = await anonymous.newPage();

  await step('Founder grants independent create-unit and create-complex capabilities through actual Workspace access UI', fp, async () => {
    await login(fp, fixture.founderEmail, '/app/admin/access');
    await member(fp, unitCreator, 'create_unit'); await member(fp, complexCreator, 'create_complex');
    assert.equal(await db.operatingSpaceMember.count({ where: { identityId: { in: [unitCreator.id, complexCreator.id] } } }), 2);
    await assertNoCanonicalWrites();
  });
  await step('Anonymous creation/readback/conversion/content requests return exact unauthorized responses', ap, async () => {
    const command = createBody('unit', unitDraft());
    for (const response of [await get(ap, API), await get(ap, `${API}?id=${existingUnit.id}`), await get(ap, `${API}?requestId=${command.requestId}`),
      await post(ap, API, command), await patch(ap, API, { id: existingUnit.id, requestId: randomUUID(), expectedRevision: 1, draft: unitDraft(), status: 'draft' }),
      await post(ap, convertUrl(existingUnit.id), reviewBody({ kind: 'unit', projectId: project.id, draft: unitDraft() }))]) {
      await denied(response, 401, 'Unauthorized');
    }
    await denied(await get(ap, CONTENT), 401, 'Unauthorized.');
  });
  await step('Creation-only unit and complex employees discover creation from login through My UNO; unsupported scope has no home entry', up, async () => {
    await login(up, unitCreator.email, '/app'); await discoverCreation(up);
    await login(cp, complexCreator.email, '/app'); await discoverCreation(cp);
    await login(ep, unsupportedCreator.email, '/app');
    assert.equal(await ep.getByRole('link', { name: /^Your property workspace/ }).count(), 0);
    await assertNoRoles(); await assertNoCanonicalWrites();
  });
  await step('Creation-only employee follows /ops/new-unit to the explicit reviewed workflow; empty scope stays unavailable', up, async () => {
    await up.goto('/ops/new-unit'); await up.waitForURL(url => url.pathname === '/property/create');
    const url = new URL(up.url()); assert.equal(url.searchParams.get('kind'), 'unit'); assert.equal(url.searchParams.get('from'), 'operations');
    await up.getByRole('heading', { name: 'Create a property draft', exact: true }).waitFor();
    await up.getByRole('status').filter({ hasText: 'Employee additions now use an explicit creation permission and administrator review. Choose an authorized workspace below.' }).waitFor();
    await up.getByText('Creation permission does not verify ownership or grant pricing, offers, management or publishing rights.', { exact: true }).waitFor();
    const index = await json(await get(up, API));
    assert.deepEqual(index.items, []); assert.equal(index.spaces.length, 1);
    assert.deepEqual({ ...index.spaces[0], status: undefined }, { id: space.id, name: space.name, organizationId: organization.id, status: undefined, canCreateUnit: true, canCreateComplex: false, projects: [{ id: project.id, name: project.name }] });
    const other = await json(await get(cp, API)); assert.equal(other.spaces.length, 1); assert.equal(other.spaces[0].canCreateUnit, false); assert.equal(other.spaces[0].canCreateComplex, true);
    await ep.goto('/property/create');
    assert.deepEqual(await json(await get(ep, API)), { spaces: [], items: [] });
    await ep.getByText('No supported creation workspace is available. Ask the founder to configure an active organization-backed workspace and the specific creation permission.', { exact: true }).waitFor();
    await denied(await post(ep, API, createBody('unit', unitDraft(), 'draft', emptySpace.id)), 403, ACCESS_ERROR);
    const version = await db.operatingSpace.findUniqueOrThrow({ where: { id: emptySpace.id } });
    await denied(await fp.request.put(`/api/admin/operating-spaces/${emptySpace.id}/members`, { maxRedirects: 0, data: { identityId: unsupportedCreator.id, capabilities: ['create_complex'], active: true, expectedUpdatedAt: version.updatedAt.toISOString() } }), 409, 'Creation requires an existing nonempty verified workspace. Ask the founder to set up its scope first.');
    await assertNoCanonicalWrites();
  });
  await step('Separate capabilities, current project scope and minimal duplicate DTOs exclude hidden inventory', up, async () => {
    await denied(await post(up, API, createBody('complex', complexDraft())), 403, ACCESS_ERROR);
    await denied(await post(cp, API, createBody('unit', unitDraft())), 403, ACCESS_ERROR);
    await denied(await post(up, API, createBody('unit', unitDraft(), 'draft', space.id, hiddenProject.id)), 403, ACCESS_ERROR);
    await denied(await get(up, `${API}?spaceId=${space.id}&kind=unit&projectId=${hiddenProject.id}&q=Synthetic`), 403, ACCESS_ERROR);
    const duplicates = await json(await get(up, `${API}?spaceId=${space.id}&kind=unit&projectId=${project.id}&q=Synthetic`));
    assert.deepEqual(duplicates, { projects: [], units: [{ id: existingUnit.id, name: existingUnit.name, projectId: project.id }] });
    const complexes = await json(await get(cp, `${API}?spaceId=${space.id}&kind=complex&q=Synthetic%20Employee%20Creation`));
    assert.deepEqual(complexes, { projects: [{ id: project.id, name: project.name, address: project.address }], units: [] });
    assert.equal(JSON.stringify([duplicates, complexes]).includes(hiddenProject.id), false); assert.equal(JSON.stringify([duplicates, complexes]).includes(hiddenUnit.name), false);
    // The backing verified relationship can expire independently of membership.
    const role = await db.projectOrganizationRole.findUniqueOrThrow({ where: { projectId_organizationId_roleKey: { projectId: project.id, organizationId: organization.id, roleKey: 'operator' } } });
    await db.projectOrganizationRole.update({ where: { id: role.id }, data: { effectiveTo: new Date(Date.now() - 1000) } });
    assert.deepEqual(await json(await get(up, API)), { spaces: [], items: [] });
    await denied(await post(up, API, createBody('unit', unitDraft(), 'draft')), 403, ACCESS_ERROR);
    await db.projectOrganizationRole.update({ where: { id: role.id }, data: { effectiveTo: null } });
    await assertNoCanonicalWrites();
  });
  await step('Actual mobile UI saves a creator-owned CRM draft, reloads it and submits without canonical writes', up, async () => {
    await start(up, 'unit');
    assert.ok(await up.locator('main').last().evaluate(node => node.scrollWidth <= window.innerWidth), '390px editor must not overflow');
    for (const [label, value] of [['Unit name', UNIT_NAME], ['Bedrooms', '1'], ['Bathrooms', '1'], ['Maximum guests', '2'], ['Floor area, m²', '42'], ['Floor', '5']]) await up.getByLabel(label, { exact: true }).fill(value);
    await up.getByLabel('Description language', { exact: true }).selectOption('en'); await up.getByLabel('Description', { exact: true }).fill(UNIT_DESCRIPTION);
    await up.getByLabel('Name to check', { exact: true }).fill('Synthetic');
    const duplicates = up.waitForResponse(res => new URL(res.url()).pathname === API && new URL(res.url()).searchParams.has('q'));
    await up.getByRole('button', { name: 'Check possible duplicates', exact: true }).click();
    assert.deepEqual(await json(await duplicates), { projects: [], units: [{ id: existingUnit.id, name: existingUnit.name, projectId: project.id }] });
    await up.getByText(existingUnit.name, { exact: true }).waitFor(); assert.equal(await up.getByText(hiddenUnit.name, { exact: true }).count(), 0);
    savedUnit = await saveCreation(up, 'draft', 201); assert.equal(savedUnit.item.revision, 1);
    const crm = await db.crmOpportunity.findUniqueOrThrow({ where: { id: savedUnit.item.id } });
    assert.equal(crm.identityId, unitCreator.id); assert.equal(crm.source, SOURCE); assert.equal(crm.unitId, null); assert.equal(crm.projectId, project.id);
    assert.equal(crm.requirements.status, 'draft'); assert.equal(crm.requirements.employeeCreation.creatorIdentityId, unitCreator.id);
    assert.equal(crm.requirements.employeeCreation.membershipId, (await db.operatingSpaceMember.findUniqueOrThrow({ where: { operatingSpaceId_identityId: { operatingSpaceId: space.id, identityId: unitCreator.id } } })).id);
    await assertNoCanonicalWrites();
    // Exact network replay returns the same receipt; different content on the
    // same request ID is rejected rather than becoming a second application.
    assert.deepEqual(await json(await post(up, API, savedUnit.command), 201), savedUnit.item);
    await denied(await post(up, API, { ...savedUnit.command, draft: { ...savedUnit.command.draft, floor: '9' } }), 409, CONFLICT);
    await up.reload(); await openCreation(up, savedUnit.item, UNIT_NAME);
    assert.equal(await up.getByLabel('Unit name', { exact: true }).inputValue(), UNIT_NAME); assert.equal(await up.getByLabel('Description', { exact: true }).inputValue(), UNIT_DESCRIPTION);
    await up.getByLabel('Floor', { exact: true }).fill('6');
    const revised = await saveCreation(up, 'draft', 200, savedUnit.item.id); assert.equal(revised.item.revision, 2);
    await denied(await patch(up, API, { id: savedUnit.item.id, requestId: randomUUID(), expectedRevision: 1, draft: revised.item.draft, status: 'draft' }), 409, CONFLICT);
    submittedUnit = (await saveCreation(up, 'submitted', 200, savedUnit.item.id)).item; assert.equal(submittedUnit.revision, 3);
    assert.equal(await up.getByLabel('Unit name', { exact: true }).isDisabled(), true);
    await denied(await patch(up, API, { id: submittedUnit.id, requestId: randomUUID(), expectedRevision: submittedUnit.revision, draft: submittedUnit.draft, status: 'draft' }), 409, CONFLICT);
    await assertNoCanonicalWrites(); report.unitApplicationId = submittedUnit.id;
  });
  await step('Cross-creator read/write and forged provenance/public-intake/generic-CRM overwrite fail with exact bodies', up, async () => {
    await denied(await get(cp, `${API}?id=${submittedUnit.id}`), 404, 'Creation request not found.');
    assert.deepEqual(await json(await get(cp, `${API}?requestId=${savedUnit.command.requestId}`)), { item: null, requestReceipt: null });
    await denied(await patch(cp, API, { id: submittedUnit.id, requestId: randomUUID(), expectedRevision: submittedUnit.revision, draft: unitDraft(), status: 'draft' }), 404, 'Creation request not found.');
    const provenance = { creatorIdentityId: unitCreator.id, spaceId: space.id, createdUnitId: existingUnit.id };
    await denied(await post(up, API, { ...createBody('unit', unitDraft(), 'draft'), employeeCreation: provenance }), 400, 'Invalid property creation request.');
    for (const forged of [{ baseNightlyThb: 1 }, { ownerIdentityId: unitCreator.id }, { status: 'live' }, { employeeCreation: provenance }]) {
      await denied(await post(up, API, createBody('unit', { ...unitDraft(), ...forged }, 'draft')), 400, 'Invalid property creation request.');
    }
    await denied(await post(up, '/api/property-submissions', { kind: 'home', employeeCreation: provenance }), 400, 'Employee creation provenance is server-managed.');
    await denied(await patch(up, '/api/property-submissions', { id: submittedUnit.id, kind: 'home' }), 403, 'Use the employee creation workspace for this request.');
    await denied(await patch(fp, `/api/crm/opportunities/${submittedUnit.id}`, { requirements: {} }), 403, 'Employee creation requests require their dedicated review workflow.');
    await denied(await patch(fp, `/api/crm/opportunities/${submittedUnit.id}`, { requirements: { employeeCreation: provenance } }), 400, 'Employee creation provenance is server-managed.');
    assert.equal((await json(await get(up, '/api/property-submissions'))).items.some(item => item.id === submittedUnit.id), false);
    await denied(await post(fp, convertUrl(submittedUnit.id), { ...reviewBody(submittedUnit), verifiedOwner: true }), 400, 'Employee creation does not record ownership or a management mandate.');
    await denied(await post(fp, convertUrl(submittedUnit.id), { ...reviewBody(submittedUnit), projectId: hiddenProject.id }), 403, 'Current property creation permission is required.');
    await assertNoCanonicalWrites();
  });
  await step('Complex-only creator saves, reloads and submits through the actual complex editor', cp, async () => {
    await start(cp, 'complex');
    for (const [label, value] of [['Complex name', COMPLEX_NAME], ['Full address', `Synthetic address for ${COMPLEX_NAME}`], ['Latitude', '8.01'], ['Longitude', '98.3']]) await cp.getByLabel(label, { exact: true }).fill(value);
    await cp.getByLabel('Area', { exact: true }).selectOption(area.id); await cp.getByLabel('Description language', { exact: true }).selectOption('en');
    await cp.getByLabel('Description', { exact: true }).fill(complexDraft().description);
    savedComplex = await saveCreation(cp, 'draft', 201); await cp.reload(); await openCreation(cp, savedComplex.item, COMPLEX_NAME);
    assert.equal(await cp.getByLabel('Complex name', { exact: true }).inputValue(), COMPLEX_NAME);
    assert.equal(await cp.getByLabel('Area', { exact: true }).inputValue(), area.id);
    submittedComplex = (await saveCreation(cp, 'submitted', 200, savedComplex.item.id)).item;
    assert.equal((await json(await get(up, API))).items.some(item => item.id === submittedComplex.id), false);
    await assertNoCanonicalWrites(); report.complexApplicationId = submittedComplex.id;
  });
  await step('Revoking current creation membership before administrator conversion fails closed; restoring the same grant allows review', fp, async () => {
    const originalMember = await member(fp, unitCreator, 'create_unit', false);
    await denied(await post(fp, convertUrl(submittedUnit.id), reviewBody(submittedUnit)), 403, ACCESS_ERROR);
    const retained = { ...submittedUnit, hasCreationAccess: false, mayEdit: false, createdProjectId: null, createdUnitId: null };
    assert.deepEqual(await json(await get(up, `${API}?id=${submittedUnit.id}`)), retained);
    assert.deepEqual(await json(await get(up, API)), { spaces: [], items: [retained] });
    assert.deepEqual(await json(await get(up, `${API}?requestId=${savedUnit.command.requestId}`)), { item: retained, requestReceipt: { requestId: savedUnit.command.requestId, revision: 1, status: 'draft' } });
    await denied(await patch(up, API, { id: submittedUnit.id, requestId: randomUUID(), expectedRevision: submittedUnit.revision, draft: submittedUnit.draft, status: 'submitted' }), 403, ACCESS_ERROR);
    await up.goto('/app'); await up.getByRole('heading', { name: 'Everything connected to you.', exact: true }).waitFor();
    assert.equal(await up.getByRole('link', { name: /^Your property workspace/ }).count(), 0, 'Retained intake must not imply current creation authority');
    await openCreation(up, retained, UNIT_NAME); assert.equal(await up.getByLabel('Unit name', { exact: true }).isDisabled(), true);
    assert.equal(await up.getByLabel('Description', { exact: true }).inputValue(), UNIT_DESCRIPTION);
    await assertNoCanonicalWrites();
    const restored = await member(fp, unitCreator, 'create_unit'); assert.equal(restored.id, originalMember.id);
  });
  await step('Administrator reviews both applications through UI and creates canonical drafts without authority or commercial side effects', fp, async () => {
    convertedUnit = await convertUI(fp, submittedUnit, UNIT_NAME); assert.equal(convertedUnit.projectId, project.id); assert.ok(convertedUnit.unitId);
    await assertDraftOnly(convertedUnit, 'unit');
    convertedComplex = await convertUI(fp, submittedComplex, COMPLEX_NAME); assert.ok(convertedComplex.projectId); await assertDraftOnly(convertedComplex, 'complex');
    assert.equal(await db.unit.count(), beforeConversion.units.length + 1); assert.equal(await db.project.count(), beforeConversion.projects.length + 1);
    assert.deepEqual(await json(await post(fp, convertUrl(submittedUnit.id), reviewBody(submittedUnit))), { ...convertedUnit, alreadyConverted: true });
    const unit = await json(await get(up, `${API}?id=${submittedUnit.id}`)); assert.equal(unit.status, 'converted'); assert.equal(unit.createdUnitId, convertedUnit.unitId); assert.equal(unit.createdProjectId, null); assert.equal(unit.matchedExisting, false);
    const complex = await json(await get(cp, `${API}?id=${submittedComplex.id}`)); assert.equal(complex.status, 'converted'); assert.equal(complex.createdProjectId, convertedComplex.projectId); assert.equal(complex.createdUnitId, null); assert.equal(complex.matchedExisting, false);
    report.created = { unitId: convertedUnit.unitId, projectId: convertedComplex.projectId };
  });
  await step('Creation-only capabilities grant no operations, direct listing, pricing or delegation rights even for the new draft', up, async () => {
    for (const target of [existingUnit.id, convertedUnit.unitId]) {
      await denied(await get(up, `/api/admin/units/${target}`), 403, 'Forbidden');
      await denied(await up.request.put(`/api/admin/units/${target}`, { maxRedirects: 0, data: { status: 'live', baseNightlyThb: 1, instantBook: true } }), 403, 'Forbidden');
      await denied(await get(up, `/api/units/${target}/pricing-rules`), 403, 'Forbidden');
      await denied(await post(up, `/api/units/${target}/pricing-rules`, { startDate: '2030-01-01', endDate: '2030-01-03', nightlyThb: 1 }), 403, 'Forbidden');
      await denied(await post(up, '/api/ops/tasks', { operatingSpaceId: space.id, unitId: target, taskType: 'maintenance', title: 'Synthetic forbidden task', dueAt: '2030-01-01T00:00:00.000Z' }), 403, 'Operating space capability required');
    }
    const version = await db.operatingSpace.findUniqueOrThrow({ where: { id: space.id } });
    await denied(await up.request.put(`/api/admin/operating-spaces/${space.id}/members`, { maxRedirects: 0, data: { identityId: complexCreator.id, active: true, capabilities: ['create_unit'], expectedUpdatedAt: version.updatedAt.toISOString() } }), 403, 'Founder access required');
    await assertDraftOnly(convertedUnit, 'unit'); await assertNoRoles();
  });
  await step('Administrator UI matches existing unit and complex without mutation, new drafts or creator content rights', fp, async () => {
    const baseline = await inventory(); const original = clone(await db.unit.findUniqueOrThrow({ where: { id: existingUnit.id } }));
    const matched = await json(await post(up, API, createBody('unit', { ...unitDraft(existingUnit.name), description: 'Must not replace existing description.' })), 201);
    await denied(await post(fp, convertUrl(matched.id), { ...reviewBody(matched), existingUnitId: hiddenUnit.id }), 403, 'Current property creation permission is required.');
    const result = await convertUI(fp, matched, existingUnit.name, existingUnit.id);
    assert.deepEqual(result, { projectId: project.id, unitId: existingUnit.id, alreadyConverted: false, createdProjectId: null, createdUnitId: null, matchedExisting: true });
    const detail = await json(await get(up, `${API}?id=${matched.id}`)); assert.equal(detail.status, 'converted'); assert.equal(detail.createdUnitId, null); assert.equal(detail.createdProjectId, null); assert.equal(detail.matchedExisting, true);
    assert.deepEqual(clone(await db.unit.findUniqueOrThrow({ where: { id: existingUnit.id } })), original); assert.deepEqual(await inventory(), baseline);
    await denied(await get(up, `${CONTENT}/target?scope=unit&id=${existingUnit.id}`), 403, CONTENT_DENIED);
    await openCreation(up, detail, existingUnit.name); assert.equal(await up.getByRole('link', { name: 'Propose content changes', exact: true }).count(), 0);
    report.matchedApplicationId = matched.id;
    const matchedComplex = await json(await post(cp, API, createBody('complex', complexDraft(project.name))), 201);
    const complexResult = await convertUI(fp, matchedComplex, project.name, project.id);
    assert.deepEqual(complexResult, { projectId: project.id, unitId: null, alreadyConverted: false, createdProjectId: null, createdUnitId: null, matchedExisting: true });
    const complexDetail = await json(await get(cp, `${API}?id=${matchedComplex.id}`));
    assert.equal(complexDetail.createdProjectId, null); assert.equal(complexDetail.createdUnitId, null); assert.equal(complexDetail.matchedExisting, true);
    await openCreation(cp, complexDetail, project.name); assert.equal(await cp.getByRole('link', { name: 'Propose content changes', exact: true }).count(), 0);
    await denied(await get(cp, `${CONTENT}/target?scope=project&id=${project.id}`), 403, CONTENT_DENIED);
    assert.deepEqual(await inventory(), baseline); report.matchedComplexApplicationId = matchedComplex.id;
  });
  await step('Exact newly created drafts remain in each creator list and link to the authorized descriptive editor', up, async () => {
    await openCreation(up, submittedUnit, UNIT_NAME);
    const unitHref = `/property/content?scope=unit&targetId=${convertedUnit.unitId}`;
    assert.equal(await up.getByRole('link', { name: 'Propose content changes', exact: true }).getAttribute('href'), unitHref);
    await up.getByRole('link', { name: 'Propose content changes', exact: true }).click(); await up.waitForURL(url => url.pathname === '/property/content' && url.searchParams.get('targetId') === convertedUnit.unitId);
    await up.getByLabel('Unit name / number', { exact: true }).waitFor(); assert.equal(await up.getByLabel('Unit name / number', { exact: true }).inputValue(), UNIT_NAME);
    const targets = await json(await get(up, CONTENT)); assert.deepEqual(targets.targets.map(target => ({ scope: target.scope, id: target.id, projectId: target.projectId })), [{ scope: 'unit', id: convertedUnit.unitId, projectId: project.id }]);
    for (const [scope, id] of [['unit', existingUnit.id], ['unit', hiddenUnit.id], ['project', project.id], ['project', convertedComplex.projectId]]) await denied(await get(up, `${CONTENT}/target?scope=${scope}&id=${id}`), 403, CONTENT_DENIED);
    await openCreation(cp, submittedComplex, COMPLEX_NAME);
    assert.equal(await cp.getByRole('link', { name: 'Propose content changes', exact: true }).getAttribute('href'), `/property/content?scope=project&targetId=${convertedComplex.projectId}`);
    await cp.getByRole('link', { name: 'Propose content changes', exact: true }).click(); await cp.waitForURL(url => url.pathname === '/property/content');
    await cp.getByLabel('Name', { exact: true }).waitFor();
    const complexTargets = await json(await get(cp, CONTENT)); assert.deepEqual(complexTargets.targets.map(target => ({ scope: target.scope, id: target.id })), [{ scope: 'project', id: convertedComplex.projectId }]);
  });
  await step('Creator edits description through proposal UI; administrator approval persists it while retaining draft-only safeguards', up, async () => {
    const before = await canonicalContent(convertedUnit.unitId);
    await up.getByLabel('Floor', { exact: true }).fill('7'); await up.getByLabel('Propose a description change', { exact: true }).check();
    await up.getByLabel('Description language', { exact: true }).selectOption('ru'); await up.getByLabel('Description text', { exact: true }).fill(PROPOSED_DESCRIPTION);
    const response = up.waitForResponse(res => new URL(res.url()).pathname === CONTENT && res.request().method() === 'POST');
    await up.getByRole('button', { name: 'Save and submit for review', exact: true }).click();
    contentProposal = await json(await response, 201); assert.equal(contentProposal.status, 'submitted'); assert.equal(contentProposal.targetId, convertedUnit.unitId);
    assert.deepEqual(await canonicalContent(convertedUnit.unitId), before);
    await denied(await get(cp, `${CONTENT}/${contentProposal.id}`), 404, 'Proposal not found.');
    await fp.goto('/app/admin/property-content-proposals'); await fp.getByRole('heading', { name: 'Review property content', exact: true }).waitFor();
    await fp.getByRole('button').filter({ has: fp.getByText(UNIT_NAME, { exact: true }) }).click();
    const card = fp.locator('article').filter({ has: fp.getByRole('heading', { name: UNIT_NAME, exact: true }) });
    await card.getByText(PROPOSED_DESCRIPTION, { exact: true }).waitFor();
    const approve = card.getByRole('button', { name: 'Approve and apply content', exact: true }); assert.equal(await approve.isDisabled(), true);
    await card.getByRole('checkbox', { name: /^I checked the facts, description, each photo and any proposed complex facilities/ }).check();
    const review = fp.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/property-content-proposals/${contentProposal.id}/review` && res.request().method() === 'POST');
    await approve.click(); const reviewed = await json(await review); assert.equal(reviewed.status, 'approved');
    const after = await canonicalContent(convertedUnit.unitId); assert.equal(after.unit.floor, '7');
    assert.equal(after.description.translations.find(row => row.locale === 'ru').value, PROPOSED_DESCRIPTION);
    assert.equal(after.description.translations.find(row => row.locale === 'en').value, UNIT_DESCRIPTION);
    const changed = new Set(['updatedAt', 'floor', 'descriptionKey', 'marketingTitleKey']);
    assert.deepEqual(Object.fromEntries(Object.entries(after.unit).filter(([key]) => !changed.has(key))), Object.fromEntries(Object.entries(before.unit).filter(([key]) => !changed.has(key))));
    assert.deepEqual(after.gallery, before.gallery); await assertDraftOnly(convertedUnit, 'unit');
    await up.reload(); const readback = await json(await get(up, `${CONTENT}/${contentProposal.id}`)); assert.equal(readback.status, 'approved');
    report.contentProposalId = contentProposal.id;
  });
  await step('Revocation before content approval and conversion retry fails closed; prior inventory, identities and grants remain intact', fp, async () => {
    const target = await json(await get(up, `${CONTENT}/target?scope=unit&id=${convertedUnit.unitId}`));
    const proposal = { facts: { ...target.snapshot.facts, floor: '8' }, description: null, gallery: { mediaIds: target.snapshot.gallery.mediaIds, coverMediaId: target.snapshot.gallery.coverMediaId } };
    const pending = await json(await post(up, CONTENT, { scope: 'unit', targetId: convertedUnit.unitId, baselineVersion: target.baselineVersion, proposal, status: 'submitted' }), 201);
    const before = await canonicalContent(convertedUnit.unitId);
    await member(fp, unitCreator, 'create_unit', false);
    await denied(await post(fp, `/api/admin/property-content-proposals/${pending.id}/review`, { action: 'approve', expectedRevision: pending.revision }), 403, CONTENT_DENIED);
    await denied(await get(up, `${CONTENT}/target?scope=unit&id=${convertedUnit.unitId}`), 403, CONTENT_DENIED);
    await denied(await post(fp, convertUrl(submittedUnit.id), reviewBody(submittedUnit)), 403, ACCESS_ERROR);
    assert.deepEqual(await json(await get(up, CONTENT)), { targets: [], items: [] });
    const retained = await json(await get(up, `${API}?id=${submittedUnit.id}`));
    assert.equal(retained.status, 'converted'); assert.equal(retained.hasCreationAccess, false); assert.equal(retained.mayEdit, false);
    assert.equal(retained.matchedExisting, false, 'Redacting output IDs after revocation must not mislabel a genuinely new record as an existing match');
    assert.equal(retained.createdUnitId, null); assert.equal(retained.createdProjectId, null);
    assert.deepEqual(retained.draft, submittedUnit.draft, 'Revoked creator sees only the original intake, never later canonical edits');
    await openCreation(up, retained, UNIT_NAME); assert.equal(await up.getByRole('link', { name: 'Propose content changes', exact: true }).count(), 0);
    assert.equal(await up.getByLabel('Description', { exact: true }).inputValue(), UNIT_DESCRIPTION);
    assert.deepEqual(await canonicalContent(convertedUnit.unitId), before); await assertDraftOnly(convertedUnit, 'unit'); await assertDraftOnly(convertedComplex, 'complex');
    await assertPreserved(beforeFixtures);
    assert.deepEqual(clone(await db.roleAssignment.findMany({ orderBy: { id: 'asc' } })), beforeFixtures.roleAssignment, 'No new legacy role may appear for any identity');
    assert.deepEqual(clone(await db.projectStaffPermission.findMany({ orderBy: rowOrder('projectStaffPermission') })), beforeFixtures.projectStaffPermission);
    assert.deepEqual(clone(await db.operatingSpaceMember.findMany({ where: { identityId: { notIn: ownIdentityIds } }, orderBy: { id: 'asc' } })), beforeFixtures.operatingSpaceMember);
    // All earlier inventories plus this runner's original scoped/hidden rows are unchanged.
    assert.deepEqual(clone(await db.project.findMany({ where: { id: { in: beforeConversion.projects.map(row => row.id) } }, orderBy: { id: 'asc' } })), beforeConversion.projects);
    assert.deepEqual(clone(await db.unit.findMany({ where: { id: { in: beforeConversion.units.map(row => row.id) } }, orderBy: { id: 'asc' } })), beforeConversion.units);
    assert.equal(await db.unit.count(), beforeConversion.units.length + 1); assert.equal(await db.project.count(), beforeConversion.projects.length + 1);
  });
  await step('A disabled creation-only identity loses its existing session, home entry and all creator-intake reads', cp, async () => {
    assert.equal((await json(await get(cp, API))).spaces.length, 1);
    await db.identity.update({ where: { id: complexCreator.id }, data: { status: 'blocked' } });
    try {
      await cp.goto('/app'); await cp.waitForURL(url => url.pathname === '/login');
      assert.equal(new URL(cp.url()).searchParams.get('next'), '/app');
      assert.equal(await cp.getByRole('link', { name: /^Your property workspace/ }).count(), 0);
      for (const path of [API, `${API}?id=${submittedComplex.id}`, `${API}?requestId=${savedComplex.command.requestId}`]) await denied(await get(cp, path), 401, 'Unauthorized');
      await cp.goto('/property/create'); await cp.waitForURL(url => url.pathname === '/login');
      assert.equal(new URL(cp.url()).searchParams.get('next'), '/property/create');
    } finally {
      await db.identity.update({ where: { id: complexCreator.id }, data: { status: complexCreator.status } });
    }
    await assertPreserved(beforeFixtures); await assertNoRoles();
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally {
  for (const { ctx, name } of contexts) { await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {}); await ctx.close().catch(() => {}); }
  if (browser) await browser.close(); await db.$disconnect(); await persist();
}
