import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const report = { headCommit: process.env.BROWSER_HEAD_SHA, synthetic: true, steps: [], pageErrors: [], workerResponses: [], result: 'running',
  limitation: 'Only raster tile bytes are synthetic. Application, search API, PostgreSQL, MapLibre, WebGL, worker, markers and popups are real. Live OSM coverage is not tested.' };
// Same valid local PNG as the existing isolated fixture. No external tile traffic.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ baseURL: baseUrl, viewport: { width, height: 900 }, serviceWorkers: 'block' });
    await ctx.addCookies([{ name: 'locale', value: 'en', url: baseUrl }]);
    await ctx.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://tile.openstreetmap.org' && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl) return route.continue();
      return route.abort('blockedbyclient');
    });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/maplibre/')) report.workerResponses.push(response.status()); });
    const start = new Date(`${fixture.startDate}T12:00:00Z`); start.setUTCDate(start.getUTCDate() + 14);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 3);
    const query = new URLSearchParams({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), adults: '1', projectId: fixture.projectId });
    await page.goto(`/search?${query}`);
    const card = page.locator(`#unit-card-${fixture.unitId}`); await card.waitFor();
    if (width < 1024) await page.getByRole('group', { name: 'Map', exact: true }).getByRole('button', { name: 'Map', exact: true }).click();
    const marker = page.locator('.maplibregl-marker').filter({ hasText: 'Synthetic Browser Estate' });
    await marker.waitFor(); await page.waitForTimeout(1000); // settle the debounced initial bounds navigation
    assert.equal(await page.locator('.maplibregl-canvas').count(), 1);
    await marker.click();
    if (width >= 1024) { await page.locator('.maplibregl-popup').waitFor(); assert.match(await page.locator('.maplibregl-popup').innerText(), /Synthetic Browser Estate/); }
    await card.waitFor({ state: 'visible' });
    assert.match(await card.getAttribute('class'), /border-brand-sun/);
    const link = card.getByRole('link').last(); const href = new URL(await link.getAttribute('href'), baseUrl);
    assert.equal(href.searchParams.get('startDate'), query.get('startDate'));
    await page.screenshot({ path: `browser-results/search-map-${width}.png`, fullPage: true });
    await link.click(); await page.waitForURL(url => url.pathname === `/units/${fixture.unitId}`);
    await page.getByRole('heading', { name: fixture.unitName, exact: true }).waitFor();
    report.steps.push({ width, result: 'passed', scenario: 'search API → real worker/WebGL → marker/popup → selected card → unit detail with dates' });
    await ctx.close();
  }
  assert.ok(report.workerResponses.some(status => status === 200), 'A real same-origin worker must load');
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed'; console.log('PASS Real MapLibre worker, search markers, popups and cards at desktop/mobile sizes');
} catch (error) { report.result = 'failed'; report.error = String(error); process.exitCode = 1; console.error(error); }
finally { await writeFile('browser-results/search-map-result.json', JSON.stringify(report, null, 2)); await browser?.close(); }
