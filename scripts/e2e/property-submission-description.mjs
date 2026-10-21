import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Exact disposable localhost DB/server guard runs before Prisma or browser use.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const report = { headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true, steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running', limits: ['Invitation email delivery and durable upload transport are not exercised.'] };
const contexts = [];
let browser;
let applicationId;
let unitId;
const unitName = 'Synthetic applicant condo A201';
const description = 'Тестовое описание квартиры: отдельная спальня и балкон. Не реальный объект.';
async function step(name, page, work) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try { await work(); entry.status = 'passed'; await page.screenshot({ caret: 'initial', path: `browser-results/property-submission-${report.steps.length}.png`, fullPage: true }); console.log(`PASS ${name}`); }
  catch (error) { entry.status = 'failed'; entry.error = String(error); throw error; }
  finally { await writeFile('browser-results/property-submission-result.json', JSON.stringify(report, null, 2)); }
}
async function context(name, mobile = false) {
  const ctx = await browser.newContext({ baseURL: baseUrl, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  contexts.push({ ctx, name }); ctx.setDefaultTimeout(15000); ctx.setDefaultNavigationTimeout(30000);
  await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
  await ctx.route('**/*', route => { const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
    report.blockedBrowserOrigins.push(url.origin); return route.abort('blockedbyclient'); });
  ctx.on('page', page => {
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('response', response => { if (response.url().startsWith(baseUrl) && response.status() >= 500) report.serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  return ctx;
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const response = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.waitForURL(url => url.pathname === next.split('?')[0]);
  assert.equal((await page.request.get('/api/auth/me')).status(), 200);
}
async function save(page, label = 'Save and continue →') {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/property-submissions' && ['POST', 'PATCH'].includes(res.request().method()));
  await page.getByRole('button', { name: label, exact: true }).click();
  const saved = await response;
  assert.ok([200, 201].includes(saved.status()), `Intake save returned ${saved.status()}: ${await saved.text()}`);
  const data = await saved.json(); applicationId = data.id; return data;
}
try {
  await mkdir('browser-results', { recursive: true });
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  const identity = await db.identity.findUniqueOrThrow({ where: { id: fixture.serviceCustomerId } });
  assert.equal(identity.isAdmin, false);
  assert.equal(await db.roleAssignment.count({ where: { identityId: identity.id } }), 0);
  browser = await chromium.launch({ headless: true });
  const applicant = await context('submission-applicant', true); const ap = await applicant.newPage();
  const reviewer = await context('submission-reviewer'); const rp = await reviewer.newPage();
  await step('Ordinary individual signs in and opens mobile property intake without staff or owner rights', ap, async () => {
    await login(ap, fixture.serviceCustomerEmail, '/property/onboard?kind=home');
    await ap.getByRole('heading', { name: 'Tell us about your place', exact: true }).waitFor();
    assert.ok(await ap.locator('main').first().evaluate(node => node.scrollWidth <= window.innerWidth), 'No horizontal overflow in mobile intake');
  });
  await step('Applicant saves a new home draft in the existing canonical complex', ap, async () => {
    await save(ap);
    await ap.getByRole('heading', { level: 2, name: 'Residence', exact: true }).waitFor();
    await ap.getByRole('button', { name: /^Synthetic Browser Estate/ }).click();
    await save(ap);
    await ap.getByRole('heading', { level: 2, name: 'Home details', exact: true }).waitFor();
    await ap.getByLabel('Home name or number', { exact: true }).fill(unitName);
    await ap.getByLabel('Maximum guests', { exact: true }).fill('2');
    await ap.getByLabel('Bedrooms', { exact: true }).fill('1');
    await ap.getByLabel('Bathrooms', { exact: true }).fill('1');
    await ap.getByLabel('Description language', { exact: true }).selectOption('ru');
    await ap.getByLabel('Describe your home', { exact: true }).fill(description);
    await save(ap, 'Save draft');
    assert.equal(await db.unit.count({ where: { name: unitName } }), 0, 'Draft save must not create canonical inventory');
  });
  await step('Description and language survive reload and resume while the UI remains English', ap, async () => {
    await ap.goto('/property/onboard');
    await ap.getByRole('button', { name: new RegExp(`^${unitName} ·`) }).click();
    await ap.getByRole('heading', { level: 2, name: 'Your property', exact: true }).waitFor();
    await save(ap); await ap.getByRole('heading', { level: 2, name: 'Residence', exact: true }).waitFor();
    await save(ap); await ap.getByRole('heading', { level: 2, name: 'Home details', exact: true }).waitFor();
    assert.equal(await ap.getByLabel('Description language', { exact: true }).inputValue(), 'ru');
    assert.equal(await ap.getByLabel('Describe your home', { exact: true }).inputValue(), description);
    await save(ap); await ap.getByRole('heading', { level: 2, name: 'Photos', exact: true }).waitFor();
    assert.equal(await ap.locator('input[type=file]').count(), 1, 'Image intake control is reachable; transport is a separate check');
  });
  await step('Submission remains separate and immutable until an administrator reviews it', ap, async () => {
    await save(ap); await ap.getByRole('heading', { level: 2, name: 'Offers and management', exact: true }).waitFor();
    await ap.getByLabel('Monthly rental', { exact: true }).check();
    await save(ap); await ap.getByRole('heading', { level: 2, name: 'Review application', exact: true }).waitFor();
    await save(ap, 'Submit for review');
    const stored = await db.crmOpportunity.findUniqueOrThrow({ where: { id: applicationId } });
    assert.equal(stored.identityId, identity.id); assert.equal(stored.requirements.status, 'submitted');
    assert.equal(stored.requirements.descriptionLocale, 'ru');
    assert.equal(await db.unit.count({ where: { name: unitName } }), 0);
    assert.equal((await ap.request.patch('/api/property-submissions', { data: { id: applicationId, description: 'Attempted post-submit edit' } })).status(), 409);
    assert.equal((await ap.request.post(`/api/admin/property-submissions/${applicationId}/convert`, { data: { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true } })).status(), 403);
  });
  await step('Administrator reviews the actual submission without falsely making the employee its owner', rp, async () => {
    await login(rp, fixture.founderEmail, '/app/admin/property-submissions');
    const card = rp.locator('article').filter({ has: rp.getByRole('heading', { name: unitName, exact: true }) });
    await card.waitFor(); await card.getByText(description, { exact: true }).waitFor();
    const language = card.getByLabel('Description language', { exact: true });
    assert.equal(await language.inputValue(), 'ru'); assert.equal(await language.isDisabled(), true);
    for (const name of ["I checked the applicant's identity, mandate or ownership evidence.", 'I checked project and unit duplicates and selected the correct canonical complex.', 'I checked submitted project and unit photos are appropriate for their distinct scopes.']) await card.getByRole('checkbox', { name, exact: true }).check();
    const owner = card.getByRole('checkbox', { name: /The applicant is independently verified as the unit owner/ });
    assert.equal(await owner.isChecked(), false);
    const converted = rp.waitForResponse(res => res.url().endsWith(`/api/admin/property-submissions/${applicationId}/convert`) && res.request().method() === 'POST');
    await card.getByRole('button', { name: 'Create canonical draft →', exact: true }).click();
    const response = await converted; assert.equal(response.status(), 200, await response.text());
    unitId = (await response.json()).unitId; assert.ok(unitId);
    await card.getByText('Created canonical draft records. Existing activation checks still apply.', { exact: true }).waitFor();
  });
  await step('Canonical description survives conversion with exact language, namespace and draft status', rp, async () => {
    const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
    assert.equal(unit.status, 'draft'); assert.equal(unit.ownerIdentityId, null);
    const content = await db.contentKey.findUniqueOrThrow({ where: { key: unit.descriptionKey }, include: { translations: true } });
    assert.equal(content.namespace, 'unit'); assert.equal(content.translations.length, 1);
    assert.equal(content.translations[0].locale, 'ru'); assert.equal(content.translations[0].value, description); assert.equal(content.translations[0].status, 'needs_review');
    assert.equal(await db.roleAssignment.count({ where: { identityId: identity.id } }), 0);
    assert.equal(await db.unitEngagement.count({ where: { unitId } }), 0);
    const retry = await rp.request.post(`/api/admin/property-submissions/${applicationId}/convert`, { data: { verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true } });
    assert.equal(retry.status(), 200); assert.equal((await retry.json()).alreadyConverted, true);
    assert.equal(await db.unit.count({ where: { name: unitName } }), 1);
    const anonymous = await context('submission-anonymous'); const np = await anonymous.newPage();
    assert.equal((await np.request.get(`/api/units/${unitId}`)).status(), 404);
    await rp.reload(); await rp.getByText('Canonical draft created.', { exact: true }).waitFor();
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally {
  for (const { ctx, name } of contexts) { await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {}); await ctx.close().catch(() => {}); }
  if (browser) await browser.close(); await db.$disconnect();
  await writeFile('browser-results/property-submission-result.json', JSON.stringify(report, null, 2));
}
