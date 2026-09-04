import { describe, expect, it } from 'vitest';
import {
  getMCProjectScopes,
  getStaffProjectIds,
  hasProjectStaffAccess,
} from './projectScope';
import type { CurrentUser } from '@/app/actions/getCurrentUser';

function userWithRoles(roles: CurrentUser['roles'], isAdmin = false): CurrentUser {
  return {
    identityId: 'user-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    isAdmin,
    roles,
  };
}

describe('projectScope helpers', () => {
  it('returns unique project ids for staff roles including onsite host', () => {
    const user = userWithRoles([
      { role: 'staff_ops', projectId: 'p-1', unitId: null, organizationId: null, providerId: null },
      { role: 'onsite_host', projectId: 'p-2', unitId: null, organizationId: null, providerId: null },
      { role: 'staff_ops', projectId: 'p-1', unitId: null, organizationId: null, providerId: null },
      { role: 'owner', projectId: 'p-3', unitId: null, organizationId: null, providerId: null },
    ]);

    expect(getStaffProjectIds(user)).toEqual(['p-1', 'p-2']);
    expect(hasProjectStaffAccess(user, 'p-2')).toBe(true);
    expect(hasProjectStaffAccess(user, 'p-3')).toBe(false);
  });

  it('returns deduplicated mc scope pairs', () => {
    const user = userWithRoles([
      {
        role: 'mc_member',
        projectId: 'project-a',
        unitId: null,
        organizationId: 'org-a',
        providerId: null,
      },
      {
        role: 'mc_member',
        projectId: 'project-a',
        unitId: null,
        organizationId: 'org-a',
        providerId: null,
      },
      {
        role: 'mc_member',
        projectId: 'project-a',
        unitId: null,
        organizationId: 'org-b',
        providerId: null,
      },
      { role: 'guest', projectId: null, unitId: null, organizationId: null, providerId: null },
    ]);

    expect(getMCProjectScopes(user)).toEqual([
      { projectId: 'project-a', organizationId: 'org-a' },
      { projectId: 'project-a', organizationId: 'org-b' },
    ]);
  });

  it('always grants project staff access to admins', () => {
    const admin = userWithRoles([], true);
    expect(hasProjectStaffAccess(admin, 'any-project')).toBe(true);
  });
});
