import { describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/media/media.service', () => ({ isAllowedImageType: () => true }));
vi.mock('@/modules/media/video-policy', () => ({ isAllowedVideoType: () => true }));
import { getOperatingSpaceOverviewAccess, getScopedOperationalAccess } from './operating-space-access.service';
import { CAPABILITY_DEPARTMENTS } from './operating-space-capabilities';
import { OPERATING_SPACE_CAPABILITIES } from './operating-space-capability-policy';
import { isOperatingCreationCapability } from './operating-creation-capabilities';

function fixture() {
  const actor = { id: 'admin', status: 'active', isAdmin: true, roleAssignments: [] };
  const space = { id: 'space', organizationId: 'org', status: 'active', organization: { status: 'active' } };
  const db = {
    identity: { findUnique: vi.fn(async () => actor) },
    operatingSpace: { findUnique: vi.fn(async () => space) },
    operatingSpaceMember: { findUnique: vi.fn(async () => null) },
    operatingSpaceUnit: { findMany: vi.fn(async () => [{ unitId: 'eligible' }, { unitId: 'foreign' }]) },
    organization: { findUnique: vi.fn(async () => ({ id: 'org', status: 'active' })) },
    unit: { findMany: vi.fn(async () => [{ id: 'eligible' }]) },
  };
  return { db, actor, space };
}

describe('bounded admin workspace overview reads', () => {
  it('matches each canonical capability while reading the space once', async () => {
    const { db } = fixture();
    const result = await getOperatingSpaceOverviewAccess(db as any, 'admin', 'space');
    expect(db.operatingSpace.findUnique).toHaveBeenCalledTimes(1);
    expect(db.operatingSpaceUnit.findMany).toHaveBeenCalledTimes(1);
    expect(db.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(db.unit.findMany).toHaveBeenCalledTimes(2);
    expect(result.unitIds).toEqual(['eligible']);
    expect(db.unit.findMany).toHaveBeenLastCalledWith({ where: { id: { in: ['eligible'] } }, select: { id: true } });
    for (const capability of OPERATING_SPACE_CAPABILITIES.filter(cap => !isOperatingCreationCapability(cap))) {
      const canonical = await getScopedOperationalAccess(fixture().db as any, 'admin', 'space', capability, CAPABILITY_DEPARTMENTS[capability]);
      expect(result.byCapability[capability]).toEqual(canonical.unitIds);
    }
    expect(result.byCapability).not.toHaveProperty('create_unit');
    expect(result.byCapability).not.toHaveProperty('create_complex');
  });
  it('rechecks current authority on the next invocation', async () => {
    const { db, actor } = fixture();
    await getOperatingSpaceOverviewAccess(db as any, 'admin', 'space');
    actor.status = 'blocked';
    await expect(getOperatingSpaceOverviewAccess(db as any, 'admin', 'space')).rejects.toMatchObject({ status: 403 });
  });
  it('does not reuse admin scope after demotion', async () => {
    const { db, actor } = fixture();
    await getOperatingSpaceOverviewAccess(db as any, 'admin', 'space');
    actor.isAdmin = false;
    await expect(getOperatingSpaceOverviewAccess(db as any, 'admin', 'space')).rejects.toMatchObject({ status: 403 });
  });
  it.each(['space', 'organization'])('preserves the inactive %s boundary', async boundary => {
    const { db, space } = fixture();
    if (boundary === 'space') space.status = 'archived';
    else space.organization.status = 'suspended';
    await expect(getOperatingSpaceOverviewAccess(db as any, 'admin', 'space')).rejects.toMatchObject({ status: 403 });
  });
});
