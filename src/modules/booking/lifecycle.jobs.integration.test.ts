import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { sendPrearrivalReminders, sendCheckinInstructions, sendCheckoutReminders, sendPostStayPrompts } from './lifecycle.jobs';

describe('guest lifecycle jobs (LY-8)', () => {
  const NOW = new Date('2026-08-01T09:00:00Z');
  let projectId: string;
  let unitId: string;
  let guestId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const unit = await createUnit({ projectId, status: 'live' });
    unitId = unit.id;
    const guest = await createIdentity();
    guestId = guest.id;
  });

  describe('sendPrearrivalReminders', () => {
    it('fires inside the window, exactly once, and skips far-future bookings', async () => {
      await createBooking({
        unitId, projectId, guestIdentityId: guestId, status: 'confirmed',
        startDate: new Date('2026-08-04'), // 3 days out — inside default 5
        endDate: new Date('2026-08-08'),
      });
      const farGuest = await createIdentity();
      await createBooking({
        unitId, projectId, guestIdentityId: farGuest.id, status: 'confirmed',
        startDate: new Date('2026-08-20'), // 19 days out — outside window
        endDate: new Date('2026-08-24'),
      });

      expect(await sendPrearrivalReminders(db, NOW)).toBe(1);
      // Second run: idempotent
      expect(await sendPrearrivalReminders(db, NOW)).toBe(0);

      const notifications = await db.notification.findMany({
        where: { type: 'stay_prearrival_passports' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].identityId).toBe(guestId);
      expect((notifications[0].params as { home_space_url?: string }).home_space_url).toContain(
        '/home-space'
      );
    });

    it('skips cancelled and requested bookings', async () => {
      await createBooking({
        unitId, projectId, guestIdentityId: guestId, status: 'cancelled',
        startDate: new Date('2026-08-03'),
        endDate: new Date('2026-08-06'),
      });
      const g2 = await createIdentity();
      await createBooking({
        unitId, projectId, guestIdentityId: g2.id, status: 'requested',
        startDate: new Date('2026-08-03'),
        endDate: new Date('2026-08-07'),
      });

      expect(await sendPrearrivalReminders(db, NOW)).toBe(0);
    });

    it('respects a project override of the window', async () => {
      await db.configOverride.create({
        data: {
          parameterKey: 'notify.prearrival_days_before',
          scopeType: 'project',
          scopeId: projectId,
          value: 2 as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      await createBooking({
        unitId, projectId, guestIdentityId: guestId, status: 'confirmed',
        startDate: new Date('2026-08-04'), // 3 days out — outside the tightened 2-day window
        endDate: new Date('2026-08-08'),
      });

      expect(await sendPrearrivalReminders(db, NOW)).toBe(0);
    });
  });

  describe('sendCheckinInstructions (N-07b)', () => {
    const WITHIN_24H = new Date('2026-08-04T10:00:00Z'); // 12h before check-in on Aug 5

    it('fires when verification is complete and check-in is within 24h, once', async () => {
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'confirmed',
        verificationStatus: 'passports_received',
        startDate: new Date('2026-08-05T10:00:00Z'),
        endDate: new Date('2026-08-08'),
      });
      const pendingUnit = await createUnit({ projectId, status: 'live' });
      const pendingGuest = await createIdentity();
      await createBooking({
        unitId: pendingUnit.id,
        projectId,
        guestIdentityId: pendingGuest.id,
        status: 'confirmed',
        verificationStatus: 'pending',
        startDate: new Date('2026-08-05T10:00:00Z'),
        endDate: new Date('2026-08-08'),
      });

      expect(await sendCheckinInstructions(db, WITHIN_24H)).toBe(1);
      expect(await sendCheckinInstructions(db, WITHIN_24H)).toBe(0);

      const notifications = await db.notification.findMany({
        where: {
          type: 'stay_checkin_instructions',
          bodyKey: 'notify.stay_checkin_instructions.body',
        },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].identityId).toBe(guestId);
      expect((notifications[0].params as { home_space_url?: string }).home_space_url).toContain(
        '/home-space'
      );
    });

    it('sends for not_required verification and skips far-future check-ins', async () => {
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'confirmed',
        verificationStatus: 'not_required',
        startDate: new Date('2026-08-05T10:00:00Z'),
        endDate: new Date('2026-08-08'),
      });
      const farUnit = await createUnit({ projectId, status: 'live' });
      const farGuest = await createIdentity();
      await createBooking({
        unitId: farUnit.id,
        projectId,
        guestIdentityId: farGuest.id,
        status: 'confirmed',
        verificationStatus: 'not_required',
        startDate: new Date('2026-08-10T10:00:00Z'),
        endDate: new Date('2026-08-14'),
      });

      expect(await sendCheckinInstructions(db, WITHIN_24H)).toBe(1);
    });
  });

  describe('sendCheckoutReminders (N-12)', () => {
    const DEPARTURE_MORNING = new Date('2026-08-05T01:00:00Z'); // 08:00 Asia/Bangkok

    it('fires on departure day after 08:00, once, and skips wrong day or early hour', async () => {
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'checked_in',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
      });
      const otherUnit = await createUnit({ projectId, status: 'live' });
      const tomorrowGuest = await createIdentity();
      await createBooking({
        unitId: otherUnit.id,
        projectId,
        guestIdentityId: tomorrowGuest.id,
        status: 'checked_in',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-06'),
      });

      expect(await sendCheckoutReminders(db, DEPARTURE_MORNING)).toBe(1);
      expect(await sendCheckoutReminders(db, DEPARTURE_MORNING)).toBe(0);

      const tooEarly = new Date('2026-08-05T00:30:00Z'); // 07:30 Bangkok
      const earlyUnit = await createUnit({ projectId, status: 'live' });
      const earlyGuest = await createIdentity();
      await createBooking({
        unitId: earlyUnit.id,
        projectId,
        guestIdentityId: earlyGuest.id,
        status: 'checked_in',
        startDate: new Date('2026-08-03'),
        endDate: new Date('2026-08-05'),
      });
      expect(await sendCheckoutReminders(db, tooEarly)).toBe(0);

      const notifications = await db.notification.findMany({
        where: { type: 'stay_checkout_reminder' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].identityId).toBe(guestId);
      expect((notifications[0].params as { home_space_url?: string }).home_space_url).toContain(
        '/home-space'
      );
    });

    it('skips confirmed bookings not yet checked in', async () => {
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'confirmed',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
      });

      expect(await sendCheckoutReminders(db, DEPARTURE_MORNING)).toBe(0);
    });
  });

  describe('sendPostStayPrompts', () => {
    it('fires after the offset, once, and skips too-recent checkouts', async () => {
      await createBooking({
        unitId, projectId, guestIdentityId: guestId, status: 'checked_out',
        startDate: new Date('2026-07-25'),
        endDate: new Date('2026-07-29'),
        checkedOutAt: new Date('2026-07-30T10:00:00Z'), // 2 days before NOW
      });
      const recentGuest = await createIdentity();
      await createBooking({
        unitId, projectId, guestIdentityId: recentGuest.id, status: 'checked_out',
        startDate: new Date('2026-07-28'),
        endDate: new Date('2026-08-01'),
        checkedOutAt: new Date('2026-08-01T08:00:00Z'), // 1h before NOW — too recent
      });

      expect(await sendPostStayPrompts(db, NOW)).toBe(1);
      expect(await sendPostStayPrompts(db, NOW)).toBe(0);

      const notifications = await db.notification.findMany({
        where: { type: 'stay_review_prompt' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].identityId).toBe(guestId);
    });

    it('never prompts stays checked out more than 14 days ago', async () => {
      await createBooking({
        unitId, projectId, guestIdentityId: guestId, status: 'checked_out',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-05'),
        checkedOutAt: new Date('2026-07-05T10:00:00Z'), // 27 days before NOW
      });

      expect(await sendPostStayPrompts(db, NOW)).toBe(0);
    });
  });
});
