import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const out = 'browser-results/property-editing';
await mkdir(out, { recursive: true });
const report = {
  headCommit: process.env.BROWSER_HEAD_SHA,
  synthetic: true,
  mode: process.env.PROPERTY_EDITING_SERVER_MODE || 'production',
  steps: [],
  pageErrors: [],
};
const original = await db.unit.findUniqueOrThrow({ where: { id: fixture.unitId } });
const originalProject = await db.project.findUniqueOrThrow({ where: { id: fixture.projectId } });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  baseURL: baseUrl,
  viewport: { width: 1440, height: 1000 },
});
await context.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  return !['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl
    ? route.continue()
    : route.abort('blockedbyclient');
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on('pageerror', (error) => report.pageErrors.push(String(error)));
const path = `/api/admin/units/${original.id}`;
const edit = `/ops/units/${original.id}/edit`;
let addedRoom;
const addedPhotos = [];
const text = () => page.locator('body').innerText();
async function step(name, fn) {
  const entry = { name };
  report.steps.push(entry);
  try {
    await fn();
    entry.result = 'passed';
    await page.screenshot({ path: `${out}/${report.steps.length}.png`, fullPage: true });
    console.log('PASS ' + name);
  } catch (error) {
    entry.result = 'failed';
    entry.error = String(error);
    throw error;
  } finally {
    await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2));
  }
}
async function save(form, endpoint, method) {
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === endpoint && r.request().method() === method
  );
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200, await result.text());
  await form.getByRole('status').filter({ hasText: 'Changes saved.' }).waitFor();
}
try {
  await step('Admin authenticates through login form', async () => {
    await page.goto('/login');
    await page.getByLabel(/^Email\s*\*?$/).fill(fixture.founderEmail);
    await page.getByLabel(/^Password\s*\*?$/).fill(fixture.password);
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'
    );
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
    assert.equal((await response).status(), 200);
  });
  await step(
    'Project facts save without a facilities-array write; reload reads canonical name',
    async () => {
      await page.goto(`/ops/projects/${original.projectId}/edit`);
      const form = page.locator('form').first();
      await form.locator('[name=name]').fill('Synthetic Edited Complex');
      await save(form, `/api/ops/projects/${original.projectId}/facts`, 'PATCH');
      await page.reload();
      assert.equal(
        await page.locator('form').first().locator('[name=name]').inputValue(),
        'Synthetic Edited Complex'
      );
    }
  );
  await step(
    'Physical facts and distinct area values save, reload and render publicly',
    async () => {
      await page.goto(edit);
      const form = page.locator('form').first();
      for (const [name, value] of Object.entries({
        name: 'Synthetic Edited Villa',
        bedrooms: '1',
        bathrooms: '2',
        maxGuests: '2',
        floor: '4',
        sizeSqm: '90',
        grossAreaSqm: '120.25',
        usableAreaSqm: '80.5',
      }))
        await form.locator(`[name=${name}]`).fill(value);
      await save(form, path, 'PUT');
      await page.reload();
      assert.equal(await page.locator('[name=grossAreaSqm]').inputValue(), '120.25');
      assert.equal(await page.locator('[name=usableAreaSqm]').inputValue(), '80.5');
      const publish = await page.request.put(path, { data: { status: 'live' } });
      assert.equal(publish.status(), 200, await publish.text());
      await page.goto('/units/' + original.id);
      await page.getByRole('heading', { name: 'Synthetic Edited Villa', exact: true }).waitFor();
      await page.getByText('120.25 sqm', { exact: true }).waitFor();
      const publicData = await (await page.request.get('/api/units/' + original.id)).json();
      assert.equal(Number(publicData.usableAreaSqm), 80.5);
      assert.equal(publicData.sizeSqm, 90);
    }
  );
  await step('Invalid API facts fail without changing the public record', async () => {
    for (const body of [{ name: '' }, { bedrooms: -1 }, { maxGuests: 0 }, { grossAreaSqm: -1 }])
      assert.equal((await page.request.put(path, { data: body })).status(), 400);
    assert.equal(
      (await (await page.request.get('/api/units/' + original.id)).json()).name,
      'Synthetic Edited Villa'
    );
  });
  await step(
    'Two editors cannot silently overwrite; stale input survives with reload action',
    async () => {
      const second = await context.newPage();
      try {
        await page.goto(edit);
        await second.goto(edit);
        await page.locator('[name=floor]').fill('5');
        await save(page.locator('form').first(), path, 'PUT');
        await second.locator('form').first().locator('[name=name]').fill('Stale edit retained');
        const response = second.waitForResponse(
          (r) => new URL(r.url()).pathname === path && r.request().method() === 'PUT'
        );
        await second
          .locator('form')
          .first()
          .getByRole('button', { name: 'Save changes', exact: true })
          .click();
        assert.equal((await response).status(), 409);
        await second.getByText(/This property changed elsewhere/).waitFor();
        assert.equal(
          await second.locator('form').first().locator('[name=name]').inputValue(),
          'Stale edit retained'
        );
        assert.equal(
          (await db.unit.findUniqueOrThrow({ where: { id: original.id } })).name,
          'Synthetic Edited Villa'
        );
      } finally {
        await second.close();
      }
    }
  );
  await step('Unsaved back navigation can be cancelled', async () => {
    await page.goto(edit);
    await page.locator('form').first().locator('[name=name]').fill('Unsaved stays here');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('link', { name: '← Back', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, edit);
    assert.equal(
      await page.locator('form').first().locator('[name=name]').inputValue(),
      'Unsaved stays here'
    );
    if (await page.evaluate(() => Boolean(window.navigation))) {
      const dialog = page.waitForEvent('dialog');
      await page.evaluate(() => history.back());
      await (await dialog).dismiss();
      await page.waitForTimeout(200);
      assert.equal(new URL(page.url()).pathname, edit);
    }
    page.once('dialog', (d) => d.accept());
    await page.getByRole('link', { name: '← Back', exact: true }).click();
    await page.waitForURL((url) => url.pathname !== edit);
  });
  await step(
    'Admin adds, edits and deletes verified sleeping facts; staff remains forbidden',
    async () => {
      await page.goto(edit);
      await page.getByRole('button', { name: 'Add sleeping space', exact: true }).click();
      const form = page.locator('form').last();
      await form.locator('[name=name]').fill('Synthetic documentary room');
      await form.locator('[name=single]').fill('2');
      const response = page.waitForResponse(
        (r) => r.url().endsWith('/property-details') && r.request().method() === 'POST'
      );
      await form.getByRole('button', { name: 'Save changes', exact: true }).click();
      const created = await response;
      assert.equal(created.status(), 201);
      addedRoom = await created.json();
      await page.reload();
      const savedForm = page
        .locator('form')
        .filter({ has: page.locator('input[name=name][value="Synthetic documentary room"]') });
      await savedForm.locator('[name=single]').fill('1');
      await save(savedForm, path + '/property-details', 'POST');
      await page.goto('/units/' + original.id);
      await page.getByText('1 × Single bed', { exact: true }).waitFor();
      const staff = await browser.newContext({ baseURL: baseUrl });
      await staff.request.post('/api/auth/login', {
        data: { email: fixture.staffEmail, password: fixture.password },
      });
      assert.equal(
        (
          await staff.request.post(path + '/property-details', {
            data: {
              action: 'delete_sleeping_space',
              spaceId: addedRoom.id,
              expectedUpdatedAt: addedRoom.updatedAt,
            },
          })
        ).status(),
        403
      );
      await staff.close();
      await page.goto(edit);
      const row = page
        .locator('form')
        .filter({ has: page.locator('input[name=name][value="Synthetic documentary room"]') });
      const deletion = page.waitForResponse(
        (r) => r.url().endsWith('/property-details') && r.request().method() === 'POST'
      );
      page.once('dialog', (d) => d.accept());
      await row.getByRole('button', { name: 'Remove', exact: true }).click();
      assert.equal((await deletion).status(), 200);
      assert.equal(await db.sleepingSpace.count({ where: { id: addedRoom.id } }), 0);
      addedRoom = null;
    }
  );
  await step(
    report.mode === 'production'
      ? 'Missing production storage fails closed and refreshes the gallery'
      : 'Repeated identical PNG uploads, cover, reorder and delete read back publicly',
    async () => {
      await page.goto(edit);
      const before = await (await page.request.get(path + '/media')).json();
      await page.waitForFunction(
        (count) => document.querySelectorAll('img[alt^="Property photo"]').length === count,
        before.media.length
      );
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
        'base64'
      );
      if (report.mode === 'production') {
        // Durable storage is intentionally unavailable in isolated production acceptance.
        const response = page.waitForResponse((r) => r.url().endsWith('/api/media/upload'));
        await page
          .locator('input[type=file]')
          .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
        assert.equal((await response).status(), 500);
        await page.getByRole('alert').waitFor();
        return;
      }
      await page.locator('input[type=file]').setInputFiles([
        { name: 'one.png', mimeType: 'image/png', buffer: png },
        { name: 'two.png', mimeType: 'image/png', buffer: png },
      ]);
      await page.waitForFunction(
        (count) => document.querySelectorAll('img[alt^="Property photo"]').length === count,
        before.media.length + 2
      );
      let state = await (await page.request.get(path + '/media')).json();
      addedPhotos.push(
        ...state.media
          .filter((p) => !before.media.some((b) => b.mediaId === p.mediaId))
          .map((p) => p.mediaId)
      );
      const patch = page.waitForResponse(
        (r) => new URL(r.url()).pathname === path + '/media' && r.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Make cover', exact: true }).last().click();
      assert.equal((await patch).status(), 200);
      await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled);
      state = await (await page.request.get(path + '/media')).json();
      assert.equal(state.coverMediaId, addedPhotos[1]);
      const publicData = await (await page.request.get('/api/units/' + original.id)).json();
      assert.equal(
        publicData.images[0],
        state.media.find((p) => p.mediaId === state.coverMediaId).media.storageKey
      );
      const reorder = page.waitForResponse(
        (r) => new URL(r.url()).pathname === path + '/media' && r.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Move photo left', exact: true }).last().click();
      assert.equal((await reorder).status(), 200);
      await page.reload();
      await page.getByRole('button', { name: 'Cover', exact: true }).waitFor();
      const removal = page.waitForResponse(
        (r) => new URL(r.url()).pathname === path + '/media' && r.request().method() === 'DELETE'
      );
      await page
        .locator('div.overflow-hidden.rounded-md.border')
        .filter({ has: page.getByRole('button', { name: 'Cover', exact: true }) })
        .getByRole('button', { name: 'Remove', exact: true })
        .click();
      assert.equal((await removal).status(), 200);
    }
  );
  await step('Desktop and mobile controls and public rendering fit viewport', async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(edit);
      await page.locator('[name=grossAreaSqm]').waitFor();
      await page.waitForFunction(
        () => document.querySelectorAll('img[alt^="Property photo"]').length >= 3
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
      await page.screenshot({ path: `${out}/editor-${width}.png`, fullPage: true });
      await page.goto('/units/' + original.id);
      await page.getByText('120.25 sqm', { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
      await page.screenshot({ path: `${out}/public-${width}.png`, fullPage: true });
    }
  });
  await step('Russian editor labels follow locale', async () => {
    await context.addCookies([{ name: 'locale', value: 'ru', url: baseUrl }]);
    await page.goto(edit);
    await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).first().waitFor();
    assert.equal(await page.getByLabel('Общая площадь, м² (в карточке)').inputValue(), '120.25');
  });
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = String(error);
  process.exitCode = 1;
  console.error(error);
  await page.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
} finally {
  // Restore only this guarded synthetic fixture. Never run against hosted DBs.
  await db.unit.update({
    where: { id: original.id },
    data: {
      name: original.name,
      bedrooms: original.bedrooms,
      bathrooms: original.bathrooms,
      maxGuests: original.maxGuests,
      floor: original.floor,
      sizeSqm: original.sizeSqm,
      grossAreaSqm: original.grossAreaSqm,
      usableAreaSqm: original.usableAreaSqm,
      outdoorAreaSqm: original.outdoorAreaSqm,
      plotAreaSqm: original.plotAreaSqm,
      status: original.status,
      coverMediaId: original.coverMediaId,
    },
  });
  await db.project.update({
    where: { id: originalProject.id },
    data: { name: originalProject.name },
  });
  if (addedRoom)
    await db.sleepingSpace.deleteMany({ where: { id: addedRoom.id, unitId: original.id } });
  await db.unitMedia.deleteMany({ where: { unitId: original.id, mediaId: { in: addedPhotos } } });
  await writeFile(`${out}/result.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.$disconnect();
}
