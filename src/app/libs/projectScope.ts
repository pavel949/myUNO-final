import type { CurrentUser } from '@/app/actions/getCurrentUser';

const STAFF_ROLES = new Set(['staff_ops', 'onsite_host']);

export function hasProjectStaffAccess(user: CurrentUser, projectId: string): boolean {
  if (user.isAdmin) {
    return true;
  }

  return user.roles.some(
    (assignment) => STAFF_ROLES.has(assignment.role) && assignment.projectId === projectId
  );
}
