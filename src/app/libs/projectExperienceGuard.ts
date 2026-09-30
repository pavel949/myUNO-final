import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';

/**
 * Project Experience is editable by platform admins or project-scoped myUNO
 * staff explicitly granted the content department. The role and department
 * grant are both required; neither one alone is sufficient.
 */
export async function getProjectExperienceActor(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isAdmin) return user;

  const [role, permission] = await Promise.all([
    prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        status: 'active',
        role: 'staff_ops',
        scopeType: 'project',
        projectId,
      },
      select: { id: true },
    }),
    prisma.projectStaffPermission.findUnique({
      where: { projectId_identityId: { projectId, identityId: user.identityId } },
      select: { departments: true },
    }),
  ]);

  return role && permission?.departments.includes('content') ? user : null;
}

export async function projectExperienceAccess(projectId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  if (user.isAdmin) return { user } as const;

  const actor = await getProjectExperienceActor(projectId);
  if (!actor) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  return { user: actor } as const;
}


/** Project-scoped staff who may operate amenity reservation queues. */
export async function getProjectAmenityOpsActor(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isAdmin) return user;

  const [role, permission] = await Promise.all([
    prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        status: 'active',
        role: 'staff_ops',
        scopeType: 'project',
        projectId,
      },
      select: { id: true },
    }),
    prisma.projectStaffPermission.findUnique({
      where: { projectId_identityId: { projectId, identityId: user.identityId } },
      select: { departments: true },
    }),
  ]);
  const allowed = permission?.departments.some(department =>
    ['front_desk', 'guest_care', 'reservations'].includes(department)
  );
  return role && allowed ? user : null;
}
