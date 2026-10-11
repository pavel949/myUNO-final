import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const ctx = JSON.parse(readFileSync(new URL('./ctx.json', import.meta.url)));
const BASE = 'http://127.0.0.1:3100';
const SHOTS = '/home/user/myUNO-final/docs/delivery/claude-expense-owner-report/screenshots';
const sql = (q) => execSync(`psql postgresql://test@127.0.0.1:55432/myuno_e2e -Atc "${q}"`).toString().trim();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const PNG = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(200, 7)]);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
async function session(role, locale = 'en', viewport = { width: 1280, height: 900 }) {
  const c = await browser.newContext({ viewport });
  await c.addCookies([
    { name: 'auth-session', value: ctx.tokens[role], url: BASE },
    { name: 'locale', value: locale, url: BASE },
  ]);
  return c;
}
try {
  // ---- staff: record cost (network drop → retry), attach receipt ----
  const staffCtx = await session('staff');
  const page = await staffCtx.newPage();
  await page.goto(`${BASE}/ops/costs`);
  await page.getByLabel('Amount (THB)').waitFor(); await page.waitForLoadState('networkidle');
  await page.getByLabel('Date incurred').fill('2026-07-20');
  await page.getByLabel('Amount (THB)').fill('1250.50');
  await page.getByLabel('What it was for').fill('Deep clean after checkout');
  await page.getByLabel('Receipt (optional)').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  let dropped = 0;
  await page.route('**/api/ledger/record-cost', (route) => { dropped += 1; return route.abort(); });
  await page.getByRole('button', { name: 'Record cost' }).click();
  await page.locator('span[role="alert"]').waitFor();
  check('network drop: error shown, fields kept', (await page.locator('span[role="alert"]').innerText()).includes('No connection') && (await page.getByLabel('Amount (THB)').inputValue()) === '1250.50');
  check('network drop: nothing written', sql("select count(*) from ledger_entry where entry_type='cleaning_cost'") === '0');
  await page.unroute('**/api/ledger/record-cost');
  await page.getByRole('button', { name: 'Record cost' }).click();
  await page.getByRole('link', { name: 'View receipt' }).first().waitFor({ timeout: 15000 });
  check('retry: exactly one cost recorded', sql("select count(*) from ledger_entry where entry_type='cleaning_cost'") === '1');
  check('retry: stored negative satang on business date', sql("select amount_thb||' '||to_char(occurred_on,'YYYY-MM-DD') from ledger_entry where entry_type='cleaning_cost'") === '-125050 2026-07-20');
  check('receipt stored encrypted, one current', sql("select count(*) from expense_receipt where superseded_at is null and ciphertext not like '%iVBOR%'") === '1');
  await page.screenshot({ path: `${SHOTS}/01-staff-cost-recorded-desktop.png`, fullPage: true });
  // second cost by keyboard only
  await page.getByLabel('Amount (THB)').fill('500');
  await page.getByLabel('What it was for').fill('Pool chemicals');
  await page.getByLabel('Date incurred').fill('2026-07-25');
  await page.getByLabel('What it was for').press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Pool chemicals'));
  check('keyboard Enter submits', sql("select count(*) from ledger_entry where entry_type='cleaning_cost'") === '2');
  const status = await page.locator('span[role="status"]').first().innerText();
  check('success text comes from server impact, no promise of a specific report', /counted when the owner report/.test(status), status);

  // ---- admin: generate + operator sign-off ----
  const adminCtx = await session('admin');
  const gen = await adminCtx.request.post(`${BASE}/api/admin/statements/generate`, { data: { unitId: ctx.unitId, periodStart: '2026-07-01', periodEnd: '2026-07-31' } });
  const genBody = await gen.json();
  check('admin generates July report', gen.status() === 200 && genBody.statement.operatingExpensesAmountThb === 175050, JSON.stringify(genBody.statement?.operatingExpensesAmountThb));
  const sid = genBody.statement.id;
  const draftOwner = await (await session('owner')).newPage();
  await draftOwner.goto(`${BASE}/owner/statements/${sid}`);
  const draftText = await draftOwner.innerText('body');
  check('draft report is not visible to owner (not-found page, no figures)', /not be found|404/i.test(draftText) && !draftText.includes('Villa E2E') && !draftText.includes('Gross bookings'));
  const op = await adminCtx.request.put(`${BASE}/api/admin/statements/${sid}/sign-off`, { data: { actor: 'operator' } });
  check('operator signs → pending owner review', (await op.json()).statement?.status === 'pending_owner_review');

  // ---- owner: view report, receipt, sign ----
  const ownerCtx = await session('owner');
  const ow = await ownerCtx.newPage();
  await ow.goto(`${BASE}/owner/statements/${sid}`);
  const link = ow.getByRole('link', { name: 'View receipt' }).first();
  for (const b of await ow.getByRole('button', { name: /Show source lines/ }).all()) { await b.click(); if (await link.isVisible().catch(() => false)) break; }
  await link.waitFor({ timeout: 15000 });
  const href = await link.getAttribute('href');
  const dl = await ownerCtx.request.get(`${BASE}${href}`);
  check('owner downloads receipt through checked route', dl.status() === 200 && dl.headers()['content-type'] === 'image/png' && /attachment/.test(dl.headers()['content-disposition']) && /no-store/.test(dl.headers()['cache-control']) && (await dl.body()).equals(PNG));
  check('receipt link is not a storage URL', href.startsWith('/api/ledger/receipts/'));
  await ow.screenshot({ path: `${SHOTS}/02-owner-statement-receipt-desktop.png`, fullPage: true });
  const otherCtx = await session('other');
  const foreign = await otherCtx.request.get(`${BASE}${href}`);
  check('another owner gets 404 for the receipt', foreign.status() === 404);
  const anon = await (await browser.newContext()).request.get(`${BASE}${href}`);
  check('anonymous gets 401', anon.status() === 401);
  const fp = await otherCtx.newPage(); await fp.goto(`${BASE}/owner/statements/${sid}`);
  const ft = await fp.innerText('body');
  check('another owner cannot open the report', /not be found|404/i.test(ft) && !ft.includes('Gross bookings'));
  await ow.getByRole('button', { name: 'Sign off this statement' }).click();
  await ow.waitForFunction(() => /signed|approved|Подписан|Approved/i.test(document.body.innerText), null, { timeout: 15000 });
  check('owner signs → signed_off', sql(`select status from owner_statement where id='${sid}'`) === 'signed_off');

  // ---- locales + mobile ----
  for (const [loc, text] of [['ru', 'Чек (необязательно)'], ['th', 'ใบเสร็จ (ไม่บังคับ)']]) {
    const p = await (await session('staff', loc)).newPage();
    await p.goto(`${BASE}/ops/costs`);
    await p.getByText(text).first().waitFor({ timeout: 15000 }).then(() => check(`${loc.toUpperCase()} receipt label rendered`, true), () => check(`${loc.toUpperCase()} receipt label rendered`, false));
    await p.screenshot({ path: `${SHOTS}/03-staff-${loc}-desktop.png` });
  }
  const mob = await (await session('staff', 'en', { width: 390, height: 844 })).newPage();
  await mob.goto(`${BASE}/ops/costs`);
  await mob.getByLabel('Amount (THB)').waitFor();
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('mobile 390px: no horizontal page scroll', !overflow);
  await mob.screenshot({ path: `${SHOTS}/04-staff-mobile.png`, fullPage: true });
} catch (e) { check('E2E script completed', false, String(e).slice(0, 300)); }
await browser.close();
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 1));
process.exit(results.every((r) => r.ok) ? 0 : 1);
