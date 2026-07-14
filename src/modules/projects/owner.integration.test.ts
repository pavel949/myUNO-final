import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import {
  bookOwnerStay,
  getOwnerDashboard,
  getOwnerBookingsList,
  getOwnerPortfolioShape,
  getOwnerProjects,
} from './owner.service';

describe('Owner experience (T-033)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('owner-stay booking', () => {
    it('books an owner stay in their own unit', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, owner.id);

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
      const unit = await createUnit(project.id, owner.id);

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
      const unit = await createUnit(project.id, owner.id);

      // Create a guest booking
      const guestBooking = await createBooking(unit.id, guest.id, {
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-15'),
      });

      // Try to book owner stay overlapping with guest booking
      const startDate = new Date('2026-08-12');
      const endDate = new Date('2026-08-17');

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
      const unit = await createUnit(project.id, owner.id);

      // Create some bookings
      const guest = await createIdentity();
      await createBooking(unit.id, guest.id, {
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
      const unit1 = await createUnit(project.id, owner.id);
      const unit2 = await createUnit(project.id, owner.id);

      const dashboard = await getOwnerDashboard(db, owner.id);

      expect(dashboard.units.length).toBe(2);
      expect(dashboard.units.map((u) => u.id)).toContain(unit1.id);
      expect(dashboard.units.map((u) => u.id)).toContain(unit2.id);
    });

    it('calculates occupancy correctly excluding owner stays', async () => {
      const owner = await createIdentity();
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, owner.id);

      // Create guest booking
      const guestBooking = await createBooking(unit.id, guest.id, {
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-20'),
        totalThb: 5000,
      });

      // Mark as checked out to finalize booking
      await db.booking.update({
        where: { id: guestBooking.id },
        data: {
          checkedOutAt: new Date('2026-07-20'),
          status: 'checked_out',
        },
      });

      // Create owner stay (should not count as revenue)
      const startDate = new Date('2026-07-21');
      const endDate = new Date('2026-07-25');
      await bookOwnerStay(db, {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        startDate,
        endDate,
      });

      const dashboard = await getOwnerDashboard(db, owner.id);
      const unitData = dashboard.units[0];

      // Revenue should only count guest stays, not owner stays
      expect(unitData.revenueThisMonth).toBe(5000); // Only the guest booking
    });
  });

  describe('portfolio shape detection', () => {
    it('detects single-unit owner', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      await createUnit(project.id, owner.id);

      const shape = await getOwnerPortfolioShape(db, owner.id);

      expect(shape.unitCount).toBe(1);
      expect(shape.isPortfolio).toBe(false);
    });

    it('detects multi-unit portfolio owner', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      await createUnit(project.id, owner.id);
      await createUnit(project.id, owner.id);

      const shape = await getOwnerPortfolioShape(db, owner.id);

      expect(shape.unitCount).toBe(2);
      expect(shape.isPortfolio).toBe(true);
    });

    it('counts projects separately from units', async () => {
      const owner = await createIdentity();
      const project1 = await createProject();
      const project2 = await createProject();

      await createUnit(project1.id, owner.id);
      await createUnit(project1.id, owner.id); // Second unit in same project
      await createUnit(project2.id, owner.id);

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

      await createUnit(project1.id, owner.id);
      await createUnit(project2.id, owner.id);

      const projects = await getOwnerProjects(db, owner.id);

      expect(projects.length).toBe(2);
      expect(projects.map((p) => p.id)).toContain(project1.id);
      expect(projects.map((p) => p.id)).toContain(project2.id);
    });

    it('counts owned units per project', async () => {
      const owner = await createIdentity();
      const project = await createProject();

      await createUnit(project.id, owner.id);
      await createUnit(project.id, owner.id);

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
      const unit = await createUnit(project.id, owner.id);

      const booking = await createBooking(unit.id, guest.id, {
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
      expect(bookings[0].totalThb).toBe(5000);
      expect(bookings[0].guestIdentity.firstName).toBeDefined();
    });

    it('refuses access to bookings of units owner does not own', async () => {
      const owner = await createIdentity();
      const otherOwner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, otherOwner.id);

      await expect(getOwnerBookingsList(db, unit.id, owner.id)).rejects.toThrow('Access denied');
    });
  });
});
