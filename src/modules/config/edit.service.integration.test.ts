import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity, createProject } from '@/test/util';
import { updateConfigParameter, clearConfigOverride } from './edit.service';

describe('Config edit service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('updateConfigParameter', () => {
    it('validates tm30_sla_hours is within 0-24', async () => {
      const admin = await createIdentity({ isAdmin: true });

      // Valid value
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 24,
      });

      const value = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'compliance.tm30_sla_hours',
            scopeType: 'global',
            scopeId: 'global',
          },
        },
      });

      expect(value?.value).toBe(24);
    });

    it('rejects tm30_sla_hours > 24', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'compliance.tm30_sla_hours',
          newValue: 25,
        })
      ).rejects.toThrow('tm30_sla_hours must be between 0 and 24 hours');
    });

    it('rejects tm30_sla_hours < 0', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'compliance.tm30_sla_hours',
          newValue: -1,
        })
      ).rejects.toThrow('tm30_sla_hours must be between 0 and 24 hours');
    });

    it('rejects non-number tm30_sla_hours', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'compliance.tm30_sla_hours',
          newValue: 'not-a-number',
        })
      ).rejects.toThrow('tm30_sla_hours must be between 0 and 24 hours');
    });

    it('creates global override at scope global', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 12,
      });

      const override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'compliance.tm30_sla_hours',
            scopeType: 'global',
            scopeId: 'global',
          },
        },
      });

      expect(override).toBeDefined();
      expect(override?.value).toBe(12);
      expect(override?.scopeType).toBe('global');
      expect(override?.scopeId).toBe('global');
    });

    it('creates project-level override with projectId scope', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'services.take_rate_pct',
        newValue: 15.5,
        projectId: project.id,
      });

      const override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'services.take_rate_pct',
            scopeType: 'project',
            scopeId: project.id,
          },
        },
      });

      expect(override).toBeDefined();
      expect(override?.value).toBe(15.5);
      expect(override?.scopeType).toBe('project');
      expect(override?.scopeId).toBe(project.id);
    });

    it('logs config change with old and new values', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 18,
      });

      const change = await prisma.configChange.findFirst({
        where: { parameterKey: 'compliance.tm30_sla_hours' },
        orderBy: { createdAt: 'desc' },
      });

      expect(change).toBeDefined();
      expect(change?.parameterKey).toBe('compliance.tm30_sla_hours');
      expect(change?.newValue).toBe(18);
      expect(change?.changedByIdentityId).toBe(admin.id);
      expect(change?.scopeType).toBe('global');
      expect(change?.scopeId).toBe('global');
    });

    it('updates existing override and logs change', async () => {
      const admin = await createIdentity({ isAdmin: true });

      // Create initial override
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 12,
      });

      // Update it
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 18,
      });

      const changes = await prisma.configChange.findMany({
        where: { parameterKey: 'compliance.tm30_sla_hours' },
        orderBy: { createdAt: 'asc' },
      });

      expect(changes.length).toBe(2);
      expect(changes[0]?.newValue).toBe(12);
      expect(changes[1]?.oldValue).toBe(12);
      expect(changes[1]?.newValue).toBe(18);
    });

    it('validates booking.hold_minutes is positive', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'booking.hold_minutes',
        newValue: 30,
      });

      const value = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'booking.hold_minutes',
            scopeType: 'global',
            scopeId: 'global',
          },
        },
      });

      expect(value?.value).toBe(30);
    });

    it('rejects booking.hold_minutes <= 0', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'booking.hold_minutes',
          newValue: 0,
        })
      ).rejects.toThrow('hold_minutes must be positive');
    });

    it('validates pricing.season.calendar is array of valid seasons', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const validSeasons = [
        { name: 'High', from: '12-01', to: '02-28', markup_pct: 25 },
        { name: 'Mid', from: '03-01', to: '11-30', markup_pct: 10 },
      ];

      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'pricing.season.calendar',
        newValue: validSeasons,
      });

      const value = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'pricing.season.calendar',
            scopeType: 'global',
            scopeId: 'global',
          },
        },
      });

      expect(Array.isArray(value?.value)).toBe(true);
    });

    it('rejects pricing.season.calendar if not array', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'pricing.season.calendar',
          newValue: 'not-an-array',
        })
      ).rejects.toThrow('season calendar must be an array');
    });

    it('rejects season without required fields', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const invalidSeasons = [
        { name: 'High', from: '12-01' }, // missing to and markup_pct
      ];

      await expect(
        updateConfigParameter(prisma, {
          identityId: admin.id,
          paramKey: 'pricing.season.calendar',
          newValue: invalidSeasons,
        })
      ).rejects.toThrow('Each season must have name, from');
    });
  });

  describe('clearConfigOverride', () => {
    it('deletes override and logs revert', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      // Create an override
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'services.take_rate_pct',
        newValue: 15.5,
        projectId: project.id,
      });

      // Clear it
      await clearConfigOverride(prisma, admin.id, 'services.take_rate_pct', project.id, undefined);

      const override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'services.take_rate_pct',
            scopeType: 'project',
            scopeId: project.id,
          },
        },
      });

      expect(override).toBeUndefined();
    });

    it('logs revert change with null newValue', async () => {
      const admin = await createIdentity({ isAdmin: true });

      // Create an override
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'compliance.tm30_sla_hours',
        newValue: 12,
      });

      // Clear it
      await clearConfigOverride(prisma, admin.id, 'compliance.tm30_sla_hours', undefined, undefined);

      const changes = await prisma.configChange.findMany({
        where: { parameterKey: 'compliance.tm30_sla_hours' },
        orderBy: { createdAt: 'asc' },
      });

      expect(changes.length).toBe(2);
      expect(changes[1]?.oldValue).toBe(12);
      expect(changes[1]?.newValue).toBeNull();
    });

    it('respects unit-level scope when clearing', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();
      const unit = await prisma.unit.create({
        data: {
          projectId: project.id,
          name: 'Unit 101',
          unitType: 'villa',
          bedrooms: 3,
          bathrooms: 2,
          maxGuests: 6,
          addressSupplement: '101',
          baseNightlyThb: 2000,
          status: 'draft',
        },
      });

      // Create unit-level override
      await updateConfigParameter(prisma, {
        identityId: admin.id,
        paramKey: 'services.take_rate_pct',
        newValue: 20,
        unitId: unit.id,
      });

      // Verify it exists
      let override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'services.take_rate_pct',
            scopeType: 'unit',
            scopeId: unit.id,
          },
        },
      });

      expect(override).toBeDefined();

      // Clear it
      await clearConfigOverride(prisma, admin.id, 'services.take_rate_pct', undefined, unit.id);

      // Verify it's gone
      override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: 'services.take_rate_pct',
            scopeType: 'unit',
            scopeId: unit.id,
          },
        },
      });

      expect(override).toBeUndefined();
    });
  });
});
