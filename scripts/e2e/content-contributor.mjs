import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Keep the exact disposable localhost guard before Prisma or browser loading.
const { baseUrl } = require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const report = {
  headCommit: process.env.BROWSER_HEAD_SHA || null, baseUrl, synthetic: true,
  steps: [], blockedBrowserOrigins: [], pageErrors: [], serverErrors: [], result: 'running',
  limits: ['Upload control reachability is checked; durable upload transport and invitation email delivery are not exercised.'],
};
const contexts = [];
const API = '/api/property-content-proposals';
const originalName = 'Synthetic Contributor Condo A301';
const proposedName = 'Synthetic Contributor Condo A301 revised';
const originalRussian = 'Исходное тестовое описание квартиры. Это синтетический объект.';
const firstRussian = 'Тестовая квартира: две спальни и балкон. Только синтетические данные.';
const finalRussian = 'Тестовая квартира: две спальни, балкон и уточнённый этаж. Только синтетические данные.';
const reviewNote = 'Synthetic review: confirm floor 5 and clarify the Russian description.';
let browser, fixture, unitId, siblingId, projectId, contributorId, founderId, roleId;
let proposalId, saved, submitted, returned, approved, original, originalProtectedPeople, originalProject, originalOtherUnits, originalMedia;
let mediaIds = [], mediaPaths = [];
const clone = value => JSON.parse(JSON.stringify(value));

