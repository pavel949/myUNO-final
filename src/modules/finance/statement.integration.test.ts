import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  generateOwnerStatement,
  publishStatement,
  getStatement,
  listStatements,
  listDraftStatements,
  getLatestPublishedStatement,
} from './statement.service';
import { recordBookingRevenue, recordCost } from './ledger.service';

describe('Statements (T-030)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('golden-number tests: direct_managed with cap', () => {
    it('generates statement with NOI above cap: cap bites', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      // Create engagement: direct_managed with 10k annual cap
      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      const engagement = await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'direct_managed',
          status: 'active',
          noiCapAnnualThb: 10000, // Annual cap
          mandateMediaId: 'mock-mandate',
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Record revenue: 15000
      const booking1 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 10000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit.id, 10000, periodStart);

      const booking2 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-15'),
          endDate: new Date('2026-07-20'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit.id, 5000, periodStart);

      // Record costs: 2000
      const staff = await createIdentity();
      await recordCost(db, {
        unitId: unit.id,
        entryType: 'cleaning_cost',
        amountThb: -2000,
        occurredOn: new Date('2026-07-25'),
        description: 'Post-checkout clean',
        recordedByIdentityId: staff.id,
      });

      // Generate statement
      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      // Golden numbers:
      // Revenue: 15000
      // Costs: 2000
      // NOI: 13000
      // Cap pro-rata: (10000 * 31 / 365) ≈ 849 THB (31 days in July / 365 days)
      // Owner share: MIN(13000, 849) = 849
      // Estate share: MAX(0, 13000 - 849) = 12151

      expect(statement.grossRevenueTh).toBe(15000);
      expect(statement.totalCostsTh).toBe(2000);
      expect(statement.noiTh).toBe(13000);
      expect(statement.capApplied).toBe(true);
      expect(statement.ownerShareTh).toBe(849); // Cap limited the share
      expect(statement.estateShareTh).toBe(12151); // Estate gets the difference
      expect(statement.status).toBe('draft');
    });

    it('cap does NOT bite when NOI is below cap', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      const engagement = await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'direct_managed',
          status: 'active',
          noiCapAnnualThb: 100000, // High annual cap
          mandateMediaId: 'mock-mandate',
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Revenue: 5000, Costs: 1000 → NOI: 4000
      const booking = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking.id, unit.id, 5000, periodStart);

      const staff = await createIdentity();
      await recordCost(db, {
        unitId: unit.id,
        entryType: 'maintenance_cost',
        amountThb: -1000,
        occurredOn: new Date('2026-07-15'),
        description: 'Repair',
        recordedByIdentityId: staff.id,
      });

      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      // Cap pro-rata: (100000 * 31 / 365) ≈ 8493
      // Owner share: MIN(4000, 8493) = 4000 (cap doesn't bite)
      expect(statement.noiTh).toBe(4000);
      expect(statement.capApplied).toBe(false);
      expect(statement.ownerShareTh).toBe(4000); // Full NOI goes to owner
      expect(statement.estateShareTh).toBe(0);
    });

    it('refusal when direct_managed unit lacks NOI cap', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      // Create engagement WITHOUT cap
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'direct_managed',
          status: 'active',
          // noiCapAnnualThb: null (missing!)
          mandateMediaId: 'mock-mandate',
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Attempt to generate statement — should throw
      await expect(
        generateOwnerStatement(db, {
          unitId: unit.id,
          periodStart,
          periodEnd,
        })
      ).rejects.toThrow(/noi_cap_annual_thb/i);
    });
  });

  describe('golden-number tests: via_management_company', () => {
    it('generates statement with MC platform fee deduction', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      // MC engagement: 20% platform fee
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'via_management_company',
          status: 'active',
          mcPlatformFeePct: 20,
          mandateMediaId: 'mock-mandate',
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Revenue: 10000, Costs: 1000 → NOI: 9000
      const booking = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-15'),
          totalPrice: 10000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking.id, unit.id, 10000, periodStart);

      const staff = await createIdentity();
      await recordCost(db, {
        unitId: unit.id,
        entryType: 'utilities_cost',
        amountThb: -1000,
        occurredOn: new Date('2026-07-20'),
        description: 'Water bill',
        recordedByIdentityId: staff.id,
      });

      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      // NOI: 9000
      // MC fee: 9000 * 20% = 1800
      // Owner share: 9000 - 1800 = 7200
      // Estate share: 1800 (the platform fee)
      expect(statement.noiTh).toBe(9000);
      expect(statement.ownerShareTh).toBe(7200);
      expect(statement.estateShareTh).toBe(1800);
      expect(statement.capApplied).toBe(false);
    });
  });

  describe('golden-number tests: owner_direct', () => {
    it('generates statement with booking fee deduction', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      // Owner-direct engagement: 5% booking fee
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'owner_direct',
          status: 'active',
          ownerDirectBookingFeePct: 5,
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Revenue: 20000, Costs: 2000 → NOI: 18000
      const booking1 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-07-10'),
          totalPrice: 12000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit.id, 12000, periodStart);

      const booking2 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-20'),
          endDate: new Date('2026-07-28'),
          totalPrice: 8000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit.id, 8000, periodStart);

      const staff = await createIdentity();
      await recordCost(db, {
        unitId: unit.id,
        entryType: 'cleaning_cost',
        amountThb: -2000,
        occurredOn: new Date('2026-07-30'),
        description: 'Cleans',
        recordedByIdentityId: staff.id,
      });

      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      // NOI: 18000
      // Booking fee: 18000 * 5% = 900
      // Owner share: 18000 - 900 = 17100
      // Estate share: 900 (the booking fee)
      expect(statement.noiTh).toBe(18000);
      expect(statement.ownerShareTh).toBe(17100);
      expect(statement.estateShareTh).toBe(900);
      expect(statement.capApplied).toBe(false);
    });
  });

  describe('publish workflow', () => {
    it('publishes draft statement and marks previous as superseded', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);
      const admin = await createIdentity();

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'owner_direct',
          status: 'active',
          ownerDirectBookingFeePct: 0,
        },
      });

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Create and publish first statement
      const booking1 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit.id, 5000, periodStart);

      const stmt1 = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      await publishStatement(db, stmt1.id, admin.id);

      // Create a correction: add another booking, regenerate
      const booking2 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-20'),
          endDate: new Date('2026-07-25'),
          totalPrice: 3000,
          guestCount: 1,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit.id, 3000, periodStart);

      const stmt2 = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart,
        periodEnd,
      });

      expect(stmt2.noiTh).toBe(8000); // 5000 + 3000

      // Publish the correction
      await publishStatement(db, stmt2.id, admin.id);

      // Verify first is now superseded
      const superseded = await db.ownerStatement.findUnique({
        where: { id: stmt1.id },
      });

      expect(superseded!.status).toBe('superseded');

      // Verify second is published
      const published = await db.ownerStatement.findUnique({
        where: { id: stmt2.id },
      });

      expect(published!.status).toBe('published');
    });
  });

  describe('access control', () => {
    it('owner sees only their published statements', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const otherOwner = await createIdentity();
      const unit1 = await createUnit(project.id);
      const unit2 = await createUnit(project.id);

      await db.unit.updateMany({
        where: { id: { in: [unit1.id, unit2.id] } },
        data: { ownerIdentityId: owner.id },
      });

      // Unit2 belongs to otherOwner
      await db.unit.update({
        where: { id: unit2.id },
        data: { ownerIdentityId: otherOwner.id },
      });

      await Promise.all([
        db.unitEngagement.create({
          data: {
            unitId: unit1.id,
            type: 'owner_direct',
            status: 'active',
            ownerDirectBookingFeePct: 0,
          },
        }),
        db.unitEngagement.create({
          data: {
            unitId: unit2.id,
            type: 'owner_direct',
            status: 'active',
            ownerDirectBookingFeePct: 0,
          },
        }),
      ]);

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Generate statements for both units
      const booking1 = await db.booking.create({
        data: {
          unitId: unit1.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit1.id, 5000, periodStart);

      const stmt1 = await generateOwnerStatement(db, {
        unitId: unit1.id,
        periodStart,
        periodEnd,
      });

      const booking2 = await db.booking.create({
        data: {
          unitId: unit2.id,
          projectId: project.id,
          guestIdentityId: otherOwner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 8000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit2.id, 8000, periodStart);

      const stmt2 = await generateOwnerStatement(db, {
        unitId: unit2.id,
        periodStart,
        periodEnd,
      });

      // Publish both
      await publishStatement(db, stmt1.id, owner.id);
      await publishStatement(db, stmt2.id, otherOwner.id);

      // Owner lists their own unit's statements
      const ownerStmts = await listStatements(db, unit1.id, owner.id, false);

      expect(ownerStmts.length).toBe(1);
      expect(ownerStmts[0].id).toBe(stmt1.id);

      // Owner cannot access otherOwner's statement
      await expect(getStatement(db, stmt2.id, owner.id, false)).rejects.toThrow('Access denied');
    });
  });

  describe('draft statements for admin review', () => {
    it('lists all draft statements across units', async () => {
      const project = await createProject();
      const owner1 = await createIdentity();
      const owner2 = await createIdentity();
      const unit1 = await createUnit(project.id);
      const unit2 = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit1.id },
        data: { ownerIdentityId: owner1.id },
      });

      await db.unit.update({
        where: { id: unit2.id },
        data: { ownerIdentityId: owner2.id },
      });

      await Promise.all([
        db.unitEngagement.create({
          data: {
            unitId: unit1.id,
            type: 'owner_direct',
            status: 'active',
            ownerDirectBookingFeePct: 0,
          },
        }),
        db.unitEngagement.create({
          data: {
            unitId: unit2.id,
            type: 'owner_direct',
            status: 'active',
            ownerDirectBookingFeePct: 0,
          },
        }),
      ]);

      const periodStart = new Date('2026-07-01');
      const periodEnd = new Date('2026-07-31');

      // Generate statements for both units
      const booking1 = await db.booking.create({
        data: {
          unitId: unit1.id,
          projectId: project.id,
          guestIdentityId: owner1.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit1.id, 5000, periodStart);

      const stmt1 = await generateOwnerStatement(db, {
        unitId: unit1.id,
        periodStart,
        periodEnd,
      });

      const booking2 = await db.booking.create({
        data: {
          unitId: unit2.id,
          projectId: project.id,
          guestIdentityId: owner2.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 8000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit2.id, 8000, periodStart);

      const stmt2 = await generateOwnerStatement(db, {
        unitId: unit2.id,
        periodStart,
        periodEnd,
      });

      // Publish one, leave other as draft
      await publishStatement(db, stmt1.id, owner1.id);

      const drafts = await listDraftStatements(db);

      expect(drafts.length).toBe(1);
      expect(drafts[0].id).toBe(stmt2.id);
    });
  });

  describe('latest published statement', () => {
    it('returns the most recent published statement', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit(project.id);

      await db.unit.update({
        where: { id: unit.id },
        data: { ownerIdentityId: owner.id },
      });

      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          type: 'owner_direct',
          status: 'active',
          ownerDirectBookingFeePct: 0,
        },
      });

      // Create and publish statements for two months
      const june = {
        start: new Date('2026-06-01'),
        end: new Date('2026-06-30'),
      };

      const july = {
        start: new Date('2026-07-01'),
        end: new Date('2026-07-31'),
      };

      const booking1 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-06-05'),
          endDate: new Date('2026-06-10'),
          totalPrice: 3000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking1.id, unit.id, 3000, june.start);

      const stmt1 = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart: june.start,
        periodEnd: june.end,
      });

      await publishStatement(db, stmt1.id, owner.id);

      const booking2 = await db.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: owner.id,
          startDate: new Date('2026-07-05'),
          endDate: new Date('2026-07-10'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      await recordBookingRevenue(db, booking2.id, unit.id, 5000, july.start);

      const stmt2 = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart: july.start,
        periodEnd: july.end,
      });

      await publishStatement(db, stmt2.id, owner.id);

      const latest = await getLatestPublishedStatement(db, unit.id);

      expect(latest!.id).toBe(stmt2.id);
      expect(latest!.noiTh).toBe(5000);
    });
  });
});
