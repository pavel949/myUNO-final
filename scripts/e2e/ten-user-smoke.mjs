import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('./isolation.cjs').assertIsolation();

export async function runTenUserSmoke({ db, fixture, founderPage, context, login, step, report, publicQuote, out }) {
  // Add only dedicated synthetic identities/assets after the core21 steps pass.
  // No application role grants, auth-cookie injection or direct booking writes.
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e/seed-ten-user-smoke.ts'], { env: process.env, stdio: 'pipe' });
  const extra = JSON.parse(await readFile(`${out}/ten-user-fixture.json`, 'utf8'));
  assert.equal(extra.synthetic, true); assert.equal(extra.guests.length, 8);
  const desktop = { width: 1440, height: 900 }; const mobile = { width: 390, height: 844 };
  const manager = await context('limited-manager', desktop); const mp = await manager.newPage();
  const managerUrl = `/ops/calendar/board?${new URLSearchParams({ mc: '1', projectId: fixture.projectId,
    organizationId: extra.organizationId, start: fixture.startDate, days: '7' })}`;
  const founderUrl = `/ops/calendar/board?${new URLSearchParams({ unitId: fixture.unitId, start: fixture.startDate, days: '7' })}`;
  const dates = new URLSearchParams({ startDate: fixture.startDate, endDate: fixture.endDate, adults: '2', children: '0' });
  const unitUrl = `/units/${fixture.unitId}?${dates}`;
  const guests = [];
  report.tenUsers = { synthetic: true, activeRoles: { founder: 1, limitedManager: 1, guests: 8 },
    viewports: { desktop, mobile }, layouts: [], responses: [], lifecycle: [] };

  async function layout(page, name, action) {
    if (action) await action.scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth }));
    assert.ok(geometry.documentWidth <= geometry.width + 1, `${name}: horizontal page overflow ${JSON.stringify(geometry)}`);
    if (action) {
      assert.equal(await action.isVisible(), true, `${name}: action must be visible`);
      const box = await action.boundingBox(); assert.ok(box);
      assert.ok(box.x >= -1 && box.x + box.width <= geometry.width + 1, `${name}: action must fit viewport width`);
      assert.ok(box.y >= -1 && box.y + box.height <= geometry.height + 1, `${name}: action must be in view`);
    }
    report.tenUsers.layouts.push({ name, ...geometry });
  }

  async function managerCalendar() {
    await mp.goto(managerUrl);
    const isMobile = (await mp.evaluate(() => innerWidth)) < 768;
    const surface = mp.getByRole('region', { name: isMobile ? 'Mobile occupancy agenda' : 'Unified occupancy grid', exact: true });
    await surface.waitFor();
    const ownCell = isMobile
      ? surface.getByRole('button').filter({ hasText: extra.managedUnitName })
      : surface.getByRole('button', { name: new RegExp(`${extra.managedUnitName} · ${fixture.startDate} ·`) });
    await ownCell.waitFor();
    for (const name of [extra.deniedUnitName, extra.foreignUnitName, fixture.tariffUnitName]) {
      assert.equal(await surface.getByText(name, { exact: true }).count(), 0, 'MC calendar must not leak unmandated units');
    }
  }

  await step('A real limited manager sees only their evidenced mandate on desktop and mobile', mp, async () => {
    await login(mp, extra.managerEmail, '/trips');
    const identity = await db.identity.findUniqueOrThrow({ where: { id: extra.managerId }, include: { roleAssignments: true } });
    assert.equal(identity.isAdmin, false);
    assert.equal(identity.roleAssignments.filter(role => role.status === 'active').length, 1);
    assert.equal(identity.roleAssignments[0].role, 'mc_member');
    assert.equal(identity.roleAssignments[0].organizationId, extra.organizationId);
    assert.equal((await mp.request.get(`/api/units/${extra.managedUnitId}/availability-blocks`)).status(), 200);
    for (const unitId of [extra.deniedUnitId, extra.foreignUnitId]) {
      assert.equal((await mp.request.get(`/api/units/${unitId}/availability-blocks`)).status(), 403);
      const response = await mp.goto(`/mc/units/${unitId}`);
      // Next streams the shared layout before notFound(), so transport can be
      // 200 while the actual protected page correctly renders only the404 UI.
      // Assert the denied surface and absence of private editor content directly.
      await mp.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
      assert.equal(await mp.locator('main').getByText('404', { exact: true }).count(), 1);
      assert.equal(await mp.getByRole('heading', { name: /Property Workspace/ }).count(), 0);
      assert.equal(await mp.locator('main input, main textarea, main select').count(), 0);
      for (const name of [extra.deniedUnitName, extra.foreignUnitName]) {
        assert.equal(await mp.locator('main').getByText(name, { exact: true }).count(), 0);
      }
      report.tenUsers.lifecycle.push({ role: 'denied-manager-page', unitId, transportStatus: response.status(), deniedUi: true });
    }
    await mp.goto('/app/admin/people'); await mp.waitForURL(url => url.pathname === '/');
    for (const viewport of [desktop, mobile]) {
      await mp.setViewportSize(viewport); await managerCalendar();
      await layout(mp, `limited-manager-${viewport.width}`);
      await mp.screenshot({ caret: 'initial', path: `${out}/limited-manager-${viewport.width}.png`, fullPage: true });
    }
    await mp.setViewportSize(desktop); await managerCalendar();
    report.tenUsers.managerScope = { ownUnit: extra.managedUnitId, deniedUnits: [extra.deniedUnitId, extra.foreignUnitId],
      nonAdmin: true, ownAvailabilityRead: 200, foreignAvailabilityRead: 403, foreignManagementPage: 'not-found UI; no private editor' };
  });

  await step('Eight independent guest forms contend while founder and limited manager read their calendars', founderPage, async () => {
    await founderPage.setViewportSize(desktop);
    assert.equal((await publicQuote(mp)).isAvailable, true);
    for (const [index, guest] of extra.guests.entries()) {
      const viewport = index % 2 ? mobile : desktop;
      const ctx = await context(`concurrent-guest-${index + 1}`, viewport);
      const page = await ctx.newPage(); guests.push({ ...guest, page, viewport });
    }
    await Promise.all(guests.map(async (guest, index) => {
      await login(guest.page, guest.email, '/trips');
      await guest.page.goto(unitUrl);
      const reserve = guest.page.getByRole('button', { name: 'Reserve', exact: true });
      const action = guest.viewport.width === mobile.width ? reserve.last() : reserve.first();
      await action.waitFor(); await layout(guest.page, `guest-${index + 1}-unit`, action);
      // The quote resolves asynchronously after the button becomes visible.
      // Wait for genuine actionability; never force-click a loading/disabled CTA.
      await action.click({ trial: true, timeout: 15_000 });
      assert.equal(await action.isEnabled(), true);
      await action.click(); await guest.page.waitForURL(url => url.pathname === '/book/review' && url.searchParams.has('bookingIntent'));
      await guest.page.getByText('Total', { exact: true }).waitFor();
      await guest.page.locator('main input[type=checkbox]').check();
      await guest.page.locator('select').filter({ hasText: 'Cash on arrival' }).selectOption('cash');
      const confirm = guest.page.getByRole('button', { name: 'Confirm booking', exact: true });
      await confirm.click({ trial: true, timeout: 15_000 });
      assert.equal(await confirm.isEnabled(), true); await layout(guest.page, `guest-${index + 1}-review`, confirm);
      guest.confirm = confirm;
      if (index < 2) await guest.page.screenshot({ caret: 'initial', path: `${out}/concurrent-review-${guest.viewport.width}.png`, fullPage: true });
    }));
    const originalCount = await db.booking.count({ where: { unitId: fixture.unitId } });
    const startedAt = Date.now();
    const observe = async (role, action) => {
      const started = Date.now(); await action();
      report.tenUsers.lifecycle.push({ role, startedMs: started - startedAt, finishedMs: Date.now() - startedAt });
    };
    await Promise.all([
      observe('founder', async () => {
        await founderPage.goto(founderUrl);
        await founderPage.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.startDate} ·`) }).waitFor();
      }),
      observe('limited-manager', managerCalendar),
      ...guests.map((guest, index) => observe(`guest-${index + 1}`, async () => {
        const pending = guest.page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
        pending.catch(() => {});
        await guest.confirm.click();
        const response = await pending; const result = await response.json();
        guest.status = response.status(); guest.result = result; guest.request = response.request().postDataJSON();
        report.tenUsers.responses.push({ guestIndex: index + 1, status: guest.status, code: result.code ?? null, bookingId: result.booking?.id ?? null });
        if (guest.status === 201) await guest.page.waitForURL(/\/trips(?:\/|$)/);
        else {
          assert.equal(guest.status, 409); assert.equal(result.code, 'DOUBLE_BOOK');
          const feedback = guest.page.locator('main .border-state-warning');
          await feedback.waitFor(); assert.ok((await feedback.innerText()).trim());
          assert.equal(await feedback.getByRole('link').isVisible(), true);
          await layout(guest.page, `guest-${index + 1}-conflict`);
        }
      })),
    ]);
    assert.equal(report.tenUsers.lifecycle.filter(entry => entry.role !== 'denied-manager-page').length, 10);
    const winners = guests.filter(guest => guest.status === 201); assert.equal(winners.length, 1);
    assert.equal(guests.filter(guest => guest.status === 409).length, 7);
    const winner = winners[0]; const id = winner.result.booking.id;
    const occupying = await db.booking.findMany({ where: { unitId: fixture.unitId,
      startDate: { lt: new Date(`${fixture.endDate}T00:00:00Z`) }, endDate: { gt: new Date(`${fixture.startDate}T00:00:00Z`) },
      status: { in: ['confirmed', 'checked_in', 'pending_payment'] } } });
    assert.equal(occupying.length, 1); assert.equal(occupying[0].id, id);
    assert.equal(occupying[0].guestIdentityId, winner.id); assert.equal(occupying[0].status, 'pending_payment');
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId } }), originalCount + 1);
    for (const model of [db.payment, db.ledgerEntry, db.depositPreauth]) assert.equal(await model.count({ where: { bookingId: id } }), 0);
    const replay = await winner.page.request.post('/api/bookings', { data: winner.request });
    assert.equal(replay.status(), 200); const replayed = await replay.json();
    assert.equal(replayed.replayed, true); assert.equal(replayed.booking.id, id);
    assert.equal(await db.booking.count({ where: { unitId: fixture.unitId } }), originalCount + 1);
    assert.equal(await db.payment.count({ where: { bookingId: id } }), 0);
    await founderPage.goto(founderUrl);
    const held = founderPage.getByRole('button', { name: new RegExp(`${fixture.unitName} · ${fixture.startDate} ·`) });
    await held.waitFor(); assert.match(await held.getAttribute('aria-label'), /Hold/);
    await layout(founderPage, 'founder-desktop-calendar');
    await founderPage.screenshot({ caret: 'initial', path: `${out}/concurrent-single-hold.png`, fullPage: true });
    const loser = guests.find(guest => guest.status === 409);
    await loser.page.screenshot({ caret: 'initial', path: `${out}/concurrent-conflict-feedback.png`, fullPage: true });
    report.tenUsers.winner = { bookingId: id, guestId: winner.id, replayedSameBooking: true, occupyingBookings: 1, newPayments: 0 };
  });

  await step('Other guests and the limited manager cannot read the winning guest booking', mp, async () => {
    const id = report.tenUsers.winner.bookingId;
    for (const guest of guests.filter(guest => guest.id !== report.tenUsers.winner.guestId)) {
      const denied = await guest.page.request.get(`/api/bookings/${id}`); assert.equal(denied.status(), 404);
      const body = await denied.json(); assert.equal(body.booking, undefined); assert.equal(body.unit, undefined);
    }
    assert.equal((await mp.request.get(`/api/bookings/${id}`)).status(), 404);
    const winner = guests.find(guest => guest.id === report.tenUsers.winner.guestId);
    assert.equal((await winner.page.request.get(`/api/bookings/${id}`)).status(), 200);
    await winner.page.goto(`/trips/${id}`); await winner.page.getByRole('button', { name: 'Cancel booking', exact: true }).waitFor();
    await layout(winner.page, 'winning-guest-trip');
    report.tenUsers.crossGuestDenied = 7; report.tenUsers.managerForeignBookingDenied = true;
    // The pending synthetic winner is intentionally left visible for evidence.
    // The entire disposable database disappears with this CI job.
    await managerCalendar();
  });
}
