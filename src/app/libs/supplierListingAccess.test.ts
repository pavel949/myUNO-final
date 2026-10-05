import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({unit: {findUnique: vi.fn()}, roleAssignment: {findFirst: vi.fn()}, unitEngagement: {findMany: vi.fn()}, externalMapping: {findFirst: vi.fn()}}));
vi.mock('@/lib/prisma', () => ({prisma: db}));
import { hasSelfListingAccess } from './supplierListingAccess';
beforeEach(() => {
  vi.clearAllMocks();
  db.unit.findUnique.mockResolvedValue({ownerIdentityId: 'owner', status: 'live'});
  db.roleAssignment.findFirst.mockResolvedValue({id: 'role'});
  db.unitEngagement.findMany.mockResolvedValue([{engagementType: 'owner_direct', ownerIdentityId: 'owner', startsOn: null, endsOn: null}]);
  db.externalMapping.findFirst.mockResolvedValue(null);
});
describe('self listing access', () => {
  it('allows the verified unit owner with one active self-operated engagement', async () => {
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(true);
    expect(db.roleAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({scopeType: 'unit', unitId: 'unit', status: 'active'})}));
  });
  it('rejects another owner and never falls back to a platform owner role', async () => {
    expect(await hasSelfListingAccess('other', 'unit')).toBe(false);
    db.roleAssignment.findFirst.mockResolvedValue(null);
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(false);
  });
  it.each(['direct_managed', 'via_management_company'])('does not delegate %s inventory to its owner', async engagementType => {
    db.unitEngagement.findMany.mockResolvedValue([{engagementType, ownerIdentityId: 'owner', startsOn: null, endsOn: null}]);
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(false);
  });
  it('rejects conflicting engagements, expired terms and external authority', async () => {
    db.unitEngagement.findMany.mockResolvedValue([{engagementType: 'owner_direct'}, {engagementType: 'direct_managed'}]);
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(false);
    db.unitEngagement.findMany.mockResolvedValue([{engagementType: 'owner_direct', ownerIdentityId: 'owner', startsOn: null, endsOn: new Date('2000-01-01')}]);
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(false);
    db.unitEngagement.findMany.mockResolvedValue([{engagementType: 'owner_direct', ownerIdentityId: 'owner', startsOn: null, endsOn: null}]);
    db.externalMapping.findFirst.mockResolvedValue({id: 'mapping'});
    expect(await hasSelfListingAccess('owner', 'unit')).toBe(false);
  });
});
