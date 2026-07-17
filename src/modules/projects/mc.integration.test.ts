import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCDashboard,
  getMCFeeReport,
} from './mc.service';

describe('MC Service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getMCManagedUnits', () => {
    it('returns units managed by the MC organization', async () => {
      // Create project, org, and MC member identity
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test Management Company',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcIdentity = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcIdentity.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      });

      // Create owner and unit with MC engagement
      const ownerIdentity = await createIdentity();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: ownerIdentity.id });

      // Create active MC engagement
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          engagementType: 'via_management_company',
          ownerIdentityId: ownerIdentity.id,
          managementOrgId: mcOrg.id,
          status: 'active',
        },
      });

      // Fetch managed units
      const units = await getMCManagedUnits(db, mcIdentity.id, project.id, mcOrg.id);

      expect(units).toHaveLength(1);
      expect(units[0].id).toBe(unit.id);
      expect(units[0].name).toBe(unit.name);
    });

    it('throws error if identity is not an MC member', async () => {
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test MC',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const randomIdentity = await createIdentity();

      await expect(
        getMCManagedUnits(db, randomIdentity.id, project.id, mcOrg.id)
      ).rejects.toThrow('MC member does not have access');
    });

    it('scope-leak test: MC A cannot see MC B units', async () => {
      const project = await createProject();

      // Create two MC organizations
      const mcOrgA = await db.organization.create({
        data: {
          name: 'MC A',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mca@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcOrgB = await db.organization.create({
        data: {
          name: 'MC B',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mcb@test.com',
          contactPhone: '555-0002',
        },
      });

      // Create MC A member
      const mcMemberA = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcMemberA.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrgA.id,
        },
      });

      // Create units managed by each MC
      const ownerA = await createIdentity();
      const unitA = await createUnit({
        projectId: project.id,
        ownerIdentityId: ownerA.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: unitA.id,
          engagementType: 'via_management_company',
          ownerIdentityId: ownerA.id,
          managementOrgId: mcOrgA.id,
          status: 'active',
        },
      });

      const ownerB = await createIdentity();
      const unitB = await createUnit({
        projectId: project.id,
        ownerIdentityId: ownerB.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: unitB.id,
          engagementType: 'via_management_company',
          ownerIdentityId: ownerB.id,
          managementOrgId: mcOrgB.id,
          status: 'active',
        },
      });

      // MC A fetches units - should only see unitA
      const unitsForMCA = await getMCManagedUnits(db, mcMemberA.id, project.id, mcOrgA.id);
      expect(unitsForMCA).toHaveLength(1);
      expect(unitsForMCA[0].id).toBe(unitA.id);

      // MC A cannot access MC B's units (would fail on access check)
      await expect(
        getMCManagedUnits(db, mcMemberA.id, project.id, mcOrgB.id)
      ).rejects.toThrow('MC member does not have access');
    });
  });

  describe('getMCBookings', () => {
    it('returns bookings for MC-managed units only', async () => {
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test MC',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcIdentity = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcIdentity.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      });

      // Create MC-managed unit
      const owner = await createIdentity();
      const mcUnit = await createUnit({
        projectId: project.id,
        ownerIdentityId: owner.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: mcUnit.id,
          engagementType: 'via_management_company',
          ownerIdentityId: owner.id,
          managementOrgId: mcOrg.id,
          status: 'active',
        },
      });

      // Create direct-managed unit (MC should not see)
      const directOwner = await createIdentity();
      const directUnit = await createUnit({
        projectId: project.id,
        ownerIdentityId: directOwner.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: directUnit.id,
          engagementType: 'direct_managed',
          ownerIdentityId: directOwner.id,
          status: 'active',
        },
      });

      // Create bookings for both units
      const guest1 = await createIdentity();
      const booking1 = await db.booking.create({
        data: {
          unitId: mcUnit.id,
          projectId: project.id,
          guestIdentityId: guest1.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-05'),
          adults: 1,
          children: 0,
          totalThb: 10000,
          status: 'confirmed',
        },
      });

      const guest2 = await createIdentity();
      await db.booking.create({
        data: {
          unitId: directUnit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-05'),
          adults: 1,
          children: 0,
          totalThb: 15000,
          status: 'confirmed',
        },
      });

      // MC should only see booking1
      const bookings = await getMCBookings(db, mcIdentity.id, project.id, mcOrg.id);
      expect(bookings).toHaveLength(1);
      expect(bookings[0].id).toBe(booking1.id);
      expect(bookings[0].totalThb).toBe(10000);
    });
  });

  describe('getMCFeeReport', () => {
    it('calculates fee lines correctly using config fee percentage', async () => {
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test MC',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcIdentity = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcIdentity.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      });

      // Create unit with custom fee override
      const owner = await createIdentity();
      const unit = await createUnit({
        projectId: project.id,
        ownerIdentityId: owner.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          engagementType: 'via_management_company',
          ownerIdentityId: owner.id,
          managementOrgId: mcOrg.id,
          status: 'active',
          feeOverridePct: 12, // 12% custom fee
        },
      });

      // Create booking in report period
      const guest = await createIdentity();
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-02-01');

      await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-15'),
          adults: 2,
          children: 0,
          totalThb: 50000, // 50k baht total
          status: 'confirmed',
        },
      });

      const report = await getMCFeeReport(
        db,
        mcIdentity.id,
        project.id,
        mcOrg.id,
        periodStart,
        periodEnd
      );

      // Verify fee calculation: 50,000 * 12% = 6,000
      expect(report.feeLines).toHaveLength(1);
      expect(report.feeLines[0].grossAmount).toBe(50000);
      expect(report.feeLines[0].feePercentage).toBe(12);
      expect(report.feeLines[0].feeAmount).toBe(6000);

      // Verify totals
      expect(report.summaryThb.grossAmount).toBe(50000);
      expect(report.summaryThb.platformFeeAmount).toBe(6000);
    });

    it('uses default fee percentage when no override is set', async () => {
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test MC',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcIdentity = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcIdentity.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      });

      // Create unit without fee override (should use default 10%)
      const owner = await createIdentity();
      const unit = await createUnit({
        projectId: project.id,
        ownerIdentityId: owner.id,
      });
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          engagementType: 'via_management_company',
          ownerIdentityId: owner.id,
          managementOrgId: mcOrg.id,
          status: 'active',
          // No feeOverridePct - should default to 10%
        },
      });

      const guest = await createIdentity();
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-02-01');

      await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-15'),
          adults: 1,
          children: 0,
          totalThb: 100000,
          status: 'confirmed',
        },
      });

      const report = await getMCFeeReport(
        db,
        mcIdentity.id,
        project.id,
        mcOrg.id,
        periodStart,
        periodEnd
      );

      // Verify default 10% fee: 100,000 * 10% = 10,000
      expect(report.feeLines[0].feePercentage).toBe(10);
      expect(report.feeLines[0].feeAmount).toBe(10000);
    });
  });

  describe('getMCDashboard', () => {
    it('returns correct dashboard stats for MC', async () => {
      const project = await createProject();
      const mcOrg = await db.organization.create({
        data: {
          name: 'Test MC',
          orgType: 'management_company',
          projectId: project.id,
          contactEmail: 'mc@test.com',
          contactPhone: '555-0001',
        },
      });

      const mcIdentity = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: mcIdentity.id,
          role: 'mc_member',
          scopeType: 'project',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      });

      // Create units
      const owner = await createIdentity();
      const unit1 = await createUnit({
        projectId: project.id,
        ownerIdentityId: owner.id,
      });
      const unit2 = await createUnit({
        projectId: project.id,
        ownerIdentityId: owner.id,
      });

      for (const unit of [unit1, unit2]) {
        await db.unitEngagement.create({
          data: {
            unitId: unit.id,
            engagementType: 'via_management_company',
            ownerIdentityId: owner.id,
            managementOrgId: mcOrg.id,
            status: 'active',
          },
        });
      }

      // Create bookings this month
      const guest = await createIdentity();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      await db.booking.create({
        data: {
          unitId: unit1.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date(monthStart),
          endDate: new Date(monthStart.getTime() + 5 * 24 * 60 * 60 * 1000),
          adults: 1,
          children: 0,
          totalThb: 10000,
          status: 'confirmed',
        },
      });

      // Create open ticket
      await db.ticket.create({
        data: {
          unitId: unit1.id,
          projectId: project.id,
          raisedByIdentityId: guest.id,
          raisedByRole: 'guest',
          categoryKey: 'maintenance',
          title: 'Test Ticket',
          status: 'open',
          priority: 'normal',
        },
      });

      const dashboard = await getMCDashboard(db, mcIdentity.id, project.id, mcOrg.id);

      expect(dashboard.unitsCount).toBe(2);
      expect(dashboard.bookingsThisMonth).toBe(1);
      expect(dashboard.openTicketsCount).toBe(1);
    });
  });
});
