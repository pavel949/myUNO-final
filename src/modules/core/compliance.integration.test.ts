import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit, createIdentity } from '@/test/util';
import {
  createComplianceRecord,
  updateComplianceRecord,
  getUnitComplianceRecords,
  createUnitEngagement,
  checkMobilizationGate,
  completeMobilizationStep,
  getUnitMobilizationChecklist,
  isMobilizationComplete,
  initializeMobilizationChecklist,
} from './index';

describe('Compliance & Mobilization', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('ComplianceRecord', () => {
    it('creates a compliance record in pending status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      const { id } = await createComplianceRecord(db, {
        unitId: unit.id,
        recordType: 'permitted_use',
        notes: 'Initial submission',
      });

      const records = await getUnitComplianceRecords(db, unit.id);
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(id);
      expect(records[0].status).toBe('pending');
      expect(records[0].recordType).toBe('permitted_use');
    });

    it('updates a compliance record and confirms permitted_use', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const verifier = await createIdentity();

      const { id } = await createComplianceRecord(db, {
        unitId: unit.id,
        recordType: 'permitted_use',
      });

      await updateComplianceRecord(db, id, {
        status: 'confirmed',
        verifiedAt: new Date(),
        verifiedByIdentityId: verifier.id,
      });

      // Verify unit's permitted_use_confirmed_at is set
      const updatedUnit = await db.unit.findUnique({
        where: { id: unit.id },
      });

      expect(updatedUnit!.permittedUseConfirmedAt).toBeTruthy();
    });

    it('throws when confirming permitted_use on non-existent record', async () => {
      await expect(
        updateComplianceRecord(db, 'nonexistent', {
          status: 'confirmed',
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('Mobilization Checklist', () => {
    it('initializes checklist with 7 steps', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await initializeMobilizationChecklist(db, unit.id);

      const items = await getUnitMobilizationChecklist(db, unit.id);
      expect(items).toHaveLength(7);
      expect(items.map((i: any) => i.step)).toEqual([
        'qualify',
        'mandate',
        'legal_audit',
        'condition_survey',
        'standards_uplift',
        'pricing_setup',
        'golive_checklist',
      ]);
    });

    it('allows completing qualify step (no gates)', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();

      await initializeMobilizationChecklist(db, unit.id);
      const items = await getUnitMobilizationChecklist(db, unit.id);
      const qualifyItem = items.find((i: any) => i.step === 'qualify');

      await completeMobilizationStep(db, qualifyItem!.id, staff.id, 'Unit qualified');

      const updated = await db.mobilizationChecklistItem.findUnique({
        where: { id: qualifyItem!.id },
      });

      expect(updated!.status).toBe('done');
      expect(updated!.completedAt).toBeTruthy();
    });

    it('blocks mandate step until engagement is active', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const owner = await createIdentity();
      const staff = await createIdentity();

      await initializeMobilizationChecklist(db, unit.id);
      const items = await getUnitMobilizationChecklist(db, unit.id);
      const mandateItem = items.find((i: any) => i.step === 'mandate');

      // Try to complete mandate without active engagement
      await expect(
        completeMobilizationStep(db, mandateItem!.id, staff.id)
      ).rejects.toThrow('Engagement must be active');

      // Create and activate engagement
      const engagement = await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          engagementType: 'direct_managed',
          ownerIdentityId: owner.id,
          noiCapAnnualThb: 500000,
          mandateMediaId: 'test-media-id',
          status: 'active',
        },
      });

      // Now mandate should be allowed
      await completeMobilizationStep(db, mandateItem!.id, staff.id);

      const updated = await db.mobilizationChecklistItem.findUnique({
        where: { id: mandateItem!.id },
      });

      expect(updated!.status).toBe('done');
    });

    it('blocks go-live until permitted_use is confirmed', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();

      await initializeMobilizationChecklist(db, unit.id);

      // Complete all steps up to go-live except legal_audit
      const items = await getUnitMobilizationChecklist(db, unit.id);
      for (const item of items) {
        if (item.step !== 'golive_checklist' && item.step !== 'legal_audit') {
          await db.mobilizationChecklistItem.update({
            where: { id: item.id },
            data: { status: 'done', completedAt: new Date(), completedByIdentityId: staff.id },
          });
        } else if (item.step === 'legal_audit') {
          await db.mobilizationChecklistItem.update({
            where: { id: item.id },
            data: { status: 'done', completedAt: new Date(), completedByIdentityId: staff.id },
          });
        }
      }

      const goliveItem = items.find((i: any) => i.step === 'golive_checklist');

      // Try to complete go-live without permitted_use confirmed
      await expect(
        completeMobilizationStep(db, goliveItem!.id, staff.id)
      ).rejects.toThrow('Permitted use compliance record must be confirmed');

      // Create and confirm permitted_use record
      await db.complianceRecord.create({
        data: {
          unitId: unit.id,
          recordType: 'permitted_use',
          status: 'confirmed',
          verifiedAt: new Date(),
          verifiedByIdentityId: staff.id,
        },
      });

      // Update unit's permitted_use_confirmed_at
      await db.unit.update({
        where: { id: unit.id },
        data: { permittedUseConfirmedAt: new Date() },
      });

      // Now go-live should be allowed and flip unit to live
      await completeMobilizationStep(db, goliveItem!.id, staff.id);

      const updatedUnit = await db.unit.findUnique({
        where: { id: unit.id },
      });

      expect(updatedUnit!.status).toBe('live');
    });

    it('returns false for isMobilizationComplete when not all items done', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await initializeMobilizationChecklist(db, unit.id);

      const complete = await isMobilizationComplete(db, unit.id);
      expect(complete).toBe(false);
    });

    it('returns true for isMobilizationComplete when all items done', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const staff = await createIdentity();

      await initializeMobilizationChecklist(db, unit.id);
      const items = await getUnitMobilizationChecklist(db, unit.id);

      for (const item of items) {
        await db.mobilizationChecklistItem.update({
          where: { id: item.id },
          data: { status: 'done', completedAt: new Date(), completedByIdentityId: staff.id },
        });
      }

      const complete = await isMobilizationComplete(db, unit.id);
      expect(complete).toBe(true);
    });
  });

  describe('UnitEngagement', () => {
    it('requires noiCapAnnualThb for direct-managed engagement', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const owner = await createIdentity();

      await expect(
        createUnitEngagement(db, {
          unitId: unit.id,
          engagementType: 'direct_managed',
          ownerIdentityId: owner.id,
          // Missing noiCapAnnualThb
        })
      ).rejects.toThrow('NOI cap is required');
    });

    it('allows noiCapAnnualThb to be optional for via_owner engagement', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const owner = await createIdentity();

      const { id } = await createUnitEngagement(db, {
        unitId: unit.id,
        engagementType: 'via_owner',
        ownerIdentityId: owner.id,
      });

      const engagement = await db.unitEngagement.findUnique({
        where: { id },
      });

      expect(engagement!.noiCapAnnualThb).toBeNull();
    });
  });
});
