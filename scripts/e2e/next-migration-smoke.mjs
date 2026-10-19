import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrl } = require('./isolation.cjs').assertIsolation();
const { chromium } = require('playwright');
const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
const report = { headCommit: process.env.BROWSER_HEAD_SHA, synthetic: true, steps: [], pageErrors: [], result: 'running' };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const [locale, title] of [['en', 'Welcome back'], ['ru', 'С возвращением'], ['th', 'ยินดีต้อนรับกลับ']]) {
    const ctx = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addCookies([{ name: 'locale', value: locale, url: baseUrl }]);
    await ctx.route('**/*', route => {
      const url = new URL(route.request().url());
      return !['http:', 'https:'].includes(url.protocol) || url.origin === baseUrl ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await ctx.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    await page.goto('/login?next=%2Fapp%2Fadmin');
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal((await ctx.cookies()).find(cookie => cookie.name === 'locale')?.value, locale);
    await page.goto('/app/admin'); await page.waitForURL(url => url.pathname === '/login');
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.goto('/projects/synthetic-browser-estate');
    await page.locator('h1').waitFor(); assert.match(await page.locator('h1').innerText(), /Synthetic Browser Estate/);
    const query = new URLSearchParams({ startDate: fixture.startDate, endDate: fixture.endDate, adults: '1' });
    await page.goto(`/units/${fixture.unitId}?${query}`);
    await page.getByRole('heading', { name: fixture.unitName, exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('startDate'), fixture.startDate);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: `browser-results/next-migration-${locale}.png`, fullPage: true });
    const image = await page.request.get('/_next/image?url=%2Fbrowser-acceptance%2Funit-0.png&w=640&q=75');
    assert.equal(image.status(), 200); assert.match(image.headers()['content-type'], /^image\//);
    report.steps.push({ locale, result: 'passed', scenario: 'locale cookie → localized login → protected admin redirect → project/unit async params → dates → next/image' });
    await ctx.close();
  }
  assert.deepEqual(report.pageErrors, []); report.result = 'passed';
  console.log('PASS Next migration: EN/RU/TH, auth redirects, public dynamic routes and optimized images');
} catch (error) { report.result = 'failed'; report.error = String(error); process.exitCode = 1; console.error(error); }
finally { await writeFile('browser-results/next-migration-result.json', JSON.stringify(report, null, 2)); await browser?.close(); }
