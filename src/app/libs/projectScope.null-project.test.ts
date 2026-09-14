import { describe, it, expect } from 'vitest';
import { hasProjectStaffAccess } from '@/app/libs/projectScope';
import type { CurrentUser } from '@/app/actions/getCurrentUser';

/**
 * `service_order.project_id` is nullable in the database — the canonical v3
 * commerce migration made standalone orders representable. Reconciling
 * schema.prisma with that reality turned the project id passed into the
 * authorization helpers into `string | null`.
 *
 * The security question that raises: does an absent project widen access?
 * It must not. A project-scoped staff role grants access to *that* project,
 * so a subject belonging to no project is outside every such grant.
 */
describe('hasProjectStaffAccess with no project', () => {
  const staff = {
    identityId: 'idn_staff',
    isAdmin: false,
    roles: [{ role: 'staff_ops', projectId: 'prj_1', providerId: null, unitId: null }],
  } as unknown as CurrentUser;

  const admin = { identityId: 'idn_admin', isAdmin: true, roles: [] } as unknown as CurrentUser;

  it('denies project staff when the subject has no project', () => {
    expect(hasProjectStaffAccess(staff, null)).toBe(false);
  });

  it('still grants that staff member access to their own project', () => {
    expect(hasProjectStaffAccess(staff, 'prj_1')).toBe(true);
  });

  it('does not let a null project match a different project', () => {
    expect(hasProjectStaffAccess(staff, 'prj_2')).toBe(false);
  });

  it('keeps admin access, which is not project-scoped', () => {
    expect(hasProjectStaffAccess(admin, null)).toBe(true);
  });
});