async function persist() {
  await writeFile('browser-results/content-contributor-result.json', JSON.stringify(report, null, 2));
}
async function step(name, page, work) {
  const entry = { name, status: 'running' }; report.steps.push(entry);
  try {
    await work(); entry.status = 'passed';
    if (page) await page.screenshot({ path: `browser-results/content-contributor-${report.steps.length}.png`, fullPage: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    entry.status = 'failed'; entry.error = String(error);
    if (page) await page.screenshot({ path: `browser-results/content-contributor-${report.steps.length}-failed.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await persist(); }
}
async function context(name, mobile = false) {
  const ctx = await browser.newContext({
    baseURL: baseUrl, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, locale: 'en-US', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block',
  });
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
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  return ctx;
}
async function login(page, email, next) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/^Email\s*\*?$/).fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
  const loginResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal((await loginResponse).status(), 200);
  await page.waitForURL(url => url.pathname === next.split('?')[0]);
  assert.equal((await page.request.get('/api/auth/me', { maxRedirects: 0 })).status(), 200);
}
async function json(response, expected = 200) {
  assert.equal(response.status(), expected, `Unexpected ${response.status()} from ${new URL(response.url()).pathname}: ${await response.text()}`);
  return response.json();
}
async function save(page, status = 'draft') {
  const response = page.waitForResponse(res => {
    const path = new URL(res.url()).pathname;
    return (path === API || path === `${API}/${proposalId}`) && ['POST', 'PATCH'].includes(res.request().method());
  });
  await page.getByRole('button', { name: status === 'draft' ? 'Save draft' : 'Save and submit for review', exact: true }).click();
  const result = await response;
  const detail = await json(result, proposalId ? 200 : 201);
  proposalId = detail.id; assert.equal(detail.status, status);
  await page.getByRole('status').filter({ hasText: status === 'draft' ? /^Draft saved\.$/ : /^Submitted for administrator review\.$/ }).waitFor();
  return detail;
}
async function review(page, action) {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === `/api/admin/property-content-proposals/${proposalId}/review` && res.request().method() === 'POST');
  await page.getByRole('button', { name: action === 'return' ? 'Return for changes' : 'Approve and apply content', exact: true }).click();
  return json(await response);
}
async function canonical() {
  const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId } });
  const content = unit.descriptionKey ? await db.contentKey.findUniqueOrThrow({ where: { key: unit.descriptionKey }, include: { translations: { orderBy: { locale: 'asc' } } } }) : null;
  const gallery = await db.unitMedia.findMany({ where: { unitId }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] });
  const titleKey = unit.marketingTitleKey ?? unit.descriptionKey?.replace(/\.description$/, '.title');
  const title = titleKey ? await db.contentKey.findUnique({ where: { key: titleKey }, include: { translations: { orderBy: { locale: 'asc' } } } }) : null;
  return clone({ unit, content, title, gallery });
}
function protectedUnit(unit) {
  const allowed = new Set(['name', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'grossAreaSqm', 'floor', 'addressSupplement', 'amenityKeys', 'descriptionKey', 'marketingTitleKey', 'coverMediaId', 'updatedAt']);
  return Object.fromEntries(Object.entries(unit).filter(([key]) => !allowed.has(key)));
}
async function protectedPeople() {
  return clone(await db.identity.findMany({
    where: { id: { in: [founderId, fixture.guestId] } },
    select: { id: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, updatedAt: true }, orderBy: { id: 'asc' },
  }));
}
async function assertOriginal() { assert.deepEqual(await canonical(), original, 'Canonical unit, translations and gallery must stay unchanged before approval'); }
async function otherUnits() {
  return clone(await db.unit.findMany({ where: { id: { in: [siblingId, fixture.unitId] } }, orderBy: { id: 'asc' } }));
}
async function compareReview(card, floor) {
  const floorComparison = card.locator('dt').filter({ hasText: /^Floor/ }).locator('..');
  await floorComparison.getByText('3', { exact: true }).waitFor();
  await floorComparison.getByText(floor, { exact: true }).waitFor();
  const bedroomComparison = card.locator('dt').filter({ hasText: /^Bedrooms/ }).locator('..');
  await bedroomComparison.getByText('1', { exact: true }).waitFor();
  await bedroomComparison.getByText('2', { exact: true }).waitFor();
  const gallery = card.getByRole('heading', { name: 'Gallery and cover order', exact: true }).locator('..');
  const lists = gallery.locator('ol'); assert.equal(await lists.count(), 2);
  const paths = async list => (await list.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))).map(src => {
    const url = new URL(src, baseUrl); return url.pathname === '/_next/image' ? url.searchParams.get('url') : url.pathname;
  });
  assert.deepEqual(await paths(lists.nth(0)), mediaPaths);
  assert.deepEqual(await paths(lists.nth(1)), [mediaPaths[1], mediaPaths[0], mediaPaths[2]]);
  await lists.nth(1).getByText('1 · Cover', { exact: true }).waitFor();
}

async function openReview(page) {
  await page.reload();
  await page.getByRole('heading', { name: 'Review property content', exact: true }).waitFor();
  await page.getByRole('button').filter({ has: page.getByText(originalName, { exact: true }) }).click();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: proposedName, exact: true }) });
  await card.waitFor(); return card;
}

try {
  await mkdir('browser-results', { recursive: true });
  fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'myuno_browser_test');
  await step('Prepare only separate synthetic draft content fixtures after earlier ordinary-customer journeys', null, async () => {
    assert.equal(fixture.serviceCustomerEmail, 'service-customer@browser.example.test');
    assert.equal(fixture.founderEmail, 'founder@browser.example.test');
    assert.equal(fixture.guestEmail, 'guest@browser.example.test');
    const contributor = await db.identity.findUniqueOrThrow({ where: { id: fixture.serviceCustomerId }, select: { id: true, email: true, isAdmin: true, status: true } });
    assert.equal(contributor.email, fixture.serviceCustomerEmail); assert.equal(contributor.isAdmin, false); assert.equal(contributor.status, 'active');
    contributorId = contributor.id;
    assert.equal(await db.roleAssignment.count({ where: { identityId: contributorId } }), 0, 'Run after guest and description journeys, against a fresh fixture');
    const founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail }, select: { id: true, isAdmin: true, status: true } });
    assert.equal(founder.isAdmin, true); assert.equal(founder.status, 'active'); founderId = founder.id;
    originalProtectedPeople = await protectedPeople();
    assert.equal(originalProtectedPeople.length, 2);
    assert.equal(await db.project.count({ where: { slug: 'synthetic-content-contributor-estate' } }), 0, 'Never reset or reuse an already modified contributor fixture');
    const project = await db.project.create({ data: {
      slug: 'synthetic-content-contributor-estate', name: 'Synthetic Contributor Condominium', projectType: 'condominium',
      areaLabelKey: 'browser.content.area', descriptionKey: 'browser.content.project.description', handbookKey: 'browser.content.handbook',
      latitude: '8.01', longitude: '98.30', address: 'Synthetic address only', timezone: 'Asia/Bangkok', status: 'draft',
    } });
    projectId = project.id;
    const unitData = { projectId, unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 40, grossAreaSqm: '42.50',
      floor: '3', addressSupplement: 'A301', amenityKeys: ['wifi'], baseNightlyThb: 222222, minNights: 2, instantBook: false, status: 'draft' };
    const unit = await db.unit.create({ data: { ...unitData, name: originalName } }); unitId = unit.id;
    const sibling = await db.unit.create({ data: { ...unitData, name: 'Synthetic Unassigned Condo B302', addressSupplement: 'B302' } }); siblingId = sibling.id;
    const key = await db.contentKey.create({ data: { key: `unit.${unitId}.browser.description`, namespace: 'unit', description: 'Synthetic contributor browser fixture', supportsRich: false } });
    await db.translation.createMany({ data: [
      { contentKeyId: key.id, locale: 'en', value: 'Original synthetic English description.', status: 'ok', updatedByIdentityId: founderId },
      { contentKeyId: key.id, locale: 'ru', value: originalRussian, status: 'ok', updatedByIdentityId: founderId },
    ] });
    await db.contentKey.create({ data: { key: key.key.replace(/\.description$/, '.title'), namespace: 'unit', description: 'Synthetic marketing title', supportsRich: false, translations: { create: [
      { locale: 'en', value: 'Synthetic quiet condo title', status: 'ok', updatedByIdentityId: founderId },
      { locale: 'ru', value: 'Синтетический заголовок квартиры', status: 'ok', updatedByIdentityId: founderId },
    ] } } });
    // Reuse real PNGs and their existing immutable metadata from the seed.
    // storageKey is unique. Add only links on this new synthetic unit, never
    // duplicate assets or change the original uploader. Existing linked gallery
    // photos are eligible without pretending this journey uploaded them.
    for (let index = 0; index < 3; index++) {
      const storageKey = `/browser-acceptance/unit-${index}.png`;
      const png = await readFile(`public${storageKey}`);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const media = await db.mediaAsset.findUniqueOrThrow({ where: { storageKey } });
      assert.equal(media.kind, 'photo'); assert.equal(media.mimeType, 'image/png');
      assert.equal(media.encrypted, false); assert.equal(media.sizeBytes, png.length);
      assert.equal(media.deleteAfter, null); assert.equal(media.uploadedByIdentityId, founderId);
      mediaIds.push(media.id); mediaPaths.push(storageKey);
      await db.unitMedia.create({ data: { unitId, mediaId: media.id, sort: index } });
    }
    originalMedia = clone(await db.mediaAsset.findMany({ where: { id: { in: mediaIds } }, orderBy: { id: 'asc' } }));
    await db.unit.update({ where: { id: unitId }, data: { descriptionKey: key.key, coverMediaId: mediaIds[0] } });
    const role = await db.roleAssignment.create({ data: { identityId: contributorId, role: 'content_contributor', scopeType: 'unit', projectId, unitId, status: 'active', grantedByIdentityId: founderId } });
    roleId = role.id; original = await canonical();
    originalProject = clone(await db.project.findUniqueOrThrow({ where: { id: projectId } }));
    originalOtherUnits = await otherUnits();
    report.fixture = { contributorId, projectId, unitId, siblingId, roleId, mediaIds };
  });

  browser = await chromium.launch({ headless: true });
  const contributorContext = await context('content-contributor-mobile', true); const cp = await contributorContext.newPage();
  const reviewerContext = await context('content-contributor-reviewer'); const rp = await reviewerContext.newPage();
  await step('Contributor logs in through the real mobile UI and sees only the exact assigned unit', cp, async () => {
    await login(cp, fixture.serviceCustomerEmail, '/property/content');
    await cp.getByRole('heading', { name: 'Content proposals', exact: true }).waitFor();
    const index = await json(await cp.request.get(API, { maxRedirects: 0 }));
    assert.deepEqual(index.targets.map(target => ({ scope: target.scope, id: target.id, projectId: target.projectId })), [{ scope: 'unit', id: unitId, projectId }]);
    const target = cp.getByLabel('Property to edit', { exact: true });
    await target.selectOption(`unit:${unitId}`);
    assert.deepEqual(await target.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean)), [`unit:${unitId}`]);
    await cp.getByRole('button', { name: 'Start proposal', exact: true }).click();
    await cp.getByLabel('Unit name / number', { exact: true }).waitFor();
    assert.ok(await cp.locator('main').last().evaluate(node => node.scrollWidth <= window.innerWidth), 'Contributor editor must not overflow at 390px');
  });
  await step('Contributor saves factual changes, Russian prose and reordered real gallery without canonical writes', cp, async () => {
    await cp.getByLabel('Unit name / number', { exact: true }).fill(proposedName);
    await cp.getByLabel('Bedrooms', { exact: true }).fill('2');
    await cp.getByLabel('Maximum guests', { exact: true }).fill('3');
    await cp.getByLabel('Gross area (m²; shown on the public card when set)', { exact: true }).fill('53.25');
    await cp.getByLabel('Floor', { exact: true }).fill('4');
    await cp.getByLabel('Propose a description change', { exact: true }).check();
    await cp.getByLabel('Description language', { exact: true }).selectOption('ru');
    await cp.getByLabel('Description text', { exact: true }).fill(firstRussian);
    const upload = cp.getByLabel('Add photos', { exact: true });
    assert.equal(await upload.getAttribute('type'), 'file'); assert.equal(await upload.isEnabled(), true);
    // Reachability only. Never mock the upload endpoint or call setInputFiles.
    await cp.getByRole('button', { name: 'Move earlier 2', exact: true }).click();
    await cp.getByRole('button', { name: 'Set as cover 1', exact: true }).click();
    const gallery = cp.getByRole('group', { name: 'Proposed gallery', exact: true });
    await gallery.locator('img').first().waitFor();
    await cp.waitForFunction(() => [...document.querySelectorAll('form fieldset img')].length === 3 && [...document.querySelectorAll('form fieldset img')].every(image => image.complete && image.naturalWidth > 0));
    assert.deepEqual(await gallery.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src'))), [mediaPaths[1], mediaPaths[0], mediaPaths[2]]);
    saved = await save(cp);
    assert.deepEqual(saved.proposal.gallery, { mediaIds: [mediaIds[1], mediaIds[0], mediaIds[2]], coverMediaId: mediaIds[1] });
    assert.deepEqual(saved.proposal.description, { locale: 'ru', value: firstRussian });
    assert.equal(saved.proposal.facts.floor, '4'); assert.equal(saved.proposal.facts.bedrooms, 2);
    await assertOriginal();
  });
  await step('Reload and resume preserves exact saved language, facts, cover and gallery order', cp, async () => {
    await cp.goto('/property/content');
    await cp.getByRole('button', { name: `Open proposal: ${originalName}`, exact: true }).click();
    assert.equal(await cp.getByLabel('Unit name / number', { exact: true }).inputValue(), proposedName);
    assert.equal(await cp.getByLabel('Floor', { exact: true }).inputValue(), '4');
    assert.equal(await cp.getByLabel('Description language', { exact: true }).inputValue(), 'ru');
    assert.equal(await cp.getByLabel('Description text', { exact: true }).inputValue(), firstRussian);
    assert.equal(await cp.getByRole('button', { name: 'Set as cover 1', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await cp.getByRole('group', { name: 'Proposed gallery', exact: true }).locator('img').evaluateAll(images => images.map(image => image.getAttribute('src'))), [mediaPaths[1], mediaPaths[0], mediaPaths[2]]);
    await assertOriginal();
  });
  await step('Direct requests cannot edit another unit, shared project content, pricing, publication or operations', cp, async () => {
    for (const [scope, id] of [['unit', siblingId], ['unit', fixture.unitId], ['project', projectId]]) {
      assert.equal((await cp.request.get(`${API}/target?scope=${scope}&id=${encodeURIComponent(id)}`, { maxRedirects: 0 })).status(), 403);
    }
    assert.equal((await cp.request.post(API, { maxRedirects: 0, data: { scope: 'unit', targetId: siblingId, baselineVersion: saved.baselineVersion, proposal: saved.proposal, status: 'draft' } })).status(), 403);
    assert.equal((await cp.request.put(`/api/admin/units/${unitId}`, { maxRedirects: 0, data: { name: 'Forbidden direct mutation', baseNightlyThb: 1, status: 'live' } })).status(), 403);
    assert.equal((await cp.request.get(`/api/admin/units/${unitId}`, { maxRedirects: 0 })).status(), 403);
    assert.equal((await cp.request.patch(`${API}/${proposalId}`, { maxRedirects: 0, data: { expectedRevision: saved.revision, status: 'draft', proposal: { ...saved.proposal, facts: { ...saved.proposal.facts, baseNightlyThb: 1 } } } })).status(), 400);
    assert.equal((await cp.request.post(`/api/admin/property-content-proposals/${proposalId}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: saved.revision } })).status(), 403);
    await assertOriginal();
  });
  await step('Submit locks the proposal while canonical data remains unchanged', cp, async () => {
    submitted = await save(cp, 'submitted');
    assert.equal(await cp.getByLabel('Unit name / number', { exact: true }).isDisabled(), true);
    assert.equal((await cp.request.patch(`${API}/${proposalId}`, { maxRedirects: 0, data: { expectedRevision: submitted.revision, proposal: submitted.proposal, status: 'draft' } })).status(), 409);
    const row = await db.crmOpportunity.findUniqueOrThrow({ where: { id: proposalId } });
    assert.equal(row.identityId, contributorId); assert.equal(row.requirements.status, 'submitted');
    await assertOriginal();
  });
  await step('Founder compares actual facts, language and gallery, then returns a review note', rp, async () => {
    await login(rp, fixture.founderEmail, '/app/admin/property-content-proposals');
    const card = await openReview(rp);
    await card.getByText(originalRussian, { exact: true }).waitFor();
    await card.getByText(firstRussian, { exact: true }).waitFor();
    await card.getByText('RU', { exact: true }).waitFor();
    await card.getByRole('heading', { name: 'Gallery and cover order', exact: true }).waitFor();
    assert.equal(await card.locator('img').count(), 6);
    await compareReview(card, '4');
    await card.getByLabel('Review note (required when returning)', { exact: true }).fill(reviewNote);
    returned = await review(rp, 'return');
    assert.equal(returned.status, 'returned'); assert.equal(returned.reviewNote, reviewNote);
    await assertOriginal();
  });
  await step('Contributor reads feedback, corrects the draft and resubmits through the UI', cp, async () => {
    await cp.goto('/property/content');
    await cp.getByRole('button', { name: `Open proposal: ${originalName}`, exact: true }).click();
    await cp.getByText(reviewNote, { exact: true }).waitFor();
    assert.equal(await cp.getByLabel('Unit name / number', { exact: true }).isEnabled(), true);
    await cp.getByLabel('Floor', { exact: true }).fill('5');
    await cp.getByLabel('Description text', { exact: true }).fill(finalRussian);
    submitted = await save(cp, 'submitted');
    assert.equal(submitted.proposal.facts.floor, '5'); assert.equal(submitted.proposal.description.value, finalRussian);
    await assertOriginal();
  });
  await step('Founder confirms comparison and applies the corrected content exactly once', rp, async () => {
    const card = await openReview(rp);
    await card.getByText(finalRussian, { exact: true }).waitFor();
    await card.getByText(originalRussian, { exact: true }).waitFor();
    await compareReview(card, '5');
    assert.equal(await card.getByRole('button', { name: 'Approve and apply content', exact: true }).isDisabled(), true);
    await card.getByRole('checkbox', { name: 'I checked the facts, description and each photo for this exact property and approve applying these changes.', exact: true }).check();
    approved = await review(rp, 'approve'); assert.equal(approved.status, 'approved');
    const after = await canonical();
    assert.deepEqual(Object.fromEntries(Object.keys(submitted.proposal.facts).map(key => [key, key === 'grossAreaSqm' && after.unit[key] !== null ? Number(after.unit[key]) : after.unit[key]])), submitted.proposal.facts);
    assert.deepEqual(protectedUnit(after.unit), protectedUnit(original.unit), 'Ownership, money, booking flags and publication remain unchanged');
    assert.equal(Number(after.unit.grossAreaSqm), 53.25); assert.equal(after.unit.sizeSqm, 40, 'Legacy fallback area is unchanged');
    assert.equal(after.unit.marketingTitleKey, original.title.key, 'Approval pins the original title name without copying or changing titles');
    assert.equal(after.title.key, original.title.key);
    assert.notEqual(after.title.key, after.unit.descriptionKey.replace(/\.description$/, '.title'));
    assert.deepEqual(after.title, original.title, 'The original title row and translations remain exactly unchanged');
    const titleValues = title => title.translations.map(({ locale, value, status, updatedByIdentityId, createdAt, updatedAt }) => ({ locale, value, status, updatedByIdentityId, createdAt, updatedAt }));
    assert.deepEqual(titleValues(after.title), titleValues(original.title), 'Original localized marketing title remains reachable after description copy-on-write');
    const originalTitle = await db.contentKey.findUniqueOrThrow({ where: { key: original.title.key }, include: { translations: { orderBy: { locale: 'asc' } } } });
    assert.deepEqual(titleValues(clone(originalTitle)), titleValues(original.title));
    assert.equal(after.unit.status, 'draft'); assert.equal(after.unit.ownerIdentityId, null);
    assert.equal(after.unit.baseNightlyThb, 222222); assert.equal(after.unit.minNights, 2); assert.equal(after.unit.instantBook, false);
    assert.equal(after.unit.coverMediaId, mediaIds[1]);
    assert.deepEqual(after.gallery.map(link => ({ mediaId: link.mediaId, sort: link.sort })), [mediaIds[1], mediaIds[0], mediaIds[2]].map((mediaId, sort) => ({ mediaId, sort })));
    assert.equal(after.content.namespace, 'unit');
    assert.equal(after.content.translations.length, 2);
    assert.equal(after.content.translations.find(row => row.locale === 'ru').value, finalRussian);
    assert.equal(after.content.translations.find(row => row.locale === 'ru').status, 'needs_review');
    const originalEnglish = original.content.translations.find(row => row.locale === 'en');
    const copiedEnglish = after.content.translations.find(row => row.locale === 'en');
    for (const key of ['value', 'status', 'updatedByIdentityId', 'createdAt', 'updatedAt']) assert.equal(copiedEnglish[key], originalEnglish[key]);
    assert.notEqual(after.content.key, original.content.key, 'Description change must be copy-on-write');
    const originalKey = await db.contentKey.findUniqueOrThrow({ where: { id: original.content.id }, include: { translations: { orderBy: { locale: 'asc' } } } });
    assert.deepEqual(clone(originalKey), original.content, 'Original description key and translations remain intact');
    assert.equal(await db.unitEngagement.count({ where: { unitId } }), 0);
    assert.equal(await db.projectStaffPermission.count({ where: { identityId: contributorId } }), 0);
    assert.deepEqual((await db.roleAssignment.findMany({ where: { identityId: contributorId } })).map(row => row.role), ['content_contributor']);
    const retry = await json(await rp.request.post(`/api/admin/property-content-proposals/${proposalId}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: submitted.revision } }));
    assert.equal(retry.alreadyApproved, true); assert.deepEqual(await canonical(), after);
  });
  await step('Stale revisions and revoked assignments fail closed without any canonical mutation', cp, async () => {
    const current = await json(await cp.request.get(`${API}/target?scope=unit&id=${unitId}`, { maxRedirects: 0 }));
    const payload = { facts: current.snapshot.facts, description: null, gallery: { mediaIds: current.snapshot.gallery.mediaIds, coverMediaId: current.snapshot.gallery.coverMediaId } };
    assert.equal((await cp.request.post(API, { maxRedirects: 0, data: { scope: 'unit', targetId: unitId, baselineVersion: '0'.repeat(64), proposal: payload, status: 'draft' } })).status(), 409);
    const draft = await json(await cp.request.post(API, { maxRedirects: 0, data: { scope: 'unit', targetId: unitId, baselineVersion: current.baselineVersion, proposal: payload, status: 'draft' } }), 201);
    assert.equal((await cp.request.patch(`${API}/${draft.id}`, { maxRedirects: 0, data: { expectedRevision: draft.revision + 1, proposal: payload, status: 'draft' } })).status(), 409);
    const pending = await json(await cp.request.patch(`${API}/${draft.id}`, { maxRedirects: 0, data: { expectedRevision: draft.revision, proposal: payload, status: 'submitted' } }));
    const beforeRevokedAttempt = await canonical();
    await db.roleAssignment.update({ where: { id: roleId }, data: { status: 'revoked' } });
    assert.equal((await cp.request.get(`${API}/target?scope=unit&id=${unitId}`, { maxRedirects: 0 })).status(), 403);
    assert.equal((await cp.request.get(`${API}/${proposalId}`, { maxRedirects: 0 })).status(), 403);
    assert.equal((await cp.request.post(API, { maxRedirects: 0, data: { scope: 'unit', targetId: unitId, baselineVersion: current.baselineVersion, proposal: payload, status: 'draft' } })).status(), 403);
    assert.equal((await rp.request.post(`/api/admin/property-content-proposals/${draft.id}/review`, { maxRedirects: 0, data: { action: 'approve', expectedRevision: pending.revision } })).status(), 403);
    const hidden = await json(await cp.request.get(API, { maxRedirects: 0 }));
    assert.deepEqual(hidden.targets, []); assert.deepEqual(hidden.items, []);
    await cp.goto('/property/content');
    await cp.getByText('No properties are currently assigned to you. Ask an administrator for a content assignment.', { exact: true }).waitFor();
    assert.deepEqual(await canonical(), beforeRevokedAttempt);
    assert.deepEqual(await protectedPeople(), originalProtectedPeople, 'Existing founder and guest rows are preserved');
    assert.deepEqual(clone(await db.project.findUniqueOrThrow({ where: { id: projectId } })), originalProject, 'A unit proposal must not change the complex or its publication state');
    assert.deepEqual(await otherUnits(), originalOtherUnits, 'Unassigned sibling and pre-existing fixture inventory remain untouched');
    assert.deepEqual(clone(await db.mediaAsset.findMany({ where: { id: { in: mediaIds } }, orderBy: { id: 'asc' } })), originalMedia, 'Existing media metadata and uploader ownership are preserved');
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []); assert.deepEqual(report.blockedBrowserOrigins, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = String(error); console.error(error); process.exitCode = 1; }
finally {
  for (const { ctx, name } of contexts) { await ctx.tracing.stop({ path: `browser-results/trace-${name}.zip` }).catch(() => {}); await ctx.close().catch(() => {}); }
  if (browser) await browser.close(); await db.$disconnect();
  await persist();
}
