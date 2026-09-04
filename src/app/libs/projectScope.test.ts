import { describe, expect, it } from 'vitest';
import {
  getMCProjectScopes,
  getStaffProjectIds,
  hasProjectStaffAccess,
} from './projectScope';
import { resolveOpsProjectContext, opsHref } from './opsProjectContext';
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

describe('resolveOpsProjectContext', () => {
  it('aggregates all staff projects by default and drills into one when requested', () => {
    const user = userWithRoles([
      { role: 'staff_ops', projectId: 'p-1', unitId: null, organizationId: null, providerId: null },
      { role: 'onsite_host', projectId: 'p-2', unitId: null, organizationId: null, providerId: null },
    ]);

    const all = resolveOpsProjectContext(user);
    expect(all.queryProjectIds).toEqual(['p-1', 'p-2']);
    expect(all.activeProjectId).toBeNull();

    const one = resolveOpsProjectContext(user, 'p-2');
    expect(one.queryProjectIds).toEqual(['p-2']);
    expect(one.activeProjectId).toBe('p-2');

    const invalid = resolveOpsProjectContext(user, 'p-9');
    expect(invalid.queryProjectIds).toEqual(['p-1', 'p-2']);
    expect(invalid.activeProjectId).toBeNull();
  });

  it('lets admins view all projects or filter to one', () => {
    const admin = userWithRoles([], true);
    const all = resolveOpsProjectContext(admin);
    expect(all.queryProjectIds).toBeUndefined();
    expect(all.activeProjectId).toBeNull();

    const one = resolveOpsProjectContext(admin, 'project-x');
    expect(one.queryProjectIds).toEqual(['project-x']);
    expect(one.activeProjectId).toBe('project-x');
  });

  it('preserves projectId in ops links', () => {
    expect(opsHref('/ops', null)).toBe('/ops');
    expect(opsHref('/ops/tm30', 'p-1')).toBe('/ops/tm30?projectId=p-1');
    expect(opsHref('/ops/costs?foo=1', 'p-2')).toBe('/ops/costs?foo=1&projectId=p-2');
  });
});
