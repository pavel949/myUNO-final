import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearConfigCache, getConfig } from './config.service';

describe('config fallback cache', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it('reuses a project fallback across different unit-scoped pricing reads', async () => {
    const findUnique = vi.fn(async ({ where }: any) => {
      const scope = where.parameterKey_scopeType_scopeId;
      if (scope?.scopeType === 'project' && scope.scopeId === 'project-1') {
        return { value: 45 };
      }
      return null;
    });
    const db = {
      configOverride: { findUnique },
      configParameter: { findUnique: vi.fn() },
    } as any;

    expect(
      await getConfig(db, 'booking.hold_minutes', {
        unitId: 'unit-1',
        projectId: 'project-1',
      })
    ).toBe(45);
    expect(
      await getConfig(db, 'booking.hold_minutes', {
        unitId: 'unit-2',
        projectId: 'project-1',
      })
    ).toBe(45);

    const projectLookups = findUnique.mock.calls.filter(
      ([arg]) => arg.where.parameterKey_scopeType_scopeId?.scopeType === 'project'
    );
    expect(projectLookups).toHaveLength(1);
  });

  it('reuses the global/default fallback after scoped misses', async () => {
    const overrideFind = vi.fn(async () => null);
    const parameterFind = vi.fn(async () => ({ defaultValue: 30 }));
    const db = {
      configOverride: { findUnique: overrideFind },
      configParameter: { findUnique: parameterFind },
    } as any;

    expect(
      await getConfig(db, 'booking.hold_minutes', {
        unitId: 'unit-1',
        projectId: 'project-1',
      })
    ).toBe(30);
    expect(
      await getConfig(db, 'booking.hold_minutes', {
        unitId: 'unit-2',
        projectId: 'project-1',
      })
    ).toBe(30);

    expect(parameterFind).toHaveBeenCalledTimes(1);
    const projectLookups = overrideFind.mock.calls.filter(
      ([arg]) => arg.where.parameterKey_scopeType_scopeId?.scopeType === 'project'
    );
    expect(projectLookups).toHaveLength(1);
  });
});
