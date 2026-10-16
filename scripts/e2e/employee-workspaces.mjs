import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const report = { headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running',
  limits: ['No email provider is configured: the authorized founder passes a single-use local claim link.',
    'No real account, invitation email, media transport, public publication or production grants are exercised.',
    'This journey covers existing tariff-grid controls, not future category inheritance, promotions or calendar authority.'] };
const contexts = [];
const clone = value => JSON.parse(JSON.stringify(value));
const originalName = 'Synthetic Employee Condo C401';
const proposedName = 'Synthetic Employee Condo C401 revised';
const employeeEmail = 'employee-workspace@browser.example.test';
const childEmail = 'employee-child@browser.example.test';
const prose = 'Synthetic employee description for a quiet one-bedroom condominium.';
let browser, fixture, projectId, unitId, siblingId, employeeId, childId, employeeInvite, childInvite, proposalId;
let originalBookings, originalOccupancy, protectedPeople, sibling, contentGrant, pricingGrant, modeGrant, childGrant;
async function persist() { await writeFile('browser-results/employee-workspaces-result.json', JSON.stringify(report, null, 2)); }
async function step(name, page, work) {
  const item = { name, status: 'running' }; report.steps.push(item);
  try {
    await work(); item.status = 'passed';
    if (page) await page.screenshot({ path: `browser-results/employee-workspaces-${report.steps.length}.png`, fullPage: true,
      mask: [page.locator('.font-mono')] });
    console.log(`PASS ${name}`);
  } catch (error) {
    item.status = 'failed'; item.error = String(error);
    if (page) await page.screenshot({ path: `browser-results/employee-workspaces-${report.steps.length}-failed.png`, fullPage: true,
      mask: [page.locator('.font-mono')] }).catch(() => {});
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
    page.on('response', res => { if (new URL(res.url()).origin === baseUrl && res.status() >= 500)
      report.serverErrors.push(`${res.status()} ${new URL(res.url()).pathname}`); });
  });
  // Claim proofs and passwords never enter a browser trace artifact.
  return ctx;
}
async function json(response, expected = 200) {
  assert.equal(response.status(), expected, `Unexpected ${response.status()} from ${new URL(response.url()).pathname}: ${await response.text()}`);
  return response.json();
}
function response(page, path, method) {
  return page.waitForResponse(res => new URL(res.url()).pathname === path && res.request().method() === method);
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email); await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const pending = response(page, '/api/auth/login', 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await pending).status(), 200); await page.waitForURL(url => url.pathname === next);
}
async function invite(page, email, firstName) {
  await page.getByLabel('First name', { exact: true }).fill(firstName);
  await page.getByLabel('Last name', { exact: true }).fill('Synthetic');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('After password setup', { exact: true }).selectOption('property');
  const pending = response(page, '/api/admin/people/invite', 'POST');
  await page.getByRole('button', { name: 'Send invitation', exact: true }).click();
  const body = await json(await pending, 201);
  assert.equal(body.identity.email, email); assert.equal(body.identity.status, 'invited');
  assert.equal(body.emailed, false); assert.equal(body.emailStatus, 'unavailable');
  const url = new URL(body.claimUrl); assert.equal(url.origin, baseUrl); assert.equal(url.pathname, '/auth/claim');
  assert.equal(url.searchParams.get('next'), '/property'); assert.match(url.searchParams.get('token'), /^[a-f0-9]{64}$/);
  await page.getByRole('heading', { name: `${firstName} Synthetic`, exact: true }).waitFor();
  return body;
}
async function founderGrant(page, role, canDelegate = false) {
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  assert.equal(await page.getByLabel('Scope', { exact: true }).inputValue(), 'unit');
  await page.getByLabel('Project', { exact: true }).selectOption(projectId);
  await page.getByLabel('Exact unit', { exact: true }).selectOption(unitId);
  if (role !== 'content_contributor') await page.getByLabel('Allow this person to delegate this right within this scope', { exact: true }).setChecked(canDelegate);
  const pending = response(page, '/api/admin/roles/grant', 'POST');
  await page.getByRole('button', { name: 'Grant', exact: true }).click();
  const body = await json(await pending); const grant = body.roleAssignment;
  assert.equal(grant.role, role); assert.equal(grant.identityId, employeeId); assert.equal(grant.unitId, unitId);
  assert.equal(grant.projectId, projectId); assert.equal(grant.scopeType, 'unit');
  if (role !== 'content_contributor') assert.equal(grant.canDelegate, canDelegate);
  return grant;
}
async function claim(page, invited) {
  await page.goto(invited.claimUrl);
  await page.locator('#claim-password').fill(fixture.password); await page.locator('#claim-confirm').fill(fixture.password);
  const pending = response(page, '/api/auth/claim', 'POST'); await page.locator('form button[type=submit]').click();
  assert.equal((await pending).status(), 200); await page.waitForURL(url => url.pathname === '/property');
  await page.getByRole('heading', { name: 'Your property workspace', exact: true }).waitFor();
  assert.equal((await page.request.get('/api/auth/me')).status(), 200);
  const identity = await db.identity.findUniqueOrThrow({ where: { id: invited.identity.id } });
  assert.equal(identity.status, 'active'); assert.equal(identity.isAdmin, false); assert.ok(identity.hashedPassword); assert.equal(identity.emailVerifiedAt, null);
  const hashedPassword = identity.hashedPassword;
  assert.equal((await page.request.post('/api/auth/claim', { data: { token: new URL(invited.claimUrl).searchParams.get('token'), password: fixture.password } })).status(), 400);
  assert.equal((await db.identity.findUniqueOrThrow({ where: { id: invited.identity.id } })).hashedPassword, hashedPassword);
}
async function hubPaths(page) { return page.locator('main ul a').evaluateAll(links => links.map(a => new URL(a.href).pathname).sort()); }
async function savedProposal(page, submit = false) {
  const pending = response(page, proposalId ? `/api/property-content-proposals/${proposalId}` : '/api/property-content-proposals', proposalId ? 'PATCH' : 'POST');
  await page.getByRole('button', { name: submit ? 'Save and submit for review' : 'Save draft', exact: true }).click();
  const body = await json(await pending, proposalId ? 200 : 201); proposalId = body.id;
  assert.equal(body.status, submit ? 'submitted' : 'draft'); return body;
}
async function protectedState() {
  assert.deepEqual(clone(await db.booking.findMany({ orderBy: { id: 'asc' } })), originalBookings, 'Existing booking snapshots must remain byte-for-byte unchanged');
  assert.deepEqual(clone(await db.blockedDate.findMany({ orderBy: { id: 'asc' } })), originalOccupancy, 'Existing occupancy must remain unchanged');
  assert.deepEqual(clone(await db.unit.findUniqueOrThrow({ where: { id: siblingId } })), sibling);
  assert.deepEqual(clone(await db.identity.findMany({ where: { id: { in: [fixture.guestId, protectedPeople[0].id, protectedPeople[1].id] } },
    select: { id: true, email: true, status: true, isAdmin: true, updatedAt: true }, orderBy: { id: 'asc' } })), protectedPeople);
}
try {
  await mkdir('browser-results', { recursive: true }); fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  assert.equal(fixture.founderEmail, 'founder@browser.example.test');
  await step('Prepare separate synthetic existing condos without changing prior people or bookings', null, async () => {
    assert.equal(await db.project.count({ where: { slug: 'synthetic-employee-cabinet' } }), 0);
    assert.equal(await db.identity.count({ where: { email: { in: [employeeEmail, childEmail] } } }), 0);
    const founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } });
    protectedPeople = clone(await db.identity.findMany({ where: { id: { in: [founder.id, fixture.guestId] } },
      select: { id: true, email: true, status: true, isAdmin: true, updatedAt: true }, orderBy: { id: 'asc' } }));
    assert.equal(protectedPeople.length, 2);
    originalBookings = clone(await db.booking.findMany({ orderBy: { id: 'asc' } }));
    originalOccupancy = clone(await db.blockedDate.findMany({ orderBy: { id: 'asc' } }));
    const project = await db.project.create({ data: { slug: 'synthetic-employee-cabinet', name: 'Synthetic Employee Complex', projectType: 'condominium',
      areaLabelKey: 'browser.employee.area', descriptionKey: 'browser.employee.description', handbookKey: 'browser.employee.handbook',
      latitude: '8.01', longitude: '98.30', address: 'Synthetic address only', timezone: 'Asia/Bangkok', status: 'draft' } }); projectId = project.id;
    const category = await db.inventoryCategory.create({ data: { projectId, categoryKey: 'synthetic-employee-category', name: 'Synthetic condos',
      bedrooms: 1, bathrooms: 1, maxGuests: 2, baseNightlyThb: 222222, minNights: 2 } });
    const data = { projectId, inventoryCategoryId: category.id, categoryKey: category.categoryKey, unitType: 'condo', bedrooms: 1, bathrooms: 1,
      maxGuests: 2, sizeSqm: 40, grossAreaSqm: '42.50', floor: '3', addressSupplement: 'C401', amenityKeys: ['wifi'],
      baseNightlyThb: 222222, minNights: 2, instantBook: true, status: 'draft' };
    unitId = (await db.unit.create({ data: { ...data, name: originalName } })).id;
    sibling = clone(await db.unit.create({ data: { ...data, name: 'Synthetic Unassigned Employee Condo D402', addressSupplement: 'D402' } })); siblingId = sibling.id;
    await db.commercialOffering.create({ data: { unitId, offeringType: 'short_term_stay', status: 'active',
      pricingTerms: { sourceSystem: 'browser_synthetic', quoteEngine: 'canonical_tariff_grid_v1', policyEngineVerified: true, taxPolicyVerified: true,
        tariffGrid: [{ sourceRateId: 'browser-employee-all', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }], rateMode: 'daily',
          pricingUnit: 'night', amountSatang: 100000, currency: 'THB', minimumNights: 1, includesTaxes: true, includesServiceCharge: true,
          includesBreakfast: false, sourceSellable: true }] }, rulesAndPolicies: {} } });
    report.fixture = { projectId, unitId, siblingId };
  });
  browser = await chromium.launch({ headless: true });
  const founder = await (await context('founder')).newPage();
  const employee = await (await context('employee', true)).newPage();
  const child = await (await context('employee-child', true)).newPage();
  await step('Founder invites a named synthetic employee through People and receives an honest fallback link', founder, async () => {
    await login(founder, fixture.founderEmail, '/app/admin/people');
    await founder.getByRole('link', { name: 'Employee sign-in link', exact: true }).waitFor();
    employeeInvite = await invite(founder, employeeEmail, 'Employee'); employeeId = employeeInvite.identity.id;
    const account = await db.identity.findUniqueOrThrow({ where: { id: employeeId } }); assert.equal(account.hashedPassword, null);
  });
  await step('Founder assigns three separate exact-unit rights and permits only pricing delegation', founder, async () => {
    contentGrant = await founderGrant(founder, 'content_contributor');
    pricingGrant = await founderGrant(founder, 'pricing_editor', true);
    modeGrant = await founderGrant(founder, 'booking_mode_editor');
    assert.equal(await db.projectStaffPermission.count({ where: { identityId: employeeId } }), 0);
    assert.deepEqual((await db.roleAssignment.findMany({ where: { identityId: employeeId }, orderBy: { role: 'asc' } })).map(row => row.role).sort(),
      ['booking_mode_editor', 'content_contributor', 'pricing_editor']);
  });
  await step('Employee sets their own password once and lands in the assigned mobile cabinet', employee, async () => {
    await claim(employee, employeeInvite);
    assert.deepEqual(await hubPaths(employee), ['/property/access', '/property/booking-mode', '/property/content', '/property/pricing']);
    assert.ok(await employee.locator('main').last().evaluate(node => node.scrollWidth <= window.innerWidth));
    await employee.goto('/app'); await employee.getByRole('link').filter({ hasText: 'Your property workspace' }).waitFor();
  });
  await step('Server denies sibling inventory, administrator data and category scope beyond the assignment', employee, async () => {
    for (const path of [`/api/property-content-proposals/target?scope=unit&id=${siblingId}`, `/api/admin/units/${siblingId}/tariff`,
      `/api/admin/people/search?q=${encodeURIComponent(childEmail)}`]) assert.equal((await employee.request.get(path)).status(), 403, path);
    assert.equal((await employee.request.post(`/api/property-booking-mode/${siblingId}`, { data: { scope: 'unit', instantBook: false } })).status(), 403);
    assert.equal((await employee.request.post(`/api/property-booking-mode/${unitId}`, { data: { scope: 'category', instantBook: false } })).status(), 403);
    assert.equal((await employee.request.post('/api/admin/roles/grant', { data: { identityId: employeeId, role: 'staff_ops', scopeType: 'platform' } })).status(), 403);
  });
  await step('Employee saves and reopens descriptions as a draft, then submits without canonical mutation', employee, async () => {
    await employee.goto('/property/content'); await employee.getByLabel('Property to edit', { exact: true }).selectOption(`unit:${unitId}`);
    await employee.getByRole('button', { name: 'Start proposal', exact: true }).click();
    await employee.getByLabel('Unit name / number', { exact: true }).fill(proposedName);
    await employee.getByLabel('Propose a description change', { exact: true }).check();
    await employee.getByLabel('Description language', { exact: true }).selectOption('en');
    await employee.getByLabel('Description text', { exact: true }).fill(prose);
    await savedProposal(employee);
    assert.equal((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).name, originalName);
    await employee.goto('/property/content'); await employee.getByRole('button', { name: `Open proposal: ${originalName}`, exact: true }).click();
    assert.equal(await employee.getByLabel('Description text', { exact: true }).inputValue(), prose);
    await savedProposal(employee, true);
    assert.equal((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).name, originalName);
  });
  await step('Administrator reviews the exact proposal and atomically applies approved canonical content', founder, async () => {
    await founder.goto('/app/admin/property-content-proposals');
    await founder.getByRole('button').filter({ has: founder.getByText(originalName, { exact: true }) }).click();
    const card = founder.locator('article').filter({ has: founder.getByRole('heading', { name: proposedName, exact: true }) });
    await card.getByRole('checkbox', { name: 'I checked the facts, description and each photo for this exact property and approve applying these changes.', exact: true }).check();
    const pending = response(founder, `/api/admin/property-content-proposals/${proposalId}/review`, 'POST');
    await card.getByRole('button', { name: 'Approve and apply content', exact: true }).click();
    assert.equal((await json(await pending)).status, 'approved');
    const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } }); assert.equal(unit.name, proposedName); assert.equal(unit.status, 'draft');
    assert.equal(unit.baseNightlyThb, 222222); assert.equal(unit.instantBook, true);
    const content = await db.contentKey.findUniqueOrThrow({ where: { key: unit.descriptionKey }, include: { translations: true } });
    assert.equal(content.translations.find(row => row.locale === 'en').value, prose);
  });
  await step('Assigned employee edits the actual tariff form and saved database rates drive the canonical preview', employee, async () => {
    await employee.goto(`/property/pricing/${unitId}`);
    await employee.getByLabel('THB per night', { exact: true }).fill('1500');
    const pending = response(employee, `/api/admin/units/${unitId}/tariff`, 'PUT');
    await employee.getByRole('button', { name: 'Save for this villa', exact: true }).click();
    assert.equal((await json(await pending)).saved, 1);
    const offer = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    assert.equal(offer.pricingTerms.tariffGrid[0].amountSatang, 150000);
    const quote = await json(await employee.request.post(`/api/admin/units/${unitId}/tariff-preview`, { data: { mode: 'stay', checkIn: '2028-01-01', checkOut: '2028-01-03', guests: 1 } }));
    assert.equal(quote.pricingScope, 'canonical_quote'); assert.equal(quote.totalSatang, 300000); assert.equal(quote.bookable, false);
    await protectedState();
  });
  await step('Employee reviews one exact unit before changing booking mode, preserving prices and occupancy', employee, async () => {
    const before = clone(await db.unit.findUniqueOrThrow({ where: { id: unitId } }));
    const offers = clone(await db.commercialOffering.findMany({ where: { unitId } }));
    await employee.goto(`/property/booking-mode/${unitId}`);
    await employee.getByRole('radio', { name: 'Request to book', exact: true }).click();
    const previewPending = response(employee, `/api/property-booking-mode/${unitId}`, 'POST');
    await employee.getByRole('button', { name: 'Preview this unit', exact: true }).click();
    const preview = await json(await previewPending); assert.deepEqual(preview.units.map(row => row.id), [unitId]);
    await employee.getByLabel('I reviewed every affected unit and the selected booking mode.', { exact: true }).check();
    const pending = response(employee, `/api/property-booking-mode/${unitId}`, 'PUT');
    await employee.getByRole('button', { name: 'Apply reviewed change', exact: true }).click(); assert.equal((await json(await pending)).updated, 1);
    const after = clone(await db.unit.findUniqueOrThrow({ where: { id: unitId } })); assert.equal(after.instantBook, false);
    assert.deepEqual({ ...after, instantBook: before.instantBook, updatedAt: before.updatedAt }, before);
    assert.deepEqual(clone(await db.commercialOffering.findMany({ where: { unitId } })), offers); await protectedState();
  });
  await step('Founder invites a second account; manager delegates only the existing exact pricing right', employee, async () => {
    await founder.goto('/app/admin/people'); childInvite = await invite(founder, childEmail, 'Child'); childId = childInvite.identity.id;
    await employee.goto('/property/access'); await employee.getByLabel('Employee account email', { exact: true }).fill(childEmail);
    await employee.getByLabel('Choose a unit', { exact: true }).selectOption(unitId);
    assert.equal(await employee.getByLabel('Your delegable right', { exact: true }).locator('option').count(), 1);
    await employee.getByLabel('I reviewed the employee, right and exact properties.', { exact: true }).check();
    const pending = response(employee, '/api/property-access', 'POST'); await employee.getByRole('button', { name: 'Assign this right', exact: true }).click();
    await json(await pending);
    childGrant = await db.roleAssignment.findFirstOrThrow({ where: { identityId: childId, role: 'pricing_editor' } });
    assert.equal(childGrant.parentGrantId, pricingGrant.id); assert.equal(childGrant.canDelegate, false); assert.equal(childGrant.unitId, unitId);
    assert.equal((await employee.request.post('/api/property-access', { data: { action: 'grant', email: childEmail, role: 'pricing_editor',
      scopeType: 'unit', projectId, unitId: siblingId, parentGrantId: pricingGrant.id } })).status(), 403);
    assert.equal((await employee.request.post('/api/property-access', { data: { action: 'grant', email: childEmail, role: 'pricing_editor',
      scopeType: 'unit', projectId, unitId, parentGrantId: pricingGrant.id, canDelegate: true } })).status(), 400);
  });
  await step('Delegated employee claims an individual account and sees pricing only, without redelegation', child, async () => {
    await claim(child, childInvite); assert.deepEqual(await hubPaths(child), ['/property/pricing']);
    assert.equal((await child.request.get('/api/property-access')).status(), 403);
    assert.equal((await child.request.post(`/api/property-booking-mode/${unitId}`, { data: { scope: 'unit', instantBook: false } })).status(), 403);
    assert.equal((await child.request.get(`/api/property-content-proposals/target?scope=unit&id=${unitId}`)).status(), 403);
    assert.equal((await child.request.get(`/api/admin/units/${unitId}/tariff`)).status(), 200);
  });
  await step('Founder revocation immediately removes parent and child pricing while retaining independent rights', founder, async () => {
    await founder.goto('/app/admin/people');
    await founder.getByPlaceholder('Search by name, email or phone', { exact: true }).fill(employeeEmail);
    await founder.getByRole('button', { name: 'Search by name, email or phone', exact: true }).click();
    await founder.getByRole('button').filter({ has: founder.getByText(employeeEmail, { exact: true }) }).click();
    const row = founder.locator('li').filter({ hasText: 'Pricing editor' });
    const pending = response(founder, '/api/admin/roles/revoke', 'POST'); await row.getByRole('button', { name: 'Revoke', exact: true }).click();
    await json(await pending);
    for (const id of [pricingGrant.id, childGrant.id]) assert.equal((await db.roleAssignment.findUniqueOrThrow({ where: { id } })).status, 'revoked');
    for (const page of [employee, child]) {
      assert.equal((await page.request.get(`/api/admin/units/${unitId}/tariff`)).status(), 403);
      assert.equal((await page.request.get('/api/property-access')).status(), 403);
    }
    await child.goto('/property'); assert.deepEqual(await hubPaths(child), []);
    await employee.goto('/property'); assert.deepEqual(await hubPaths(employee), ['/property/booking-mode', '/property/content']);
    assert.equal((await db.roleAssignment.findUniqueOrThrow({ where: { id: contentGrant.id } })).status, 'active');
    assert.equal((await db.roleAssignment.findUniqueOrThrow({ where: { id: modeGrant.id } })).status, 'active');
    assert.equal(await db.projectStaffPermission.count({ where: { identityId: { in: [employeeId, childId] } } }), 0);
    await protectedState();
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed'; console.log(`PASS employee workspace journey: ${report.steps.length} checks`);
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally { await persist(); for (const { ctx } of contexts) await ctx.close(); await browser?.close(); await db.$disconnect(); }
