import type { PrismaClient } from '@prisma/client';
import { readPropertyCapabilityAccess, PropertyCapabilityError } from './property-capability-access';
import { capabilityScopeContains, isPropertyCapabilityRole, type PropertyCapabilityRole } from './property-capability-policy';

export async function propertyDelegationWorkspace(db: PrismaClient, actorIdentityId: string) {
  const grants: Awaited<ReturnType<typeof readPropertyCapabilityAccess>>['grants'] = [];
  for (const role of ['pricing_editor', 'booking_mode_editor'] as const) {
    const access = await readPropertyCapabilityAccess(db, actorIdentityId, role);
    if (access.actor.isAdmin) return { administrator: true, grants: [], assignments: [] };
    grants.push(...access.grants.filter(grant => grant.canDelegate && !grant.parentGrantId));
  }
  if (!grants.length) throw new PropertyCapabilityError('No current delegable property rights');
  const ids = grants.map(grant => grant.id);
  const parents = await db.roleAssignment.findMany({ where: { id: { in: ids } }, select: {
    id: true, role: true, scopeType: true, projectId: true, unitId: true, expiresAt: true,
    project: { select: { name: true } }, unit: { select: { name: true } },
  } });
  const children = await db.roleAssignment.findMany({ where: { parentGrantId: { in: ids }, grantedByIdentityId: actorIdentityId },
    include: { identity: { select: { firstName: true, lastName: true, email: true, status: true } },
      project: { select: { name: true } }, unit: { select: { name: true, projectId: true } } }, orderBy: { createdAt: 'desc' } });
  return { administrator: false,
    grants: parents.map(grant => ({ id: grant.id, role: grant.role, scopeType: grant.scopeType,
      projectId: grant.projectId!, unitId: grant.unitId, projectName: grant.project?.name ?? '',
      unitName: grant.unit?.name ?? null, expiresAt: grant.expiresAt?.toISOString() ?? null })),
    assignments: children.filter(child => grants.some(parent => parent.id === child.parentGrantId &&
      parent.role === child.role && capabilityScopeContains(parent, child) &&
      (child.scopeType === 'project' || child.unit?.projectId === child.projectId)))
      .map(child => ({ id: child.id, role: child.role, status: child.status, scopeType: child.scopeType,
        projectName: child.project?.name ?? '', unitName: child.unit?.name ?? null,
        parentGrantId: child.parentGrantId!, projectId: child.projectId!, unitId: child.unitId, updatedAt: child.updatedAt.toISOString(),
        name: `${child.identity.firstName} ${child.identity.lastName}`, email: child.identity.email,
        accountStatus: child.identity.status, expiresAt: child.expiresAt?.toISOString() ?? null })),
  };
}

export async function propertyDelegationUnits(db: PrismaClient, actorIdentityId: string, input: {
  role: unknown; parentGrantId: unknown; query: unknown;
}) {
  if (!isPropertyCapabilityRole(input.role) || typeof input.parentGrantId !== 'string' ||
      typeof input.query !== 'string' || input.query.length > 200) throw new PropertyCapabilityError('Invalid inventory query', 400);
  const access = await readPropertyCapabilityAccess(db, actorIdentityId, input.role);
  const parent = access.grants.find(grant => grant.id === input.parentGrantId && grant.canDelegate && !grant.parentGrantId);
  if (!parent) throw new PropertyCapabilityError('Current delegable scope required');
  const query = input.query.trim();
  const units = await db.unit.findMany({ where: {
    projectId: parent.projectId!, ...(parent.scopeType === 'unit' ? { id: parent.unitId! } : {}),
    status: { not: 'offboarded' }, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { id: query }] } : {}),
  }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 51 });
  return { units: units.slice(0, 50), hasMore: units.length > 50 };
}

/** Only exact email lookup after confirming current delegable authority; never expose a global people search. */
export async function resolvePropertyDelegationRecipient(db: PrismaClient, actorIdentityId: string,
  role: PropertyCapabilityRole, parentGrantId: string, email: unknown) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new PropertyCapabilityError('Enter the employee’s exact account email', 400);
  const access = await readPropertyCapabilityAccess(db, actorIdentityId, role);
  if (!access.grants.some(grant => grant.id === parentGrantId && grant.canDelegate && !grant.parentGrantId))
    throw new PropertyCapabilityError('Current delegable scope required');
  const recipient = await db.identity.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, status: true } });
  if (!recipient || !['active', 'invited'].includes(recipient.status))
    throw new PropertyCapabilityError('Ask the administrator to invite this account first', 400);
  return recipient.id;
}
