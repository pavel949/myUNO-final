import { describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/media/media.service', () => ({ isAllowedImageType: () => true }));
vi.mock('@/modules/media/video-policy', () => ({ isAllowedVideoType: () => true }));
import { getOperatingSpaceOverviewAccess, getScopedOperationalAccess } from './operating-space-access.service';

describe('creation capabilities do not confer daily operational access', () => {
  it.each(['create_unit', 'create_complex'] as const)('rejects %s in the operational unit resolver', async capability => {
    await expect(getScopedOperationalAccess({} as any, 'employee', 'space', capability, [])).rejects.toMatchObject({ status: 403 });
  });
  it('does not expose operational workspace details to a creation-only member', async () => {
    const tx = {
      identity: { findUnique: vi.fn(async () => ({ id: 'employee', status: 'active', isAdmin: false, roleAssignments: [] })) },
      operatingSpaceMember: { findUnique: vi.fn(async () => ({ active: true, capabilities: ['create_unit', 'create_complex'] })) },
      operatingSpace: { findUnique: vi.fn() }, unit: { findMany: vi.fn() },
    };
    await expect(getOperatingSpaceOverviewAccess(tx as any, 'employee', 'space')).rejects.toMatchObject({ status: 403 });
    expect(tx.operatingSpace.findUnique).not.toHaveBeenCalled();
    expect(tx.unit.findMany).not.toHaveBeenCalled();
  });
});
