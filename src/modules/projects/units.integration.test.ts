import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { createUnit as createUnitFn, updateUnit, confirmPermittedUse } from './units';
import { UnitStatus } from '@prisma/client';

describe('Units module', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('createUnit', () => {
    it('creates a unit in draft status', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      const unit = await createUnitFn({
        projectId: project.id,
        name: 'Villa 101',
        unitType: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        addressSupplement: '101',
        baseNightlyThb: 2000,
        actorIdentityId: admin.id,
      });

      expect(unit.projectId).toBe(project.id);
      expect(unit.name).toBe('Villa 101');
      expect(unit.status).toBe('draft');
      expect(unit.permittedUseConfirmedAt).toBeNull();
    });

    it('rejects duplicate unit name within project', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      await createUnitFn({
        projectId: project.id,
        name: 'Villa 101',
        unitType: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        addressSupplement: '101',
        baseNightlyThb: 2000,
        actorIdentityId: admin.id,
      });

      await expect(
        createUnitFn({
          projectId: project.id,
          name: 'Villa 101',
          unitType: 'apartment',
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          addressSupplement: '102',
          baseNightlyThb: 1500,
          actorIdentityId: admin.id,
        })
      ).rejects.toThrow('already exists');
    });

    it('allows same unit name in different projects', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project1 = await createProject({ slug: 'proj-1' });
      const project2 = await createProject({ slug: 'proj-2' });

      const unit1 = await createUnitFn({
        projectId: project1.id,
        name: 'Villa A',
        unitType: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        addressSupplement: '101',
        baseNightlyThb: 2000,
        actorIdentityId: admin.id,
      });

      const unit2 = await createUnitFn({
        projectId: project2.id,
        name: 'Villa A',
        unitType: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        addressSupplement: '101',
        baseNightlyThb: 2000,
        actorIdentityId: admin.id,
      });

      expect(unit1.id).not.toBe(unit2.id);
      expect(unit1.name).toBe(unit2.name);
    });

    it('logs audit entry on create', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      const unit = await createUnitFn({
        projectId: project.id,
        name: 'Villa 101',
        unitType: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        addressSupplement: '101',
        baseNightlyThb: 2000,
        actorIdentityId: admin.id,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: unit.id, action: 'units:create' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorIdentityId).toBe(admin.id);
      expect(audit?.action).toBe('units:create');
      expect(audit?.entityType).toBe('Unit');
    });
  });

  describe('updateUnit', () => {
    it('updates unit fields', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      const updated = await updateUnit({
        unitId: unit.id,
        name: 'Villa 202',
        bedrooms: 4,
        actorIdentityId: admin.id,
      });

      expect(updated.name).toBe('Villa 202');
      expect(updated.bedrooms).toBe(4);
      expect(updated.unitType).toBe(unit.unitType); // unchanged
    });

    it('rejects going live without permitted_use_confirmed_at', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, status: 'draft' });

      await expect(
        updateUnit({
          unitId: unit.id,
          status: 'live' as UnitStatus,
          actorIdentityId: admin.id,
        })
      ).rejects.toThrow('cannot move to live status without permitted use confirmation');
    });

    it('allows going live after permitted use is confirmed', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, status: 'draft' });

      // First confirm permitted use
      await confirmPermittedUse(unit.id, admin.id);

      // Now can update to live
      const updated = await updateUnit({
        unitId: unit.id,
        status: 'live' as UnitStatus,
        actorIdentityId: admin.id,
      });

      expect(updated.status).toBe('live');
      expect(updated.permittedUseConfirmedAt).not.toBeNull();
    });

    it('checks name uniqueness only if name is changing', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, name: 'Villa 101' });

      // Update without changing name should succeed
      const updated = await updateUnit({
        unitId: unit.id,
        bedrooms: 4,
        actorIdentityId: admin.id,
      });

      expect(updated.name).toBe('Villa 101');
      expect(updated.bedrooms).toBe(4);
    });

    it('logs audit entry on update', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      await updateUnit({
        unitId: unit.id,
        name: 'Updated Name',
        actorIdentityId: admin.id,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: unit.id, action: 'units:update' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorIdentityId).toBe(admin.id);
      expect(audit?.action).toBe('units:update');
    });
  });

  describe('confirmPermittedUse', () => {
    it('sets permittedUseConfirmedAt timestamp', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      const before = new Date();
      const updated = await confirmPermittedUse(unit.id, admin.id);
      const after = new Date();

      expect(updated.permittedUseConfirmedAt).not.toBeNull();
      expect(updated.permittedUseConfirmedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updated.permittedUseConfirmedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('logs audit entry', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      await confirmPermittedUse(unit.id, admin.id);

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: unit.id, action: 'units:confirm_permitted_use' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorIdentityId).toBe(admin.id);
      expect(audit?.action).toBe('units:confirm_permitted_use');
    });

    it('rejects if unit does not exist', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(confirmPermittedUse('nonexistent-id', admin.id)).rejects.toThrow(
        'Unit nonexistent-id not found'
      );
    });
  });
});
