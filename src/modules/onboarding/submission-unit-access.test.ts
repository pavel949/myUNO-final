import { describe, expect, it } from 'vitest';
import { submissionUnitWhere } from './submission-unit-access';

describe('submission unit access query contract', () => {
  it('keeps admin access project-bounded and excludes offboarded units', () => {
    expect(submissionUnitWhere({ identityId: 'admin', isAdmin: true }, 'p1'))
      .toEqual({ projectId: 'p1', status: { not: 'offboarded' } });
  });

  it('requires current ownership and exact active unit assignment for private owner access', () => {
    const where = submissionUnitWhere({ identityId: 'owner', isAdmin: false }, 'p1');
    expect(where.OR).toContainEqual({
      ownerIdentityId: 'owner',
      roleAssignments: { some: { identityId: 'owner', role: 'owner', status: 'active', scopeType: 'unit', projectId: 'p1' } },
    });
    expect(where.OR).toContainEqual({ status: 'live', project: { status: 'live' } });
    expect(where.OR).toHaveLength(3);
  });

  it('ties MC rights to the current mandate and the same active organization/project grant', () => {
    const now = new Date('2026-10-10T00:00:00Z');
    const where = submissionUnitWhere({ identityId: 'mc', isAdmin: false }, 'p1', now);
    expect(where.OR).toContainEqual({ engagements: { some: {
      engagementType: 'via_management_company', status: 'active',
      AND: [ { OR: [{ startsOn: null }, { startsOn: { lte: now } }] }, { OR: [{ endsOn: null }, { endsOn: { gt: now } }] } ],
      managementOrg: { status: 'active', roleAssignments: { some: {
        identityId: 'mc', role: 'mc_member', status: 'active', scopeType: 'project', projectId: 'p1',
      } } },
    } } });
  });
});
