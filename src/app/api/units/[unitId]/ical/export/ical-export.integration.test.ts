import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { GET } from './route';
import { icalFeedToken } from '@/modules/integrations/ical-token';

/**
 * P0-5. The feed used to be deliberately unauthenticated — the route said so in
 * a comment — and it published booking status, booking type, operators' free-text
 * notes on blocks, and every nightly pricing rule. A unit UUID was the only thing
 * standing between a competitor and a property's occupancy and rate card.
 *
 * It is fetched by OTAs on a schedule with no session, so the URL carries the
 * authority: a per-unit signed token, and a payload reduced to "which nights are
 * taken".
 */
describe('GET /api/units/[unitId]/ical/export — token-gated (P0-5)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function unitWithStay() {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-12-10'),
      endDate: new Date('2026-12-14'),
    });
    return { project, unit, guest, booking };
  }

  function request(unitId: string, token?: string) {
    const url = new URL(`http://localhost/api/units/${unitId}/ical/export`);
    if (token !== undefined) url.searchParams.set('token', token);
    return GET(new Request(url) as never, { params: { unitId } });
  }

  describe('access', () => {
    it('refuses a request with no token', async () => {
      const { unit } = await unitWithStay();

      const res = await request(unit.id);

      expect(res.status).toBe(404);
    });

    it('refuses a wrong token', async () => {
      const { unit } = await unitWithStay();

      const res = await request(unit.id, 'not-the-token');

      expect(res.status).toBe(404);
    });

    it("refuses another unit's token", async () => {
      const { unit, project } = await unitWithStay();
      const other = await createUnit({ projectId: project.id, name: 'OTHER', status: 'live' });

      // Tokens are bound to their unit, so holding one feed is not holding all.
      const res = await request(unit.id, icalFeedToken(other.id));

      expect(res.status).toBe(404);
    });

    it('404s rather than 401s, so a wrong token cannot confirm the unit exists', async () => {
      const { unit } = await unitWithStay();

      const wrongToken = await request(unit.id, 'wrong');
      const missingUnit = await request('00000000-0000-0000-0000-000000000000', 'wrong');

      expect(wrongToken.status).toBe(missingUnit.status);
    });

    it('serves the calendar with the right token', async () => {
      const { unit } = await unitWithStay();

      const res = await request(unit.id, icalFeedToken(unit.id));

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/calendar');
      expect(await res.text()).toContain('BEGIN:VCALENDAR');
    });
  });

  describe('what the feed discloses', () => {
    it('marks booked nights unavailable without naming the booking', async () => {
      const { unit, booking } = await unitWithStay();

      const body = await (await request(unit.id, icalFeedToken(unit.id))).text();

      expect(body).toContain('20261210');
      expect(body).toContain('20261214');
      expect(body).toContain('SUMMARY:Unavailable');
      // Status and type used to be published in the DESCRIPTION.
      expect(body).not.toContain('confirmed');
      expect(body).not.toContain('guest_stay');
      expect(body).not.toContain(booking.id.slice(0, 8));
    });

    it('never publishes nightly pricing', async () => {
      const { unit } = await unitWithStay();
      await db.pricingRule.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2026-12-20'),
          endDate: new Date('2026-12-28'),
          nightlyThb: 1_234_500,
          label: 'Peak season',
        },
      });

      const body = await (await request(unit.id, icalFeedToken(unit.id))).text();

      expect(body).not.toContain('12345');
      expect(body).not.toContain('Peak season');
      expect(body).not.toContain('Price');
    });

    it("blocks appear as busy, and the operator's note stays internal", async () => {
      const { unit } = await unitWithStay();
      await db.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2026-12-20'),
          endDate: new Date('2026-12-22'),
          reason: 'maintenance',
          note: 'Pool pump replacement, contractor Somchai',
        },
      });

      const body = await (await request(unit.id, icalFeedToken(unit.id))).text();

      expect(body).toContain('20261220');
      expect(body).not.toContain('Somchai');
      expect(body).not.toContain('maintenance');
      // A block previously carried TRANSP:TRANSPARENT, which tells the consuming
      // calendar the night is free — the opposite of blocking it.
      expect(body).not.toContain('TRANSP:TRANSPARENT');
    });

    it('leaves a cancelled booking out — those nights are sellable again', async () => {
      const { unit, project } = await unitWithStay();
      const guest = await createIdentity();
      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'cancelled',
        startDate: new Date('2026-12-20'),
        endDate: new Date('2026-12-22'),
      });

      const body = await (await request(unit.id, icalFeedToken(unit.id))).text();

      expect(body).not.toContain('20261220');
    });
  });
});
