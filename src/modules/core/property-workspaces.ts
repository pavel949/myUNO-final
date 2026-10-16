import type { Prisma, PrismaClient } from '@prisma/client';
import { validateRoleAssignmentScope } from './role-assignment-policy';
import { PropertyCapabilityError, readPropertyCapabilityAccess } from './property-capability-access';

type Db = PrismaClient | Prisma.TransactionClient;
export type PropertyWorkspace = 'content' | 'pricing' | 'booking-mode' | 'access';
export async function getPropertyWorkspaces(db: Db, identityId: string): Promise<PropertyWorkspace[]> {
  const actor = await db.identity.findUnique({ where: { id: identityId }, select: { status: true, isAdmin: true } });
  if (actor?.status !== 'active') return [];
  if (actor.isAdmin) return ['content', 'pricing', 'booking-mode', 'access'];
  const content = await db.roleAssignment.findMany({ where: { identityId, status: 'active', role: 'content_contributor' },
    include: { unit: { select: { projectId: true } } } });
  const result: PropertyWorkspace[] = [];
  if (content.some(grant => {
    try { validateRoleAssignmentScope(grant); return grant.identityId === identityId && grant.status === 'active' &&
      grant.role === 'content_contributor' && (grant.scopeType === 'project' || grant.unit?.projectId === grant.projectId); }
    catch { return false; }
  })) result.push('content');
  let delegable = false;
  for (const [role, destination] of [['pricing_editor', 'pricing'], ['booking_mode_editor', 'booking-mode']] as const) {
    const access = await readPropertyCapabilityAccess(db, identityId, role).catch(error => {
      if (error instanceof PropertyCapabilityError) return null;
      throw error;
    });
    if (access?.grants.length) result.push(destination);
    if (access?.grants.some(grant => grant.canDelegate && !grant.parentGrantId)) delegable = true;
  }
  if (delegable) result.push('access');
  return result;
}
