import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The stay transitions must be the ones the application actually runs.
 *
 * They were not. `confirmBooking`, `checkInBooking`, `checkOutBooking`,
 * `completeBooking`, `markNoShow` and `changeBookingDates` were defined in the
 * booking module and covered by tests, and **no route called any of them** —
 * the routes repeated each transition inline with `prisma.booking.update`. So
 * there were two implementations of every transition and only one was tested:
 * the one nobody ran. The tests were green and told you nothing about
 * production.
 *
 * These are structural tests. They read the source rather than exercise it,
 * because the property they protect is "the route delegates" — which no
 * behavioural test can see, since both implementations produce the same status.
 */

const API_ROOT = join(process.cwd(), 'src/app/api');

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...routeFiles(path));
    else if (entry === 'route.ts') found.push(path);
  }
  return found;
}

const routes = routeFiles(API_ROOT).map((path) => ({
  path: path.slice(path.indexOf('src/app/api')),
  source: readFileSync(path, 'utf8'),
}));

describe('the booking state machine is wired to the routes', () => {
  it('has routes that call the transitions rather than repeating them', () => {
    const wired = (fn: string) =>
      routes.filter((r) => new RegExp(`\\b${fn}\\s*\\(`).test(r.source)).map((r) => r.path);

    expect(wired('checkInBooking').length).toBeGreaterThan(0);
    expect(wired('checkOutBooking').length).toBeGreaterThan(0);
    expect(wired('changeBookingDates').length).toBeGreaterThan(0);
  });

  it('leaves no route setting a stay status by hand', () => {
    // A route writing `status: 'checked_in'` straight to the table is the
    // pattern this test exists to keep out: it bypasses the guards, skips the
    // analytics event, and drifts from the tested definition.
    const TRANSITION_STATUSES = ['checked_in', 'checked_out', 'completed', 'no_show'];

    const offenders = routes.filter((r) => {
      const updatesBooking = /\bbooking\.update(Many)?\(/.test(r.source);
      if (!updatesBooking) return false;
      return TRANSITION_STATUSES.some((s) => new RegExp(`status:\\s*'${s}'`).test(r.source));
    });

    expect(
      offenders.map((o) => o.path),
      'these routes set a stay status directly; call the booking module instead'
    ).toEqual([]);
  });

  it('keeps the date change out of the routes, so pricing stays server-computed', () => {
    // The modify route used to reprice as `nights × baseNightlyThb`, which
    // ignored seasonal rules, length-of-stay discounts and the cleaning fee —
    // it charged the wrong amount. computePriceBreakdown is the only authority
    // on what a stay costs, and changeBookingDates is what calls it.
    const modify = routes.find((r) => r.path.includes('modify/route.ts'));
    expect(modify, 'the modify route should exist').toBeTruthy();

    expect(modify!.source).toContain('changeBookingDates');
    expect(
      /baseNightlyThb\s*\|\|\s*0/.test(modify!.source),
      'the modify route must not compute a price itself'
    ).toBe(false);
  });
});
