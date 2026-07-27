import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import { seedConfig, setConfigOverride, clearConfigCache } from '@/modules/config';
import { resolveCancellationPolicy } from './cancellation';

describe('resolveCancellationPolicy — configuration is the source of truth (doc 04 §5)', () => {
  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);
  });

  it('resolves a named policy from config', async () => {
    const policy = await resolveCancellationPolicy(db, 'strict');
    expect(policy.name).toBe('strict');
    expect(policy.steps).toEqual([
      { days_before_checkin: 14, refund_pct: 50 },
      { days_before_checkin: 0, refund_pct: 0 },
    ]);
  });

  it('falls back to [cfg] cancellation.default_policy (moderate) when the unit has no key', async () => {
    const policy = await resolveCancellationPolicy(db, null);
    expect(policy.name).toBe('moderate');
    expect(policy.steps[0]).toEqual({ days_before_checkin: 5, refund_pct: 100 });
  });

  it('fails closed on an unknown policy key instead of degrading to flexible', async () => {
    await expect(resolveCancellationPolicy(db, 'typo_policy')).rejects.toThrow(
      /Unknown cancellation policy/
    );
  });

  it('a project-level config override changes the snapshot without any code change', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });

    await setConfigOverride(db, 'cancellation.policy.moderate', [{ days: 10, pct: 80 }], {
      scopeType: 'project',
      scopeId: project.id,
      changedByIdentityId: admin.id,
    });
    clearConfigCache();

    const policy = await resolveCancellationPolicy(db, 'moderate', {
      projectId: project.id,
    });
    expect(policy.steps).toEqual([{ days_before_checkin: 10, refund_pct: 80 }]);
  });
});
