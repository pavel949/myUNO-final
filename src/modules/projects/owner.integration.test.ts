import { describe, it, expect, beforeEach } from 'vitest';
import type { OwnerStatementStatus } from '@prisma/client';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
  createUnitEngagement,
} from '@/test/util';
import {
  bookOwnerStay,
  getOwnerDashboard,
  getOwnerBookingsList,
  getOwnerPortfolioShape,
  getOwnerProjects,
  getOwnerStatements,
} from './owner.service';

describe('Owner experience (T-033)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('owner-stay booking', () => {
    it('books an owner stay in their own unit', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      // Book owner stay
      const startDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
      const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 nights

      const booking = await bookOwnerStay(db, {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        startDate,
        endDate,
      });

      expect(booking.bookingType).toBe('owner_stay');
      expect(booking.totalThb).toBe(0); // Zero rent
      expect(booking.status).toBe('confirmed'); // Auto-confirmed
      expect(booking.guestIdentityId).toBe(owner.id);
    });

    it('refuses owner stay if not enough notice', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      // Try to book with insufficient notice (less than 24h default)
      const startDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
      const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      await expect(
        bookOwnerStay(db, {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          startDate,
          endDate,
        })
      ).rejects.toThrow('at least');
    });

    it('refuses owner stay if dates conflict with guest booking', async () => {
      const owner = await createIdentity();
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      // Anchor to "now" so the owner-stay 24h-notice rule is satisfied on any
      // run date and the availability check is what actually rejects the stay
      // (fixed dates rotted into the past and tripped the notice rule first).
      const day = 24 * 60 * 60 * 1000;

      // Create a guest booking starting 3 days out, running 5 nights
      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date(Date.now() + 3 * day),
        endDate: new Date(Date.now() + 8 * day),
      });

      // Try to book owner stay overlapping with guest booking
      const startDate = new Date(Date.now() + 5 * day);
      const endDate = new Date(Date.now() + 10 * day);

      await expect(
        bookOwnerStay(db, {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          startDate,
          endDate,
        })
      ).rejects.toThrow('not available');
    });
  });

  describe('owner dashboard (adaptive)', () => {
    it('provides dashboard data for single-unit owner', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      // Create some bookings
      const guest = await createIdentity();
      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-20'),
        totalThb: 5000,
      });

      const dashboard = await getOwnerDashboard(db, owner.id);

      expect(dashboard.identityId).toBe(owner.id);
      expect(dashboard.units.length).toBe(1);
      expect(dashboard.units[0].id).toBe(unit.id);
      expect(dashboard.units[0].bookingsCount).toBeGreaterThanOrEqual(1);
    });

    it('provides dashboard data for portfolio owner (multi-unit)', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit1 = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      const unit2 = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      const dashboard = await getOwnerDashboard(db, owner.id);

      expect(dashboard.units.length).toBe(2);
      expect(dashboard.units.map((u) => u.id)).toContain(unit1.id);
      expect(dashboard.units.map((u) => u.id)).toContain(unit2.id);
    });

    it('calculates occupancy correctly excluding owner stays', async () => {
      const owner = await createIdentity();
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      // Anchor all dates to "now" so the owner-stay 24h-notice rule and the
      // this-month revenue window hold on any run date (fixed dates rotted).
      const day = 24 * 60 * 60 * 1000;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(12, 0, 0, 0);
      const guestStart = monthStart;
      const guestEnd = new Date(monthStart.getTime() + 2 * day);

      // Create guest booking (within the current month)
      const guestBooking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: guestStart,
        endDate: guestEnd,
        totalThb: 5000,
      });

      // Mark as checked out to finalize booking
      await db.booking.update({
        where: { id: guestBooking.id },
        data: {
          checkedOutAt: guestEnd,
          status: 'checked_out',
        },
      });

      // Create owner stay (should not count as revenue) — starts ≥ 48h ahead
      const startDate = new Date(Date.now() + 2 * day);
      const endDate = new Date(Date.now() + 6 * day);
      await bookOwnerStay(db, {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        startDate,
        endDate,
      });

      const dashboard = await getOwnerDashboard(db, owner.id);
      const unitData = dashboard.units[0];

      // Revenue should only count guest stays, not owner stays. 5000 satang
      // -> 50 baht, converted at the display boundary (CLAUDE.md; Q47).
      expect(unitData.revenueThisMonth).toBe(50); // Only the guest booking
    });
  });

  describe('portfolio shape detection', () => {
    it('detects single-unit owner', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      const shape = await getOwnerPortfolioShape(db, owner.id);

      expect(shape.unitCount).toBe(1);
      expect(shape.isPortfolio).toBe(false);
    });

    it('detects multi-unit portfolio owner', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      const shape = await getOwnerPortfolioShape(db, owner.id);

      expect(shape.unitCount).toBe(2);
      expect(shape.isPortfolio).toBe(true);
    });

    it('counts projects separately from units', async () => {
      const owner = await createIdentity();
      const project1 = await createProject();
      const project2 = await createProject();

      await createUnit({ projectId: project1.id, ownerIdentityId: owner.id });
      await createUnit({ projectId: project1.id, ownerIdentityId: owner.id }); // Second unit in same project
      await createUnit({ projectId: project2.id, ownerIdentityId: owner.id });

      const shape = await getOwnerPortfolioShape(db, owner.id);

      expect(shape.unitCount).toBe(3);
      expect(shape.projectCount).toBe(2);
    });
  });

  describe('owner projects switcher', () => {
    it('returns projects for portfolio switching', async () => {
      const owner = await createIdentity();
      const project1 = await createProject();
      const project2 = await createProject();

      await createUnit({ projectId: project1.id, ownerIdentityId: owner.id });
      await createUnit({ projectId: project2.id, ownerIdentityId: owner.id });

      const projects = await getOwnerProjects(db, owner.id);

      expect(projects.length).toBe(2);
      expect(projects.map((p) => p.id)).toContain(project1.id);
      expect(projects.map((p) => p.id)).toContain(project2.id);
    });

    it('counts owned units per project', async () => {
      const owner = await createIdentity();
      const project = await createProject();

      await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      const projects = await getOwnerProjects(db, owner.id);
      const projectData = projects[0];

      expect(projectData._count.units).toBe(2);
    });
  });

  describe('owner bookings list', () => {
    it('returns bookings list for owner viewing', async () => {
      const owner = await createIdentity();
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-15'),
        totalThb: 5000,
      });

      // Mark as confirmed
      await db.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' },
      });

      const bookings = await getOwnerBookingsList(db, unit.id, owner.id);

      expect(bookings.length).toBeGreaterThanOrEqual(1);
      // 5000 satang -> 50 baht, converted at the display boundary (CLAUDE.md; Q47).
      expect(bookings[0].totalThb).toBe(50);
      expect(bookings[0].guestIdentity.firstName).toBeDefined();
    });

    it('refuses access to bookings of units owner does not own', async () => {
      const owner = await createIdentity();
      const otherOwner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: otherOwner.id });

      await expect(getOwnerBookingsList(db, unit.id, owner.id)).rejects.toThrow('Access denied');
    });
  });

  describe('statement list visibility', () => {
    async function statementFor(
      unitId: string,
      ownerIdentityId: string,
      engagementId: string,
      status: OwnerStatementStatus,
      periodStart: string
    ) {
      return db.ownerStatement.create({
        data: {
          unitId,
          ownerIdentityId,
          engagementId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodStart),
          grossRevenueTh: 50_000,
          totalCostsTh: 10_000,
          noiTh: 40_000,
          ownerShareTh: 35_000,
          estateShareTh: 5_000,
          status,
        },
      });
    }

    it('lists every statement past the admin gate, and hides drafts', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      const engagement = await createUnitEngagement({
        unitId: unit.id,
        ownerIdentityId: owner.id,
        status: 'active',
      });

      const draft = await statementFor(unit.id, owner.id, engagement.id, 'draft', '2026-04-01');
      // The one that matters: it is waiting on this owner's own signature, so
      // listing only `published` would hide it and leave sign-off reachable by
      // direct link alone.
      const awaitingOwner = await statementFor(
        unit.id, owner.id, engagement.id, 'pending_owner_review', '2026-05-01'
      );
      const published = await statementFor(unit.id, owner.id, engagement.id, 'published', '2026-06-01');
      const signedOff = await statementFor(unit.id, owner.id, engagement.id, 'signed_off', '2026-07-01');

      const listed = await getOwnerStatements(db, owner.id);
      const listedIds = listed.map((s) => s.id);

      expect(listedIds).toContain(awaitingOwner.id);
      expect(listedIds).toContain(published.id);
      expect(listedIds).toContain(signedOff.id);
      // A draft has not passed doc 10's admin sign-off gate, so it is not the
      // owner's to read.
      expect(listedIds).not.toContain(draft.id);
    });

    it('never lists another owner-s statements', async () => {
      const owner = await createIdentity();
      const stranger = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      const engagement = await createUnitEngagement({
        unitId: unit.id,
        ownerIdentityId: owner.id,
        status: 'active',
      });

      await statementFor(unit.id, owner.id, engagement.id, 'published', '2026-06-01');

      expect(await getOwnerStatements(db, stranger.id)).toEqual([]);
    });
  });
});
