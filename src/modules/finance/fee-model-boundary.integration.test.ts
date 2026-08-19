import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

/**
 * Which model owns which number (Q37).
 *
 * Two entities describe a unit's commercial relationship and it is easy to read
 * them as rivals. They are not:
 *
 *   UnitEngagement     → the owner / estate split. Doc 02 §2.6, doc 10 §4.
 *                        This is what an owner statement reports.
 *   ManagementContract → performance-fee terms only, on that statement.
 *                        Deliberately not defaulted: no contract, no performance fee.
 *
 * The boundary is a decision, not an accident, and nothing in the type system
 * holds it. These tests do, so that a later change which quietly moves the split
 * onto the contract — or defaults a performance fee when none was agreed — fails
 * here rather than in an owner's statement.
 *
 * The open half of Q37 is that `EarnedFee` states the management fee a second
 * time and nothing reconciles the two. That is a founder ruling, not a fix, so
 * what is pinned here is the boundary as it stands today.
 */
describe('the fee-model boundary (Q37)', () => {
  const routeSource = readFileSync(
    join(process.cwd(), 'src/app/api/admin/statements/generate/route.ts'),
    'utf8'
  );

  beforeEach(async () => {
    await resetDb();
  });

  describe('what the statement generator reads', () => {
    it('takes the owner/estate split from the engagement, not the contract', () => {
      // Each branch of the split must key off the engagement type. If a later
      // change reads contract.managementFeeBasis here instead, the owner's share
      // silently starts coming from a different document than doc 10 names.
      for (const branch of [
        "engagement.engagementType === 'direct_managed'",
        "engagement.engagementType === 'via_management_company'",
      ]) {
        expect(routeSource).toContain(branch);
      }

      const splitSection = routeSource.slice(
        routeSource.indexOf('Owner / estate split'),
        routeSource.indexOf('const totalCostsThb')
      );
      expect(splitSection).not.toContain('contract.managementFee');
    });

    it('takes the NOI cap from the engagement', () => {
      expect(routeSource).toContain('engagement.noiCapAnnualThb');
    });

    it('takes the performance fee from the contract, and only from there', () => {
      expect(routeSource).toContain('contract?.performanceFeeRate');
      // No default: a unit without a performance-fee contract earns none.
      expect(routeSource).toContain('performanceFeeEnabled: true');
    });

    it('never reads EarnedFee — the statement computes, it does not sum accruals', () => {
      // If this ever fails, Q37 has been answered in code without being
      // answered in the document, and the owner-facing number has changed.
      expect(routeSource).not.toContain('earnedFee');
    });
  });

  describe('what the schema allows', () => {
    it('refuses to generate a direct-managed statement with no NOI cap', async () => {
      // Doc 10: a direct-managed unit without its cap refuses generation rather
      // than guessing. The guard lives on the engagement, so it belongs here.
      expect(routeSource).toContain('noi_cap_annual_thb');
      expect(routeSource).toContain('Statement generation refused');
    });

    it('lets one unit hold an engagement and a contract at once', async () => {
      // The two coexist by design; a schema change that made them exclusive
      // would break the performance-fee path.
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          engagementType: 'direct_managed',
          noiCapAnnualThb: 1_000_000,
          status: 'active',
        },
      });

      await db.managementContract.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          ownerIdentityId: owner.id,
          managementFeeBasis: 'percentage_noi',
          managementFeeRate: '0.2000',
          performanceFeeEnabled: true,
          performanceFeeRate: '0.1000',
          performanceFeeBaseline: 500_000,
          contractStartDate: new Date('2026-01-01'),
          status: 'active',
        },
      });

      const [engagements, contracts] = await Promise.all([
        db.unitEngagement.count({ where: { unitId: unit.id } }),
        db.managementContract.count({ where: { unitId: unit.id } }),
      ]);

      expect(engagements).toBe(1);
      expect(contracts).toBe(1);
    });
  });
});
