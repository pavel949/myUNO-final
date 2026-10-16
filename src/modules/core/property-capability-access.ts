import type { Prisma, PrismaClient } from '@prisma/client';
import { capabilityScopeMatches, isEffectiveCapabilityGrant, isPropertyCapabilityRole,
  type PropertyCapabilityGrant, type PropertyCapabilityRole } from './property-capability-policy';

type Db = PrismaClient | Prisma.TransactionClient;
export class PropertyCapabilityError extends Error {
  constructor(message = 'Assigned property capability required', public readonly status = 403) { super(message); }
}

const grantInclude = {
  unit: { select: { projectId: true } },
  parentGrant: { include: {
    unit: { select: { projectId: true } },
    identity: { select: { status: true } },
  } },
} as const;

function realUnitScope(grant: PropertyCapabilityGrant & { unit: { projectId: string } | null }): boolean {
  return grant.scopeType === 'project' || Boolean(grant.unit && grant.unit.projectId === grant.projectId);
}

/** Current rows only. `lock` is used inside the same transaction as canonical writes. */
export async function readPropertyCapabilityAccess(db: Db, actorIdentityId: string,
  role: PropertyCapabilityRole, lock = false) {
  if (!isPropertyCapabilityRole(role)) throw new PropertyCapabilityError();
  const loadActor = () => db.identity.findUnique({ where: { id: actorIdentityId },
    select: { id: true, status: true, isAdmin: true } });
  const loadGrants = () => db.roleAssignment.findMany({
    where: { identityId: actorIdentityId, role, status: 'active' }, include: grantInclude,
  });
  let actor = await loadActor();
  if (!actor || actor.status !== 'active') throw new PropertyCapabilityError('Active account required');
  let candidates = actor.isAdmin ? [] : await loadGrants();
  if (lock) {
    // Lock actual current holders and ancestor rows, then reread. A revoke/block
    // that won before the locks is observed; one arriving after waits for commit.
    const holders = [...new Set([actorIdentityId, ...candidates.flatMap(row => row.parentGrant ? [row.parentGrant.identityId] : [])])].sort();
    await db.$queryRaw`SELECT id FROM identity WHERE id = ANY(${holders}::text[]) ORDER BY id FOR SHARE`;
    const ids = [...new Set(candidates.flatMap(row => [row.id, ...(row.parentGrantId ? [row.parentGrantId] : [])]))].sort();
    if (ids.length) await db.$queryRaw`SELECT id FROM role_assignment WHERE id = ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
    actor = await loadActor();
    if (!actor || actor.status !== 'active') throw new PropertyCapabilityError('Active account required');
    candidates = actor.isAdmin ? [] : await loadGrants();
    // Newly inserted grants were not locked. Exclude them for this transaction;
    // the next request can use them, without treating a phantom row as authority.
    candidates = candidates.filter(row => ids.includes(row.id) &&
      (!row.parentGrantId || ids.includes(row.parentGrantId)));
  }
  const now = new Date();
  const grants = candidates.filter(grant => grant.role === role && realUnitScope(grant) &&
    (!grant.parentGrant || realUnitScope(grant.parentGrant)) &&
    isEffectiveCapabilityGrant({ grant, actorIdentityId, actorActive: true,
      parent: grant.parentGrant, parentActorActive: grant.parentGrant?.identity.status === 'active', now }));
  return { actor, grants };
}

export async function assertPropertyCapabilityForUnit(db: Db, actorIdentityId: string,
  role: PropertyCapabilityRole, unitId: string, lock = false) {
  if (typeof unitId !== 'string' || !unitId || unitId !== unitId.trim()) throw new PropertyCapabilityError('Invalid unit', 400);
  if (lock) await db.$queryRaw`SELECT id FROM unit WHERE id = ${unitId} FOR UPDATE`;
  const unit = await db.unit.findUnique({ where: { id: unitId }, select: {
    id: true, name: true, projectId: true, status: true, inventoryCategoryId: true, updatedAt: true, instantBook: true,
  } });
  if (!unit) throw new PropertyCapabilityError('Unit not found', 404);
  const access = await readPropertyCapabilityAccess(db, actorIdentityId, role, lock);
  if (!access.actor.isAdmin && (unit.status === 'offboarded' || !access.grants.some(grant =>
    capabilityScopeMatches(grant, { unitId: unit.id, projectId: unit.projectId })))) throw new PropertyCapabilityError();
  return { ...access, unit };
}

/** Parent revocation/block/expiry also removes names from the employee picker. */
export async function listPropertyCapabilityUnits(db: Db, actorIdentityId: string, role: PropertyCapabilityRole) {
  const { actor, grants } = await readPropertyCapabilityAccess(db, actorIdentityId, role);
  if (!actor.isAdmin && !grants.length) return [];
  return db.unit.findMany({ where: { status: { not: 'offboarded' },
    ...(actor.isAdmin ? {} : { OR: grants.map(grant => grant.scopeType === 'project'
      ? { projectId: grant.projectId! } : { id: grant.unitId!, projectId: grant.projectId! }) }),
  }, select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
  orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }] });
}
