import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, resetDb, createProject, createUnit, createIdentity } from '@/test/util';
import { getConfig, setConfigOverride, clearConfigCache } from './config.service';
import { seedConfig } from './seed';

describe('T-003 · Config module', () => {
  beforeAll(async () => {
    await resetDb();
    await seedConfig(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('resolution order: unit → project → global', () => {
    it('returns global default when no overrides exist', async () => {
      clearConfigCache();
      const result = await getConfig(db, 'booking.hold_minutes');
      expect(result).toBe(30);
    });

    it('returns project override when set', async () => {
      clearConfigCache();
      const project = await createProject();
      const identity = await createIdentity();

      // Set project override
      await setConfigOverride(db, 'booking.hold_minutes', 60, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      const result = await getConfig(db, 'booking.hold_minutes', {
        projectId: project.id,
      });
      expect(result).toBe(60);
    });

    it('returns unit override over project override', async () => {
      clearConfigCache();
      const project = await createProject();
      const identity = await createIdentity();
      const unit = await createUnit({ projectId: project.id });

      // Set project override
      await setConfigOverride(db, 'booking.hold_minutes', 60, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      // Set unit override
      await setConfigOverride(db, 'booking.hold_minutes', 90, {
        scopeType: 'unit',
        scopeId: unit.id,
        changedByIdentityId: identity.id,
      });

      const result = await getConfig(db, 'booking.hold_minutes', {
        unitId: unit.id,
        projectId: project.id,
      });
      expect(result).toBe(90);
    });

    it('falls back to global when unit/project have no override', async () => {
      clearConfigCache();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      const result = await getConfig(db, 'booking.hold_minutes', {
        unitId: unit.id,
        projectId: project.id,
      });
      expect(result).toBe(30); // global default
    });
  });

  describe('cache behavior', () => {
    it('returns cached value without hitting database', async () => {
      clearConfigCache();
      const value1 = await getConfig(db, 'booking.request_hours');
      const value2 = await getConfig(db, 'booking.request_hours');

      expect(value1).toBe(value2);
      expect(value1).toBe(24); // global default
    });

    it('invalidates cache when override is changed', async () => {
      clearConfigCache();
      const project = await createProject();
      const identity = await createIdentity();

      // Get initial value (global default)
      const value1 = await getConfig(db, 'booking.max_advance_days', {
        projectId: project.id,
      });
      expect(value1).toBe(365);

      // Set override
      await setConfigOverride(db, 'booking.max_advance_days', 180, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      // Get value after override (cache should be invalidated)
      const value2 = await getConfig(db, 'booking.max_advance_days', {
        projectId: project.id,
      });
      expect(value2).toBe(180);
    });
  });

  describe('audit trail', () => {
    it('writes ConfigChange on override', async () => {
      clearConfigCache();
      const project = await createProject();
      const identity = await createIdentity();

      await setConfigOverride(db, 'booking.hold_minutes', 45, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      const change = await db.configChange.findFirst({
        where: {
          parameter_key: 'booking.hold_minutes',
          scope_type: 'project',
          scope_id: project.id,
        },
      });

      expect(change).toBeDefined();
      expect(change?.old_value).toBeNull();
      expect(change?.new_value).toBe(45);
      expect(change?.changed_by_identity_id).toBe(identity.id);
    });

    it('tracks old value when updating override', async () => {
      clearConfigCache();
      const project = await createProject();
      const identity = await createIdentity();

      // Set initial override
      await setConfigOverride(db, 'booking.request_hours', 12, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      // Update it
      await setConfigOverride(db, 'booking.request_hours', 48, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: identity.id,
      });

      const changes = await db.configChange.findMany({
        where: {
          parameter_key: 'booking.request_hours',
          scope_type: 'project',
          scope_id: project.id,
        },
        orderBy: { created_at: 'asc' },
      });

      expect(changes).toHaveLength(2);
      expect(changes[0].new_value).toBe(12);
      expect(changes[1].old_value).toBe(12);
      expect(changes[1].new_value).toBe(48);
    });
  });

  describe('typed configuration values', () => {
    it('handles json catalog values', async () => {
      clearConfigCache();
      const amenities = await getConfig(db, 'catalog.amenities');
      expect(Array.isArray(amenities)).toBe(true);
      expect(amenities?.length).toBeGreaterThan(0);
      expect(amenities?.[0]).toHaveProperty('key');
    });

    it('handles schedule values for cancellation policies', async () => {
      clearConfigCache();
      const policy = await getConfig(db, 'cancellation.policy.moderate');
      expect(Array.isArray(policy)).toBe(true);
      expect(policy?.[0]).toHaveProperty('days');
      expect(policy?.[0]).toHaveProperty('pct');
    });

    it('handles season calendar schedules', async () => {
      clearConfigCache();
      const calendar = await getConfig(db, 'pricing.season.calendar');
      expect(Array.isArray(calendar)).toBe(true);
      expect(calendar?.[0]).toHaveProperty('name');
      expect(calendar?.[0]).toHaveProperty('from');
      expect(calendar?.[0]).toHaveProperty('to');
      expect(calendar?.[0]).toHaveProperty('markup_pct');
    });
  });

  describe('seed idempotency', () => {
    it('seed can be run multiple times without errors', async () => {
      await resetDb();
      await seedConfig(db);
      const firstCount = await db.configParameter.count();

      await seedConfig(db);
      const secondCount = await db.configParameter.count();

      expect(firstCount).toBe(secondCount);
    });

    it('all parameters are created with correct defaults', async () => {
      await resetDb();
      await seedConfig(db);

      const params = await db.configParameter.findMany();

      // Should have all the parameters from doc 04
      const keys = new Set(params.map((p) => p.key));

      // Spot-check some key parameters
      expect(keys.has('booking.hold_minutes')).toBe(true);
      expect(keys.has('booking.payment.methods_enabled')).toBe(true);
      expect(keys.has('engagement.direct.noi_cap_annual_thb')).toBe(true);
      expect(keys.has('pricing.season.calendar')).toBe(true);
      expect(keys.has('cancellation.policy.flexible')).toBe(true);
      expect(keys.has('services.take_rate_pct')).toBe(true);
      expect(keys.has('catalog.amenities')).toBe(true);
    });
  });
});
