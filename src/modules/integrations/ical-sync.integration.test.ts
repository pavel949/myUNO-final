import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import { registerIntegrationAccount } from './integrations';
import { syncICalAccount, syncAllICalAccounts } from './ical-sync';
import { assertSafeFeedUrl, ICalFetchError } from './ical-fetch';

/**
 * T-039. The sync has to be honest about whether it worked.
 *
 * The cron it replaces stamped `lastSyncAt` and cleared `lastError` without
 * fetching anything, so the integration health panel showed every feed green
 * while no feed had ever been read — the screen built to warn that a unit was
 * sold on Airbnb was the screen reassuring us it was not.
 */
describe('iCal sync (T-039)', () => {
  const FEED_URL = 'https://www.airbnb.com/calendar/ical/12345.ics';

  function feed(...events: string[]): string {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
  }

  function vevent(uid: string, start: string, end: string): string {
    return [
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `UID:${uid}`,
      'SUMMARY:Reserved',
      'END:VEVENT',
    ].join('\r\n');
  }

  function respondWith(body: string, init: { status?: number } = {}) {
    return vi.fn(async () =>
      new Response(body, {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'text/calendar' },
      })
    );
  }

  let unitId: string;
  let projectId: string;
  let accountId: string;

  beforeEach(async () => {
    await resetDb();

    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    projectId = project.id;
    unitId = unit.id;

    const account = await registerIntegrationAccount(
      db,
      'ical_airbnb',
      'unit',
      { ical_url: FEED_URL },
      unitId
    );
    accountId = account.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('a feed that reads cleanly', () => {
    it('turns OTA reservations into blocks the booking engine honours', async () => {
      vi.stubGlobal('fetch', respondWith(feed(vevent('a@airbnb', '20261110', '20261114'))));

      const result = await syncICalAccount(db, accountId);

      expect(result.imported).toBe(1);

      const blocks = await db.blockedDate.findMany({ where: { unitId } });
      expect(blocks).toHaveLength(1);
      expect(blocks[0].reason).toBe('ota_import');
      expect(blocks[0].externalRef).toBe('a@airbnb');
    });

    it('does not duplicate on the second run — the UID is the idempotency key', async () => {
      const fetcher = respondWith(feed(vevent('a@airbnb', '20261110', '20261114')));
      vi.stubGlobal('fetch', fetcher);

      await syncICalAccount(db, accountId);
      await syncICalAccount(db, accountId);

      // A calendar is polled hourly; re-importing would pile up blocks forever.
      expect(await db.blockedDate.count({ where: { unitId } })).toBe(1);
    });

    it('reports events it could not trust rather than dropping them silently', async () => {
      vi.stubGlobal(
        'fetch',
        respondWith(
          feed(
            vevent('good@airbnb', '20261110', '20261114'),
            ['BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261201', 'END:VEVENT'].join('\r\n')
          )
        )
      );

      const result = await syncICalAccount(db, accountId);

      expect(result.imported).toBe(1);
      expect(result.skipped).toHaveLength(1);
    });
  });

  describe('when the OTA and the platform disagree', () => {
    it('records a conflict instead of overwriting our own booking', async () => {
      // The platform is the system of record: an OTA feed cannot cancel a stay
      // we have already sold and taken money for.
      const guest = await createIdentity();
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guest.id,
        status: 'confirmed',
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-14'),
      });

      vi.stubGlobal('fetch', respondWith(feed(vevent('clash@airbnb', '20261110', '20261114'))));

      const result = await syncICalAccount(db, accountId);

      expect(result.conflicts).toBe(1);
      expect(result.imported).toBe(0);
      expect(await db.blockedDate.count({ where: { unitId } })).toBe(0);
    });

    it('tells ops and admin about it (N-25)', async () => {
      // The conflict used to reach a console.warn and stop there, which meant a
      // villa sold twice across two channels produced a log line nobody reads on
      // a schedule nobody watches.
      const guest = await createIdentity();
      const opsStaff = await createIdentity();
      const admin = await createIdentity({ isAdmin: true });

      await db.roleAssignment.create({
        data: {
          identityId: opsStaff.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId,
          status: 'active',
        },
      });

      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guest.id,
        status: 'confirmed',
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-14'),
      });

      vi.stubGlobal('fetch', respondWith(feed(vevent('clash@airbnb', '20261110', '20261114'))));
      await syncICalAccount(db, accountId);

      const notifications = await db.notification.findMany({
        where: { type: 'ops_ical_conflict' },
        select: { identityId: true, params: true },
      });

      const told = notifications.map((n) => n.identityId);
      expect(told).toContain(opsStaff.id);
      expect(told).toContain(admin.id);
      // The guest is not an operator and must not be told about our channel mess.
      expect(told).not.toContain(guest.id);

      // The notification has to name the clashing stay, or ops has to go hunting.
      expect((notifications[0].params as Record<string, unknown>).start_date).toBe('2026-11-10');
    });
  });

  describe('health state must reflect reality', () => {
    it('marks the account errored and leaves lastSyncAt alone when the feed is down', async () => {
      vi.stubGlobal('fetch', respondWith('', { status: 503 }));

      const summary = await syncAllICalAccounts(db);

      expect(summary.failed).toBe(1);
      expect(summary.synced).toBe(0);

      const account = await db.integrationAccount.findUnique({ where: { id: accountId } });
      expect(account?.status).toBe('error');
      expect(account?.lastError).toContain('503');
      // lastSyncAt means "when this feed was last successfully read". Moving it
      // on failure would let a feed broken for a week look freshly synced.
      expect(account?.lastSyncAt).toBeNull();
    });

    it('marks the account errored when the response is not a calendar', async () => {
      // An expired feed URL commonly returns a login page with status 200.
      vi.stubGlobal('fetch', respondWith('<html>Sign in</html>'));

      const summary = await syncAllICalAccounts(db);

      expect(summary.failed).toBe(1);
      const account = await db.integrationAccount.findUnique({ where: { id: accountId } });
      expect(account?.status).toBe('error');
    });

    it('refuses an integration with no feed URL rather than counting it synced', async () => {
      const bare = await registerIntegrationAccount(db, 'ical_booking', 'unit', {}, unitId);

      await expect(syncICalAccount(db, bare.id)).rejects.toThrow(/feed URL/i);
    });

    it('stamps success only when a feed was actually read', async () => {
      vi.stubGlobal('fetch', respondWith(feed(vevent('a@airbnb', '20261110', '20261114'))));

      const summary = await syncAllICalAccounts(db);

      expect(summary.synced).toBe(1);
      const account = await db.integrationAccount.findUnique({ where: { id: accountId } });
      expect(account?.status).toBe('active');
      expect(account?.lastSyncAt).not.toBeNull();
      expect(account?.lastError).toBeNull();
    });

    it('keeps syncing the other feeds when one is down', async () => {
      const otherUnit = await createUnit({ projectId, name: 'Unit Two', status: 'live' });
      await registerIntegrationAccount(
        db,
        'ical_booking',
        'unit',
        { ical_url: 'https://admin.booking.com/hotel/ical/999.ics' },
        otherUnit.id
      );

      let call = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          call += 1;
          return call === 1
            ? new Response('', { status: 500 })
            : new Response(feed(vevent('b@booking', '20261201', '20261205')), { status: 200 });
        })
      );

      const summary = await syncAllICalAccounts(db);

      expect(summary.totalIntegrations).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.synced).toBe(1);
      expect(summary.imported).toBe(1);
    });
  });

  describe('the feed URL is third-party input', () => {
    it('accepts an ordinary OTA URL', () => {
      expect(() => assertSafeFeedUrl(FEED_URL)).not.toThrow();
    });

    it.each([
      'http://localhost:5432/',
      'http://127.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/internal',
      'http://192.168.1.1/',
    ])('refuses %s, which would make the cron a way to read our own network', (url) => {
      expect(() => assertSafeFeedUrl(url)).toThrow(ICalFetchError);
    });

    it('refuses a non-http scheme', () => {
      expect(() => assertSafeFeedUrl('file:///etc/passwd')).toThrow(ICalFetchError);
    });
  });
});
